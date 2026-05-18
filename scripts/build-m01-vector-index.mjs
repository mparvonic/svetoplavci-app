#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const DEFAULT_COLLECTION = "svetoplavci_m01_rvp_lodicky_v1";
const DEFAULT_CORPUS = "svetoplavci_m01_rvp_lodicky_v1";
const DEFAULT_QDRANT_URL = "http://127.0.0.1:6333";
const DEFAULT_DIMENSIONS = 384;
const DEFAULT_OUT_DIR = "/data/knowledge/projects/svetoplavci/m01-rvp-lodicky-v1";
const TOKEN_RE = /[\p{Letter}\p{Number}_-]+/gu;
const BATCH_SIZE = 128;

function parseArgs(argv) {
  const args = {
    collection: DEFAULT_COLLECTION,
    corpus: DEFAULT_CORPUS,
    qdrantUrl: process.env.QDRANT_URL ?? DEFAULT_QDRANT_URL,
    dimensions: DEFAULT_DIMENSIONS,
    out: DEFAULT_OUT_DIR,
    recreate: true,
    write: false,
    smoke: true,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };

    if (arg === "--collection") args.collection = next();
    else if (arg === "--corpus") args.corpus = next();
    else if (arg === "--qdrant-url") args.qdrantUrl = next().replace(/\/$/, "");
    else if (arg === "--dimensions") args.dimensions = Number.parseInt(next(), 10);
    else if (arg === "--out") args.out = next();
    else if (arg === "--no-recreate") args.recreate = false;
    else if (arg === "--write") args.write = true;
    else if (arg === "--dry-run") args.write = false;
    else if (arg === "--no-smoke") args.smoke = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(args.dimensions) || args.dimensions <= 0) throw new Error("--dimensions must be a positive integer");
  return args;
}

function usage() {
  return `Usage:
  npm run m01:vector:build -- --dry-run
  npm run m01:vector:build -- --write

Builds a rebuildable local Qdrant index from AppAiKnowledgeChunk plus RVP graph context points.
The baseline embedding is deterministic hashing (${DEFAULT_DIMENSIONS} dimensions), not a semantic model.
`;
}

