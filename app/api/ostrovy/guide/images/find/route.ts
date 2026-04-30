import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { hostname } from "node:os";

import {
  getApiSessionContext,
  GUIDE_ROLE_CODES,
  hasAnySessionRole,
} from "@/src/lib/api/session";

export const runtime = "nodejs";
export const maxDuration = 90;

const CODEX_QUERY_TIMEOUT_MS = 8_000;
const CODEX_WEB_TIMEOUT_MS = 22_000;
const MAX_CODEX_CANDIDATES = 6;
const MAX_IMAGE_OPTIONS = 3;
const FAST_SEARCH_QUERY_LIMIT = 5;
const FIND_CACHE_TTL_MS = 10 * 60 * 1000;
const FIND_CACHE_VERSION = "open-visual-intent-v2";
const CODEX_EXECUTION_HOST = "gx10";

type ImageCandidate = {
  imageUrl: string;
  previewUrl?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  license?: string | null;
  author?: string | null;
  provider?: string | null;
  reason?: string | null;
};

type DuckDuckGoImageResult = {
  image?: string;
  thumbnail?: string;
  title?: string;
  url?: string;
  source?: string;
  width?: number;
  height?: number;
};

type DuckDuckGoImageResponse = {
  results?: DuckDuckGoImageResult[];
};

type ImageFindResponseBody = {
  options: Array<{
    imageUrl: string;
    previewUrl: string;
    sourceTitle?: string | null;
    sourceUrl?: string | null;
    license?: string | null;
    author?: string | null;
    provider?: string | null;
    reason?: string | null;
  }>;
  codexCandidates: Array<{
    sourceTitle?: string | null;
    sourceUrl?: string | null;
    provider?: string | null;
    license?: string | null;
    author?: string | null;
    reason?: string | null;
  }>;
};

const findCache = new Map<string, { expiresAt: number; body: ImageFindResponseBody }>();

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function extractJsonArrays(text: string): unknown[] {
  const arrays: unknown[] = [];

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "[") continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (char === "[") depth += 1;
      if (char === "]") depth -= 1;

      if (depth === 0) {
        try {
          arrays.push(JSON.parse(text.slice(start, index + 1)));
          start = index;
        } catch {
          // Keep scanning; Codex CLI may print transcript lines before the final JSON.
        }
        break;
      }
    }
  }

  return arrays;
}

function candidateProvider(candidate: ImageCandidate): string | null {
  if (candidate.provider?.trim()) return candidate.provider.trim();
  try {
    return new URL(candidate.sourceUrl ?? candidate.imageUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function providerFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, "");
    const firstPart = hostname.split(".")[0];
    return firstPart ? firstPart[0].toUpperCase() + firstPart.slice(1) : hostname;
  } catch {
    return null;
  }
}

function parseCodexCandidates(value: unknown): ImageCandidate[] {
  if (!Array.isArray(value)) return [];

  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const imageUrl = stringValue(record.imageUrl ?? record.image_url ?? record.url ?? record.directImageUrl);
    if (!isHttpUrl(imageUrl)) continue;

    const key = imageUrl.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const sourceUrl = stringValue(record.sourceUrl ?? record.source_url ?? record.pageUrl ?? record.page_url);
    const candidate: ImageCandidate = {
      imageUrl,
      previewUrl: stringValue(record.previewUrl ?? record.preview_url ?? record.thumbnail),
      sourceUrl: isHttpUrl(sourceUrl) ? sourceUrl : null,
      sourceTitle: stringValue(record.sourceTitle ?? record.source_title ?? record.title),
      license: stringValue(record.license),
      author: stringValue(record.author ?? record.creator),
      provider: stringValue(record.provider ?? record.source),
      reason: stringValue(record.reason ?? record.relevance),
    };
    candidate.provider = candidateProvider(candidate);
    candidates.push(candidate);
  }

  return candidates.slice(0, MAX_CODEX_CANDIDATES);
}

function extractCodexCandidates(text: string): ImageCandidate[] {
  const arrays = extractJsonArrays(text);
  for (const array of arrays.reverse()) {
    const candidates = parseCodexCandidates(array);
    if (candidates.length > 0) return candidates;
  }
  return [];
}

