import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { hostname } from "node:os";

import {
  getApiSessionContext,
  GUIDE_ROLE_CODES,
  hasAnySessionRole,
} from "@/src/lib/api/session";

export const runtime = "nodejs";
export const maxDuration = 60;

const CLAUDE_QUERY_TIMEOUT_MS = 8_000;
const MAX_IMAGE_OPTIONS = 3;
const FAST_SEARCH_QUERY_LIMIT = 5;
const FIND_CACHE_TTL_MS = 10 * 60 * 1000;
const FIND_CACHE_VERSION = "open-visual-intent-v3";
const CLAUDE_EXECUTION_HOST = "gx10";

// Inline Node.js script executed on gx10 via SSH.
// Reads prompt from stdin, calls Claude API using gx10's ANTHROPIC_API_KEY, prints text to stdout.
const REMOTE_CLAUDE_SCRIPT = `
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', async () => {
  const prompt = Buffer.concat(chunks).toString();
  const model = process.env.CLAUDE_IMAGE_MODEL || 'claude-haiku-4-5-20251001';
  const key = process.env.ANTHROPIC_API_KEY || '';
  if (!key) { process.exit(1); }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 512, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) { process.stderr.write(await res.text()); process.exit(1); }
  const data = await res.json();
  const text = data.content?.find(b => b.type === 'text')?.text ?? '';
  process.stdout.write(text);
});
`.trim();

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
          // ignore malformed fragments
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
    const h = new URL(value).hostname.replace(/^www\./, "");
    const first = h.split(".")[0];
    return first ? first[0].toUpperCase() + first.slice(1) : h;
  } catch {
    return null;
  }
}

function extractImageQueries(text: string): string[] {
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

function isClaudeExecutionHost(): boolean {
  const localHostnames = [hostname(), process.env.HOSTNAME ?? ""]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return localHostnames.some(
    (value) => value === CLAUDE_EXECUTION_HOST || value.startsWith(`${CLAUDE_EXECUTION_HOST}.`),
  );
}

function claudeCommand(): { bin: string; args: string[] } {
  const nodeScript = REMOTE_CLAUDE_SCRIPT;

  if (isClaudeExecutionHost()) {
    return {
      bin: process.env.NODE_BIN?.trim() || "node",
      args: ["-e", nodeScript],
    };
  }

  const sshBin = process.env.CLAUDE_REMOTE_SSH_BIN?.trim() || "ssh";
  const sshHost = process.env.CLAUDE_REMOTE_HOST?.trim() || CLAUDE_EXECUTION_HOST;
  const sshExtraArgs = (process.env.CLAUDE_REMOTE_SSH_OPTIONS ?? "")
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const sshConnectTimeout = process.env.CLAUDE_REMOTE_CONNECT_TIMEOUT_SECONDS?.trim() || "8";
  const remoteCommand = `node -e ${shellQuote(nodeScript)}`;

  return {
    bin: sshBin,
    args: [
      "-o", "BatchMode=yes",
      "-o", `ConnectTimeout=${sshConnectTimeout}`,
      ...sshExtraArgs,
      sshHost,
      remoteCommand,
    ],
  };
}

async function runClaudeRemote(prompt: string, timeoutMs: number): Promise<string> {
  const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const command = claudeCommand();
    const child = spawn(command.bin, command.args, {
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      reject(new Error("Claude remote call timed out."));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
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
        reject(new Error(`Claude remote exited with code ${code}. stderr: ${stderr.slice(0, 200)}`));
      }
    });
    child.stdin.end(prompt);
  });

  return `${stdout}\n${stderr}`;
}

async function buildClaudeImageQueries(title: string, description: string): Promise<string[]> {
  const prompt = [
    "Vytvoř rychlé anglické dotazy pro obrázkové vyhledávání thumbnailu.",
    "Nepředpokládej typ aktivity, cílovou skupinu, prostředí ani formát. Použij jen to, co přímo vyplývá z textu.",
    "Každý dotaz má popsat konkrétní vizuální scénu: hlavní činnost, místo, objekt, materiál, osobu, situaci nebo výsledek.",
    "U vícevýznamových slov použij význam podle kontextu popisu.",
    "Vrať pouze JSON pole 4 stringů. Bez markdownu a bez vysvětlení.",
    "",
    `Název: ${title || "(není zadán)"}`,
    `Popis: ${description || "(není zadán)"}`,
  ].join("\n");

  try {
    const text = await runClaudeRemote(prompt, CLAUDE_QUERY_TIMEOUT_MS);
    return extractImageQueries(text);
  } catch {
    return [];
  }
}

async function duckDuckGoVqd(query: string): Promise<string | null> {
  const pageUrl = `https://duckduckgo.com/?${new URLSearchParams({ q: query, iax: "images", ia: "images" })}`;
  const response = await fetch(pageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 svetoplavci-app/0.1" },
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
  if (
    text.includes("stock video") ||
    text.includes("free stock video") ||
    text.includes("fashion") ||
    text.includes("model photo")
  ) score -= 40;
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

async function findImageCandidates(title: string, description: string): Promise<ImageCandidate[]> {
  const claudeQueries = await buildClaudeImageQueries(title, description);
  const baseQueries = uniqueQueries([
    ...claudeQueries,
    ...fallbackQueries(title, description),
  ]).slice(0, FAST_SEARCH_QUERY_LIMIT);

  const results = await Promise.allSettled(baseQueries.map((query) => searchDuckDuckGoImages(query)));
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

  const candidates = await findImageCandidates(title, description);
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

  if (options.length === 0) {
    return NextResponse.json({ error: "Nepodařilo se najít použitelný obrázek." }, { status: 404 });
  }

  const body: ImageFindResponseBody = { options };
  findCache.set(cacheKey, { expiresAt: Date.now() + FIND_CACHE_TTL_MS, body });
  return NextResponse.json(body);
}
