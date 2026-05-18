#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const BATCH_SIZE = 250;

function parseArgs(argv) {
  const args = {
    input: null,
    replace: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };

    if (arg === "--input") args.input = next();
    else if (arg === "--replace") args.replace = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return `Usage:
  npm run rvp:graph:backfill -- --input .tmp/rvp-normalized/2025-06-24 --replace
  npm run rvp:graph:backfill -- --input .tmp/rvp-normalized/2025-06-24 --dry-run

Project DB scripts source ./.env.local first, then /data/projects/svetoplavci-app/secrets/env.local through scripts/with-runtime-env.sh.
The target M01RvpVersion must already exist. This script only writes derived graph nodes/edges.
`;
}

function createDbClient() {
  const connectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing POSTGRES_PRISMA_URL or DATABASE_URL. Run through scripts/with-runtime-env.sh, source ./.env.local or /data/projects/svetoplavci-app/secrets/env.local first, or provide the variable.");
  }

  const shouldUseSsl = /sslmode=require/i.test(connectionString);
  return new Client({
    connectionString,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5_000,
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await readFile(filePath, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function chunks(rows, size) {
  const result = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
}

function jsonOrNull(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

async function findRvpVersion(client, manifest) {
  const result = await client.query(
    `
    SELECT id, dataset_version, source_format, source_hash
    FROM app_m01_rvp_version
    WHERE dataset_version = $1
      AND source_format = $2
    LIMIT 1
    `,
    [manifest.datasetVersion, manifest.sourceFormat],
  );
  return result.rows[0] ?? null;
}

async function ensureGraphProjectionTables(client) {
  const result = await client.query(
    `
    SELECT
      to_regclass('public.app_m01_rvp_graph_node') AS graph_node,
      to_regclass('public.app_m01_rvp_graph_edge') AS graph_edge
    `,
  );
  const row = result.rows[0] ?? {};
  if (!row.graph_node || !row.graph_edge) {
    throw new Error(
      'Missing RVP graph projection tables. Apply Prisma migration 20260514160000_m01_rvp_graph_projection before running the backfill.',
    );
  }
}

async function getExistingCount(client, rvpVersionId) {
  const result = await client.query(
    `
    SELECT
      (SELECT count(*)::int FROM app_m01_rvp_graph_node WHERE rvp_version_id = $1) AS nodes,
      (SELECT count(*)::int FROM app_m01_rvp_graph_edge WHERE rvp_version_id = $1) AS edges
    `,
    [rvpVersionId],
  );
  return result.rows[0] ?? { nodes: 0, edges: 0 };
}

async function loadOvuIds(client, rvpVersionId) {
  const result = await client.query(
    `
    SELECT id, kod
    FROM app_m01_rvp_ovu
    WHERE rvp_version_id = $1
    `,
    [rvpVersionId],
  );
  return new Map(result.rows.map((row) => [String(row.kod), String(row.id)]));
}

function prepareNodes(entities, rvpVersionId, ovuIdsByCode) {
  return entities.map((entity) => {
    const sourceId = entity.entityType === "ovu" && entity.code ? (ovuIdsByCode.get(entity.code) ?? null) : (entity.sourceId ?? null);
    return {
      id: randomUUID(),
      rvpVersionId,
      stableKey: entity.stableKey,
      entityType: entity.entityType,
      sourcePath: entity.sourcePath,
      code: entity.code ?? null,
      title: entity.title ?? null,
      bodyText: entity.bodyText ?? null,
      sourceTable: entity.sourceTable ?? null,
      sourceId,
      sourceLookup: entity.sourceLookup ?? null,
      metadata: entity.metadata ?? {},
      structuredPayload: entity.structuredPayload ?? {},
      contentHash: entity.contentHash ?? null,
      structureHash: entity.structureHash ?? null,
    };
  });
}

function prepareEdges(edges, rvpVersionId, nodeIdsByStableKey) {
  return edges.map((edge) => ({
    id: randomUUID(),
    rvpVersionId,
    stableKey: edge.stableKey,
    edgeType: edge.edgeType,
    fromNodeId: nodeIdsByStableKey.get(edge.fromStableKey) ?? null,
    toNodeId: nodeIdsByStableKey.get(edge.toStableKey) ?? null,
    fromStableKey: edge.fromStableKey,
    toStableKey: edge.toStableKey,
    targetCode: edge.targetCode ?? null,
    targetExists: edge.targetExists ?? true,
    metadata: edge.metadata ?? {},
  }));
}

async function insertNodes(client, nodes) {
  for (const batch of chunks(nodes, BATCH_SIZE)) {
    const values = [];
    const placeholders = batch.map((node, index) => {
      const offset = index * 16;
      values.push(
        node.id,
        node.rvpVersionId,
        node.stableKey,
        node.entityType,
        node.sourcePath,
        node.code,
        node.title,
        node.bodyText,
        node.sourceTable,
        node.sourceId,
        jsonOrNull(node.sourceLookup),
        jsonOrNull(node.metadata),
        jsonOrNull(node.structuredPayload),
        node.contentHash,
        node.structureHash,
        new Date(),
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}::jsonb, $${offset + 12}::jsonb, $${offset + 13}::jsonb, $${offset + 14}, $${offset + 15}, $${offset + 16})`;
    });

    await client.query(
      `
      INSERT INTO app_m01_rvp_graph_node (
        id, rvp_version_id, stable_key, entity_type, source_path, code, title, body_text,
        source_table, source_id, source_lookup, metadata, structured_payload,
        content_hash, structure_hash, updated_at
      ) VALUES ${placeholders.join(", ")}
      `,
      values,
    );
  }
}

async function insertEdges(client, edges) {
  for (const batch of chunks(edges, BATCH_SIZE)) {
    const values = [];
    const placeholders = batch.map((edge, index) => {
      const offset = index * 12;
      values.push(
        edge.id,
        edge.rvpVersionId,
        edge.stableKey,
        edge.edgeType,
        edge.fromNodeId,
        edge.toNodeId,
        edge.fromStableKey,
        edge.toStableKey,
        edge.targetCode,
        edge.targetExists,
        jsonOrNull(edge.metadata),
        new Date(),
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}::jsonb, $${offset + 12})`;
    });

    await client.query(
      `
      INSERT INTO app_m01_rvp_graph_edge (
        id, rvp_version_id, stable_key, edge_type, from_node_id, to_node_id,
        from_stable_key, to_stable_key, target_code, target_exists, metadata, updated_at
      ) VALUES ${placeholders.join(", ")}
      `,
      values,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.input) throw new Error("--input is required.");

  const inputDir = path.resolve(args.input);
  const [manifest, entities, edges] = await Promise.all([
    readJson(path.join(inputDir, "manifest.json")),
    readJsonl(path.join(inputDir, "entities.jsonl")),
    readJsonl(path.join(inputDir, "edges.jsonl")),
  ]);

  const client = createDbClient();
  await client.connect();
  try {
    const rvpVersion = await findRvpVersion(client, manifest);
    if (!rvpVersion) {
      throw new Error(`No M01RvpVersion found for datasetVersion=${manifest.datasetVersion}, sourceFormat=${manifest.sourceFormat}. Import the RVP version first.`);
    }

    await ensureGraphProjectionTables(client);
    const existing = await getExistingCount(client, rvpVersion.id);
    const ovuIdsByCode = await loadOvuIds(client, rvpVersion.id);
    const nodes = prepareNodes(entities, rvpVersion.id, ovuIdsByCode);
    const nodeIdsByStableKey = new Map(nodes.map((node) => [node.stableKey, node.id]));
    const preparedEdges = prepareEdges(edges, rvpVersion.id, nodeIdsByStableKey);
    const unresolvedOvu = nodes.filter((node) => node.entityType === "ovu" && !node.sourceId).map((node) => node.code);
    const unresolvedFromNodes = preparedEdges.filter((edge) => !edge.fromNodeId).length;
    const unresolvedToNodes = preparedEdges.filter((edge) => edge.targetExists && !edge.toNodeId).length;

    const summary = {
      datasetVersion: manifest.datasetVersion,
      rvpVersionId: rvpVersion.id,
      dryRun: args.dryRun,
      replace: args.replace,
      existing,
      prepared: {
        nodes: nodes.length,
        edges: preparedEdges.length,
        ovuNodes: nodes.filter((node) => node.entityType === "ovu").length,
        resolvedOvuSourceIds: nodes.filter((node) => node.entityType === "ovu" && node.sourceId).length,
        unresolvedOvuSourceIds: unresolvedOvu.length,
        unresolvedFromNodes,
        unresolvedToNodes,
      },
      unresolvedOvu: unresolvedOvu.slice(0, 50),
    };

    if (args.dryRun) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    if ((existing.nodes > 0 || existing.edges > 0) && !args.replace) {
      throw new Error(`Graph projection already exists for ${manifest.datasetVersion} (${existing.nodes} nodes, ${existing.edges} edges). Re-run with --replace to rebuild it.`);
    }

    await client.query("BEGIN");
    await client.query("DELETE FROM app_m01_rvp_graph_edge WHERE rvp_version_id = $1", [rvpVersion.id]);
    await client.query("DELETE FROM app_m01_rvp_graph_node WHERE rvp_version_id = $1", [rvpVersion.id]);
    await insertNodes(client, nodes);
    await insertEdges(client, preparedEdges);
    await client.query("COMMIT");

    console.log(JSON.stringify({ ...summary, inserted: { nodes: nodes.length, edges: preparedEdges.length } }, null, 2));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors when no transaction is active.
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  if (error instanceof Error) console.error(`[rvp:graph:backfill] Failed: ${error.message}`);
  else console.error("[rvp:graph:backfill] Failed:", error);
  process.exit(1);
});