function createDbClient() {
  const connectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing POSTGRES_PRISMA_URL or DATABASE_URL. Run through scripts/with-runtime-env.sh.");
  const shouldUseSsl = /sslmode=require/i.test(connectionString);
  return new Client({ connectionString, ssl: shouldUseSsl ? { rejectUnauthorized: false } : false });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function uuidFromSeed(seed) {
  const hex = sha256(seed).slice(0, 32).split("");
  hex[12] = "4";
  const variant = Number.parseInt(hex[16], 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function tokenize(text) {
  return [...String(text ?? "").matchAll(TOKEN_RE)].map((match) => match[0].toLowerCase());
}

function hashingVector(text, dimensions) {
  const vector = new Array(dimensions).fill(0);
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

function compact(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function payloadText(payload) {
  if (!payload || typeof payload !== "object") return "";
  const parts = [];
  if (payload.type === "lodicka") {
    parts.push(payload.predmet?.title, payload.oblast?.title, payload.podpredmet?.title);
    parts.push(...(payload.confirmedOvuCodes ?? []));
    parts.push(...(payload.grades ?? []).map((grade) => `${grade}. rocnik`));
  }
  if (payload.type === "rvp_ovu") {
    parts.push(payload.uzlovyBod?.code, payload.uzlovyBod?.title, payload.uzlovyBod?.grade ? `${payload.uzlovyBod.grade}. rocnik` : "");
    for (const values of Object.values(payload.verticalContext ?? {})) {
      if (Array.isArray(values)) parts.push(...values);
    }
    parts.push(...(payload.horizontalContext?.predchazejiciKody ?? []));
    parts.push(...(payload.horizontalContext?.souvisejiciKody ?? []));
    parts.push(...(payload.horizontalContext?.nasledujiciKody ?? []));
  }
  return parts.map(compact).filter(Boolean).join("\n");
}

function pointTypeForDomain(domain, payload) {
  if (payload?.type === "lodicka") return "lodicka";
  if (payload?.type === "rvp_ovu") return "rvp_ovu";
  return domain === "M01_LODICKA" ? "lodicka" : "rvp_ovu";
}

async function loadKnowledgePoints(client, corpus) {
  const result = await client.query(
    `
    SELECT
      item.id AS item_id,
      item.domain::text AS domain,
      item.source_table,
      item.source_id,
      item.source_code,
      item.source_version,
      item.title,
      item.structured_payload,
      item.content_hash AS item_content_hash,
      chunk.id AS chunk_id,
      chunk.chunk_index,
      chunk.chunk_text,
      chunk.content_hash AS chunk_content_hash
    FROM app_ai_knowledge_item item
    JOIN app_ai_knowledge_chunk chunk ON chunk.item_id = item.id
    WHERE item.is_active = true
      AND item.metadata->>'corpus' = $1
    ORDER BY item.domain::text, item.source_code NULLS LAST, chunk.chunk_index ASC
    `,
    [corpus],
  );

  return result.rows.map((row) => {
    const payload = row.structured_payload ?? {};
    const pointType = pointTypeForDomain(row.domain, payload);
    const codeBoost = [row.source_code, row.source_code, row.source_code].map(compact).filter(Boolean).join(" ");
    const text = [codeBoost, row.title, row.chunk_text, payloadText(payload)].map(compact).filter(Boolean).join("\n\n");
    return {
      id: uuidFromSeed(`chunk:${row.chunk_id}`),
      text,
      payload: {
        corpus,
        pointType,
        domain: row.domain,
        sourceTable: row.source_table,
        sourceId: row.source_id,
        sourceCode: row.source_code,
        sourceVersion: row.source_version,
        title: row.title,
        itemId: row.item_id,
        chunkId: row.chunk_id,
        chunkIndex: row.chunk_index,
        itemContentHash: row.item_content_hash,
        chunkContentHash: row.chunk_content_hash,
        rvpVersionId: payload.rvpVersionId ?? null,
        rvpDatasetVersion: payload.rvpDatasetVersion ?? null,
        svpVersionId: payload.svpVersionId ?? null,
        grades: payload.grades ?? (payload.uzlovyBod?.grade ? [payload.uzlovyBod.grade] : []),
        stage: payload.stage ?? payload.uzlovyBod?.stage ?? null,
        predmet: payload.predmet ?? null,
        oblast: payload.oblast ?? null,
        podpredmet: payload.podpredmet ?? null,
        ovuKod: pointType === "rvp_ovu" ? row.source_code : null,
        lodickaKod: pointType === "lodicka" ? row.source_code : null,
        confirmedOvuCodes: payload.confirmedOvuCodes ?? [],
        verticalContext: payload.verticalContext ?? null,
        uzlovyBod: payload.uzlovyBod ?? null,
        text: row.chunk_text,
      },
    };
  });
}

async function loadContextPoints(client, corpus, rvpVersionIds) {
  if (rvpVersionIds.length === 0) return [];
  const result = await client.query(
    `
    SELECT id, rvp_version_id, stable_key, entity_type, source_path, code, title, body_text, content_hash, structured_payload
    FROM app_m01_rvp_graph_node
    WHERE rvp_version_id = ANY($1::text[])
      AND entity_type IN (
        'vzdelavaciOblasti', 'vzdelavaciObory', 'tematickeOkruhy', 'uzlovyBod',
        'klicoveKompetence', 'slozkyKlicoveKompetence',
        'zakladniGramotnosti', 'slozkyZakladniGramotnosti',
        'prurezovaTemata'
      )
    ORDER BY entity_type, code NULLS LAST, title NULLS LAST
    `,
    [rvpVersionIds],
  );

  return result.rows.map((row) => {
    const title = [row.code, row.title].map(compact).filter(Boolean).join(" · ") || row.entity_type;
    const codeBoost = [row.code, row.code, row.code].map(compact).filter(Boolean).join(" ");
    const text = [codeBoost, `RVP kontext: ${title}`, `Typ: ${row.entity_type}`, row.body_text].map(compact).filter(Boolean).join("\n\n");
    return {
      id: uuidFromSeed(`context:${row.id}`),
      text,
      payload: {
        corpus,
        pointType: "rvp_context",
        domain: "M01_RVP_CONTEXT",
        sourceTable: "app_m01_rvp_graph_node",
        sourceId: row.id,
        sourceCode: row.code,
        sourceVersion: `rvp:${row.rvp_version_id}`,
        title,
        rvpVersionId: row.rvp_version_id,
        entityType: row.entity_type,
        sourcePath: row.source_path,
        stableKey: row.stable_key,
        contentHash: row.content_hash,
        structuredPayload: row.structured_payload,
        text,
      },
    };
  });
}

async function qdrantRequest(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    throw new Error(`Qdrant ${options.method ?? "GET"} ${pathname} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function recreateCollection(baseUrl, collection, dimensions) {
  await qdrantRequest(baseUrl, `/collections/${encodeURIComponent(collection)}`, { method: "DELETE" }).catch((error) => {
    if (!String(error.message).includes("404")) throw error;
  });
  await qdrantRequest(baseUrl, `/collections/${encodeURIComponent(collection)}`, {
    method: "PUT",
    body: JSON.stringify({ vectors: { size: dimensions, distance: "Cosine" } }),
  });
}

async function upsertPoints(baseUrl, collection, points, dimensions) {
  let written = 0;
  for (let index = 0; index < points.length; index += BATCH_SIZE) {
    const batch = points.slice(index, index + BATCH_SIZE).map((point) => ({
      id: point.id,
      vector: hashingVector(point.text, dimensions),
      payload: point.payload,
    }));
    await qdrantRequest(baseUrl, `/collections/${encodeURIComponent(collection)}/points?wait=true`, {
      method: "PUT",
      body: JSON.stringify({ points: batch }),
    });
    written += batch.length;
    console.log(`[m01:vector] indexed ${written}/${points.length} points`);
  }
}

async function searchQdrant(baseUrl, collection, query, dimensions, limit = 5, filter = null) {
  const body = await qdrantRequest(baseUrl, `/collections/${encodeURIComponent(collection)}/points/search`, {
    method: "POST",
    body: JSON.stringify({ vector: hashingVector(query, dimensions), limit, with_payload: true, ...(filter ? { filter } : {}) }),
  });
  return body?.result ?? [];
}

function buildSmokeQueries(points) {
  const lodicka = points.find((point) => point.payload.pointType === "lodicka" && point.payload.confirmedOvuCodes?.length > 0);
  const ovu = points.find((point) => point.payload.pointType === "rvp_ovu" && point.payload.grades?.length > 0);
  const context = points.find((point) => point.payload.pointType === "rvp_context" && point.payload.entityType === "vzdelavaciOblasti");
  return [
    lodicka ? {
      name: `Hard-link recall ${lodicka.payload.sourceCode}`,
      query: `${lodicka.payload.title} ${lodicka.payload.confirmedOvuCodes.join(" ")}`,
      filter: { must: [{ key: "pointType", match: { value: "rvp_ovu" } }] },
    } : null,
    ovu ? {
      name: `Grade OVU ${ovu.payload.sourceCode}`,
      query: `${ovu.payload.grades.join(" ")} rocnik ${ovu.payload.sourceCode} ${ovu.payload.title}`,
      filter: { must: [{ key: "pointType", match: { value: "rvp_ovu" } }] },
    } : null,
    context ? {
      name: `RVP context ${context.payload.title}`,
      query: `${context.payload.title} ${context.payload.entityType}`,
      filter: { must: [{ key: "pointType", match: { value: "rvp_context" } }] },
    } : null,
  ].filter(Boolean);
}

async function writeArtifacts(outDir, manifest, smokeResults) {
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "vector_index_manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const smokeMarkdown = `# Vector retrieval smoke: ${manifest.collection}\n\n` +
    `- Generated at: ${manifest.generatedAt}\n` +
    `- Embedding: ${manifest.embedding.provider}/${manifest.embedding.model}\n` +
    `- Dimensions: ${manifest.embedding.dimensions}\n` +
    `- Qdrant URL: ${manifest.qdrant.url}\n\n` +
    smokeResults.map((item, index) => {
      const rows = item.results.map((result, resultIndex) => (
        `${resultIndex + 1}. score=${Number(result.score).toFixed(4)} ` +
        `${result.payload?.pointType ?? "?"} ` +
        `${result.payload?.sourceCode ?? result.payload?.title ?? "?"} ` +
        `${result.payload?.title ?? ""}`
      )).join("\n");
      const filterText = item.filter ? `\nFilter: ${JSON.stringify(item.filter)}\n` : "";
      return `## ${index + 1}. ${item.name}\n\nQuery: ${item.query}${filterText}\n${rows || "No results"}\n`;
    }).join("\n");
  await writeFile(path.join(outDir, "vector_retrieval_smoke.md"), smokeMarkdown, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const client = createDbClient();
  await client.connect();
  try {
    const knowledgePoints = await loadKnowledgePoints(client, args.corpus);
    const rvpVersionIds = [...new Set(knowledgePoints.map((point) => point.payload.rvpVersionId).filter(Boolean))];
    const contextPoints = await loadContextPoints(client, args.corpus, rvpVersionIds);
    const points = [...knowledgePoints, ...contextPoints];
    const pointTypeCounts = points.reduce((acc, point) => {
      acc[point.payload.pointType] = (acc[point.payload.pointType] ?? 0) + 1;
      return acc;
    }, {});
    const generatedAt = new Date().toISOString();
    const outDir = path.join(args.out, `qdrant-${args.collection}`);
    const manifest = {
      collection: args.collection,
      corpus: args.corpus,
      generatedAt,
      mode: args.write ? "write" : "dry-run",
      embedding: {
        provider: "local",
        model: "deterministic-hashing-v1",
        dimensions: args.dimensions,
        semantic: false,
      },
      qdrant: {
        url: args.qdrantUrl,
        recreate: args.recreate,
      },
      counts: {
        points: points.length,
        knowledgeChunkPoints: knowledgePoints.length,
        contextPoints: contextPoints.length,
        pointTypes: pointTypeCounts,
      },
      hashes: {
        indexSourceHash: sha256(points.map((point) => `${point.id}:${point.payload.chunkContentHash ?? point.payload.contentHash ?? ""}`).sort().join("\n")),
      },
    };

    let smokeResults = [];
    if (args.write) {
      await qdrantRequest(args.qdrantUrl, "/collections");
      if (args.recreate) await recreateCollection(args.qdrantUrl, args.collection, args.dimensions);
      await upsertPoints(args.qdrantUrl, args.collection, points, args.dimensions);
      if (args.smoke) {
        const queries = buildSmokeQueries(points);
        smokeResults = [];
        for (const query of queries) {
          const results = await searchQdrant(args.qdrantUrl, args.collection, query.query, args.dimensions, 5, query.filter ?? null);
          smokeResults.push({ ...query, results });
        }
      }
    }

    await writeArtifacts(outDir, manifest, smokeResults);
    console.log(JSON.stringify({ ok: true, ...manifest, artifacts: outDir }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
