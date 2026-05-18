import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";

const DEFAULT_COLLECTION = "svetoplavci_m01_rvp_lodicky_v1";
const DEFAULT_CORPUS = "svetoplavci_m01_rvp_lodicky_v1";
const DEFAULT_QDRANT_URL = "http://127.0.0.1:6333";
const DEFAULT_DIMENSIONS = 384;
const TOKEN_RE = /[\p{Letter}\p{Number}_-]+/gu;

type KnowledgeRow = {
  itemId: string;
  sourceId: string;
  sourceCode: string | null;
  title: string | null;
  bodyText: string;
  structuredPayload: Prisma.JsonValue | null;
  chunkText: string;
};

type QdrantResult = {
  id: string;
  score: number;
  payload?: Record<string, unknown>;
};

export type M01SemanticCandidate = {
  pointId: string;
  score: number;
  sourceCode: string | null;
  title: string;
  text: string;
  alreadyConfirmed: boolean;
  grades: number[];
  stage: string | null;
  contextTitle: string | null;
  verticalContext: Record<string, unknown> | null;
};

export type M01SemanticSearchResult = {
  collection: string;
  corpus: string;
  embedding: {
    provider: "local";
    model: "deterministic-hashing-v1";
    dimensions: number;
    semantic: false;
  };
  lodicka: {
    id: string;
    code: string | null;
    title: string;
    confirmedOvuCodes: string[];
  };
  candidates: M01SemanticCandidate[];
};

function compact(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function tokenize(text: string) {
  return [...String(text ?? "").matchAll(TOKEN_RE)].map((match) => match[0].toLowerCase());
}

function hashingVector(text: string, dimensions: number) {
  const vector = new Array<number>(dimensions).fill(0);
  for (const token of tokenize(text)) {
    const digest = createHash("blake2b512").update(token).digest();
    const bucket = digest.readUInt32BE(0) % dimensions;
    const sign = (digest[4] & 1) === 1 ? 1 : -1;
    vector[bucket] += sign;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

function asRecord(value: Prisma.JsonValue | unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : [];
}

function payloadText(payload: Record<string, unknown>) {
  const parts: string[] = [];
  const predmet = asRecord(payload.predmet);
  const oblast = asRecord(payload.oblast);
  const podpredmet = asRecord(payload.podpredmet);
  parts.push(compact(predmet.title), compact(oblast.title), compact(podpredmet.title));
  parts.push(...asStringArray(payload.confirmedOvuCodes));
  parts.push(...asNumberArray(payload.grades).map((grade) => `${grade}. rocnik`));
  return parts.filter(Boolean).join("\n");
}

function qdrantUrl() {
  return (process.env.QDRANT_URL ?? DEFAULT_QDRANT_URL).replace(/\/$/, "");
}

async function qdrantSearch(collection: string, query: string, limit: number, rvpVersionId: string | null) {
  const filterMust: unknown[] = [{ key: "pointType", match: { value: "rvp_ovu" } }];
  if (rvpVersionId) filterMust.push({ key: "rvpVersionId", match: { value: rvpVersionId } });

  const response = await fetch(`${qdrantUrl()}/collections/${encodeURIComponent(collection)}/points/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      vector: hashingVector(query, DEFAULT_DIMENSIONS),
      limit,
      with_payload: true,
      filter: { must: filterMust },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Qdrant search failed: ${response.status} ${detail}`.trim());
  }
  const body = await response.json() as { result?: QdrantResult[] };
  return body.result ?? [];
}

export async function searchM01SemanticOvuCandidates({
  lodickaId,
  collection = DEFAULT_COLLECTION,
  corpus = DEFAULT_CORPUS,
  limit = 12,
}: {
  lodickaId: string;
  collection?: string;
  corpus?: string;
  limit?: number;
}): Promise<M01SemanticSearchResult | null> {
  const rows = await prisma.$queryRaw<KnowledgeRow[]>`
    SELECT
      item.id AS "itemId",
      item.source_id AS "sourceId",
      item.source_code AS "sourceCode",
      item.title,
      item.body_text AS "bodyText",
      item.structured_payload AS "structuredPayload",
      string_agg(chunk.chunk_text, E'\n\n' ORDER BY chunk.chunk_index) AS "chunkText"
    FROM app_ai_knowledge_item item
    JOIN app_ai_knowledge_chunk chunk ON chunk.item_id = item.id
    WHERE item.is_active = true
      AND item.metadata->>'corpus' = ${corpus}
      AND item.source_table = 'app_m01_lodicka'
      AND item.source_id = ${lodickaId}
    GROUP BY item.id, item.source_id, item.source_code, item.title, item.body_text, item.structured_payload
    LIMIT 1
  `;

  const lodicka = rows[0];
  if (!lodicka) return null;

  const payload = asRecord(lodicka.structuredPayload);
  const confirmedOvuCodes = asStringArray(payload.confirmedOvuCodes);
  const query = [
    lodicka.sourceCode,
    lodicka.sourceCode,
    lodicka.title,
    lodicka.bodyText,
    lodicka.chunkText,
    payloadText(payload),
  ].map(compact).filter(Boolean).join("\n\n");
  const rvpVersionId = typeof payload.rvpVersionId === "string" ? payload.rvpVersionId : null;
  const confirmed = new Set(confirmedOvuCodes);

  const results = await qdrantSearch(collection, query, Math.max(limit * 3, 24), rvpVersionId);
  const candidates = results
    .map((result) => {
      const resultPayload = result.payload ?? {};
      const sourceCode = typeof resultPayload.sourceCode === "string" ? resultPayload.sourceCode : null;
      const uzlovyBod = asRecord(resultPayload.uzlovyBod);
      const contextTitle = [compact(uzlovyBod.code), compact(uzlovyBod.title)].filter(Boolean).join(" · ") || null;
      return {
        pointId: result.id,
        score: result.score,
        sourceCode,
        title: compact(resultPayload.title) || sourceCode || "OVU",
        text: compact(resultPayload.text),
        alreadyConfirmed: sourceCode ? confirmed.has(sourceCode) : false,
        grades: asNumberArray(resultPayload.grades),
        stage: typeof resultPayload.stage === "string" ? resultPayload.stage : null,
        contextTitle,
        verticalContext: asRecord(resultPayload.verticalContext),
      } satisfies M01SemanticCandidate;
    })
    .filter((candidate, index, all) => all.findIndex((item) => item.sourceCode === candidate.sourceCode) === index)
    .filter((candidate) => !candidate.alreadyConfirmed)
    .slice(0, limit);

  return {
    collection,
    corpus,
    embedding: {
      provider: "local",
      model: "deterministic-hashing-v1",
      dimensions: DEFAULT_DIMENSIONS,
      semantic: false,
    },
    lodicka: {
      id: lodicka.sourceId,
      code: lodicka.sourceCode,
      title: lodicka.title ?? lodicka.sourceCode ?? lodicka.sourceId,
      confirmedOvuCodes,
    },
    candidates,
  };
}