function extractCodexQueries(text: string): string[] {
  for (const array of extractJsonArrays(text).reverse()) {
    if (!Array.isArray(array)) continue;
    const queries = array
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (queries.length > 0) return queries.slice(0, 4);
  }
  return [];
}

function uniqueQueries(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized.slice(0, 160));
  }
  return out;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function compactSearchPhrase(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function fallbackQueries(title: string, description: string): string[] {
  const titlePhrase = compactSearchPhrase(title);
  const descriptionPhrase = compactSearchPhrase(description);
  return [
    titlePhrase && `${titlePhrase} photo`,
    descriptionPhrase && `${descriptionPhrase} photo`,
    titlePhrase && `${titlePhrase} scene photo`,
  ].filter((item): item is string => Boolean(item?.trim()));
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function isCodexExecutionHost(): boolean {
  const localHostnames = [hostname(), process.env.HOSTNAME ?? ""]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return localHostnames.some((value) => value === CODEX_EXECUTION_HOST || value.startsWith(`${CODEX_EXECUTION_HOST}.`));
}

function codexCommand(codexArgs: string[]): { bin: string; args: string[] } {
  if (isCodexExecutionHost()) {
    return {
      bin: process.env.CODEX_CLI_PATH?.trim() || "codex",
      args: codexArgs,
    };
  }

  const sshBin = process.env.CODEX_REMOTE_SSH_BIN?.trim() || "ssh";
  const sshHost = process.env.CODEX_REMOTE_HOST?.trim() || CODEX_EXECUTION_HOST;
  const sshExtraArgs = (process.env.CODEX_REMOTE_SSH_OPTIONS ?? "")
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const sshConnectTimeout = process.env.CODEX_REMOTE_CONNECT_TIMEOUT_SECONDS?.trim() || "8";
  const remoteCodexPath = process.env.CODEX_REMOTE_CODEX_PATH?.trim() || "codex";
  const remoteCommand = [
    "NO_COLOR=1",
    shellQuote(remoteCodexPath),
    ...codexArgs.map(shellQuote),
  ].join(" ");

  return {
    bin: sshBin,
    args: [
      "-o",
      "BatchMode=yes",
      "-o",
      `ConnectTimeout=${sshConnectTimeout}`,
      ...sshExtraArgs,
      sshHost,
      remoteCommand,
    ],
  };
}

async function runCodex(prompt: string, timeoutMs: number, useWebSearch: boolean): Promise<string> {
  const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const codexArgs = [
      "--ask-for-approval",
      "never",
    ];
    if (useWebSearch) codexArgs.push("--search");
    codexArgs.push("exec");
    const model = process.env.CODEX_IMAGE_MODEL?.trim() || "gpt-5.4-mini";
    codexArgs.push("--model", model, "-c", "model_reasoning_effort=\"low\"");
    codexArgs.push(
      "--ephemeral",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--color",
      "never",
      "-",
    );
    const command = codexCommand(codexArgs);

    const child = spawn(command.bin, command.args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      reject(new Error("Codex CLI timed out."));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Codex CLI exited with code ${code}.`));
      }
    });
    child.stdin.end(prompt);
  });

  return `${stdout}\n${stderr}`;
}

async function buildCodexImageQueries(title: string, description: string): Promise<string[]> {
  const prompt = [
    "Vytvoř rychlé anglické dotazy pro obrázkové vyhledávání thumbnailu.",
    "Nehledej na webu. Pouze převeď název a popis do konkrétních obrazových dotazů.",
    "Nepředpokládej typ aktivity, cílovou skupinu, prostředí ani formát. Použij jen to, co přímo vyplývá z textu.",
    "Každý dotaz má popsat konkrétní vizuální scénu: hlavní činnost, místo, objekt, materiál, osobu, situaci nebo výsledek.",
    "U vícevýznamových slov použij význam podle kontextu popisu.",
    "Vrať pouze JSON pole 4 stringů. Bez markdownu a bez vysvětlení.",
    "",
    `Název: ${title || "(není zadán)"}`,
    `Popis: ${description || "(není zadán)"}`,
  ].join("\n");

  try {
    return extractCodexQueries(await runCodex(prompt, CODEX_QUERY_TIMEOUT_MS, false));
  } catch {
    return [];
  }
}

async function buildCodexImageCandidates(title: string, description: string): Promise<ImageCandidate[]> {
  const prompt = [
    "Jsi rešeršér obrázků pro aplikaci. Hledáš thumbnail k zadanému názvu a popisu.",
    "",
    "Najdi konkrétní veřejně dostupné obrázky na webu bez omezení zdroje.",
    "Neomezuj se na Wikimedia Commons, Openverse ani žádnou konkrétní galerii. Můžeš použít fotobanky, galerie, tematické weby, blogy nebo jiné veřejné stránky.",
    "Neomezuj výběr podle licence; pokud licenci neumíš ověřit, napiš \"unknown\".",
    "Pracuj rychle: použij nejvýše 5 webových dotazů a nejvýše 8 otevřených stránek. Jakmile máš tři dobré přímé obrázky, nehledej zbytečně dál.",
    "",
    "Kvalita výběru je důležitější než doslovná shoda slov:",
    "- nejdřív pochop hlavní scénu, činnost, místo, objekt, materiál, osobu, situaci nebo výsledek,",
    "- nepřidávej vlastní předpoklady o typu aktivity; drž se jen názvu a popisu,",
    "- preferuj obrázek, kde je přímo vidět to, co popis označuje jako hlavní děj nebo místo,",
    "- vyřaď obrázky, které odpovídají jen vedlejšímu slovu, ale ne zadání jako celku,",
    "- u slov s více významy zkontroluj kontext a vyhni se nesouvisejícím významům, produktovým fotkám a čistě dekorativním abstrakcím.",
    "",
    "Ke každému kandidátovi ověř, že imageUrl je přímá veřejná URL obrázku typu jpg, png, webp nebo gif a sourceUrl je stránka se zdrojem.",
    "Seřaď kandidáty od nejvíce vypovídajícího.",
    "Vrať přesně 3 nejlepší kandidáty, pokud jsou rozumně dostupné. Pokud tři nenajdeš, vrať alespoň jeden dobrý kandidát.",
    "Nevracej markdown ani vysvětlení mimo JSON.",
    "Vrať pouze JSON pole objektů se strukturou:",
    "{\"imageUrl\":\"https://...\",\"sourceUrl\":\"https://...\",\"sourceTitle\":\"...\",\"provider\":\"...\",\"license\":\"...\",\"author\":\"...\",\"reason\":\"krátké zdůvodnění relevance\"}",
    "",
    `Název: ${title || "(není zadán)"}`,
    `Popis: ${description || "(není zadán)"}`,
  ].join("\n");

  try {
    return extractCodexCandidates(await runCodex(prompt, CODEX_WEB_TIMEOUT_MS, true));
  } catch {
    return [];
  }
}

async function duckDuckGoVqd(query: string): Promise<string | null> {
  const pageUrl = `https://duckduckgo.com/?${new URLSearchParams({ q: query, iax: "images", ia: "images" })}`;
  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 svetoplavci-app/0.1",
    },
  });
  if (!response.ok) return null;
  const html = await response.text();
  return html.match(/vqd=['"]?([\d-]+)['"]?/)?.[1] ?? html.match(/"vqd":"([^"]+)"/)?.[1] ?? null;
}

function duckDuckGoLicense(provider: string | null): string | null {
  if (!provider) return "unknown";
  return provider.toLowerCase().includes("pexels") ? "Pexels License" : "unknown";
}

function sourceScore(candidate: ImageCandidate): number {
  const text = normalizeSearchText(
    `${candidate.sourceTitle ?? ""} ${candidate.sourceUrl ?? ""} ${candidate.provider ?? ""} ${candidate.imageUrl}`,
  );
  let score = 0;
  if (text.includes("pexels.com")) score += 10;
  if (text.includes("wikimedia.org")) score += 30;
  if (text.includes("flickr.com")) score += 20;
  if (text.includes("unsplash.com")) score += 20;
  if (text.includes("freepik.com") || text.includes("premium ai") || text.includes("depositphotos.com")) score -= 20;
  if (text.includes("dreamstime.com") || text.includes("alamy.com")) score -= 10;
  if (text.includes("stock video") || text.includes("free stock video") || text.includes("fashion") || text.includes("model photo")) score -= 40;
  if (candidate.previewUrl) score += 5;
  return score;
}

async function searchDuckDuckGoImages(query: string): Promise<ImageCandidate[]> {
  const vqd = await duckDuckGoVqd(query);
  if (!vqd) return [];

  const params = new URLSearchParams({
    l: "us-en",
    o: "json",
    q: query,
    vqd,
    f: ",,,",
    p: "1",
  });
  const response = await fetch(`https://duckduckgo.com/i.js?${params.toString()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 svetoplavci-app/0.1",
      Referer: "https://duckduckgo.com/",
    },
  });
  if (!response.ok) return [];

  const json = (await response.json()) as DuckDuckGoImageResponse;
  return (json.results ?? [])
    .filter((result) => isHttpUrl(result.image))
    .map((result) => {
      const provider = providerFromUrl(result.url) ?? result.source ?? "Web";
      return {
        imageUrl: result.image as string,
        previewUrl: isHttpUrl(result.thumbnail) ? result.thumbnail : result.image,
        sourceTitle: stringValue(result.title),
        sourceUrl: isHttpUrl(result.url) ? result.url : null,
        license: duckDuckGoLicense(provider),
        provider,
        reason: `Rychlý výsledek pro: ${query}`,
      };
    });
}

async function buildFastImageCandidates(title: string, description: string): Promise<ImageCandidate[]> {
  const codexQueries = await buildCodexImageQueries(title, description);
  const baseQueries = uniqueQueries([
    ...codexQueries,
    ...fallbackQueries(title, description),
  ]).slice(0, FAST_SEARCH_QUERY_LIMIT);
  const searchQueries = uniqueQueries(baseQueries);

  const results = await Promise.allSettled(searchQueries.map((query) => searchDuckDuckGoImages(query)));
  const seen = new Set<string>();
  const candidates: ImageCandidate[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const candidate of result.value) {
      const key = (candidate.sourceUrl ?? candidate.imageUrl).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
    }
  }

  return candidates
    .sort((a, b) => sourceScore(b) - sourceScore(a))
    .slice(0, MAX_IMAGE_OPTIONS);
}

export async function POST(req: NextRequest) {
  const context = await getApiSessionContext();
  if (!context) return unauthorized();
  if (!hasAnySessionRole(context.roles, GUIDE_ROLE_CODES)) return forbidden();

  let payload: { title?: string; description?: string };
  try {
    payload = (await req.json()) as { title?: string; description?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = payload.title?.trim() ?? "";
  const description = payload.description?.trim() ?? "";
  const cacheKey = JSON.stringify([FIND_CACHE_VERSION, title, description]);
  const cached = findCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.body);
  }

  const codexCandidates = await buildCodexImageCandidates(title, description);
  const fastCandidates = codexCandidates.length > 0 ? [] : await buildFastImageCandidates(title, description);
  const candidates = codexCandidates.length > 0 ? codexCandidates : fastCandidates;
  const options = candidates.slice(0, MAX_IMAGE_OPTIONS).map((candidate) => ({
    imageUrl: candidate.imageUrl,
    previewUrl: candidate.previewUrl ?? candidate.imageUrl,
    sourceTitle: candidate.sourceTitle,
    sourceUrl: candidate.sourceUrl,
    license: candidate.license,
    author: candidate.author,
    provider: candidateProvider(candidate),
    reason: candidate.reason,
  }));

  if (options.length > 0) {
    const body = {
      options,
      codexCandidates: candidates.map((item) => ({
        sourceTitle: item.sourceTitle,
        sourceUrl: item.sourceUrl,
        provider: candidateProvider(item),
        license: item.license,
        author: item.author,
        reason: item.reason,
      })),
    };
    findCache.set(cacheKey, { expiresAt: Date.now() + FIND_CACHE_TTL_MS, body });
    return NextResponse.json(body);
  }

  return NextResponse.json({ error: "Codex nenašel žádný použitelný veřejný obrázek." }, { status: 404 });
}
