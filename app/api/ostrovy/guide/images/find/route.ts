import { NextRequest, NextResponse } from "next/server";

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
const FIND_CACHE_VERSION = "open-visual-intent-v4";

// claude-proxy on gx10: small HTTP server that adds ANTHROPIC_API_KEY and forwards to Anthropic.
// Set CLAUDE_PROXY_URL=http://gx10:3199 (or via VPN address) in the app's env.
// Fallback: direct Anthropic API using ANTHROPIC_API_KEY on the app server itself.
const CLAUDE_PROXY_URL = process.env.CLAUDE_PROXY_URL?.replace(/\/$/, "") ?? "";

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
        if (escaped) { escaped = false; }
        else if (char === "\\") { escaped = true; }
        else if (char === "\"") { inString = false; }
        continue;
      }
      if (char === "\"") { inString = true; continue; }
      if (char === "[") depth += 1;
      if (char === "]") depth -= 1;
      if (depth === 0) {
        try { arrays.push(JSON.parse(text.slice(start, index + 1))); start = index; } catch { /* ignore */ }
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
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
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

/**
 * Calls Claude via:
 *  1. CLAUDE_PROXY_URL  — HTTP proxy on gx10 (key stays on gx10, traffic over VPN)
 *  2. ANTHROPIC_API_KEY — direct Anthropic API (dev / fallback)
 *
 * Proxy protocol: POST /query  { prompt: string, model?: string, max_tokens?: number }
 *                 → { text: string }
 */
async function callClaude(prompt: string, maxTokens: number, timeoutMs: number): Promise<string> {
  const model = process.env.CLAUDE_IMAGE_MODEL?.trim() || "claude-haiku-4-5-20251001";

  if (CLAUDE_PROXY_URL) {
    const res = await fetch(`${CLAUDE_PROXY_URL}/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, model, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`Claude proxy error ${res.status}`);
    const data = await res.json() as { text?: string };
    return data.text ?? "";
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("Neither CLAUDE_PROXY_URL nor ANTHROPIC_API_KEY is configured.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}`);
  const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
  return data.content?.find((b) => b.type === "text")?.text ?? "";
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
    return extractImageQueries(await callClaude(prompt, 256, CLAUDE_QUERY_TIMEOUT_MS));
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
    text.includes("stock video") || text.includes("free stock video") ||
    text.includes("fashion") || text.includes("model photo")
  ) score -= 40;
  if (candidate.previewUrl) score += 5;
  return score;
}

async function searchDuckDuckGoImages(query: string): Promise<ImageCandidate[]> {
  const vqd = await duckDuckGoVqd(query);
  if (!vqd) return [];

  const params = new URLSearchParams({ l: "us-en", o: "json", q: query, vqd, f: ",,,", p: "1" });
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
  return candidates.sort((a, b) => sourceScore(b) - sourceScore(a)).slice(0, MAX_IMAGE_OPTIONS);
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
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.body);

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
