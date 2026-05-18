#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const DEFAULT_OUT_DIR = "/data/knowledge/projects/svetoplavci/m01-rvp-lodicky-v1";
const CHUNK_TARGET_CHARS = 3200;

function parseArgs(argv) {
  const args = {
    svp: null,
    out: DEFAULT_OUT_DIR,
    write: false,
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

    if (arg === "--svp") args.svp = next();
    else if (arg === "--out") args.out = next();
    else if (arg === "--write") args.write = true;
    else if (arg === "--dry-run") args.write = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return `Usage:
  npm run m01:knowledge:build -- --dry-run
  npm run m01:knowledge:build -- --write
  npm run m01:knowledge:build -- --svp <M01SvpVersion.id> --write

Builds a transparent M01 RVP/lodicky knowledge corpus into AppAiKnowledgeItem and AppAiKnowledgeChunk.
No embeddings and no Qdrant writes happen in this step.
Artifacts are written to ${DEFAULT_OUT_DIR} by default.
`;
}

function createDbClient() {
  const connectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing POSTGRES_PRISMA_URL or DATABASE_URL. Run through scripts/with-runtime-env.sh.");
  }
  const shouldUseSsl = /sslmode=require/i.test(connectionString);
  return new Client({ connectionString, ssl: shouldUseSsl ? { rejectUnauthorized: false } : false });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function compact(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function arrayText(items, fallback = "neuvedeno") {
  const values = items.map((item) => compact(item)).filter(Boolean);
  return values.length ? values.join("; ") : fallback;
}

function nodeText(node) {
  return [node.code, node.title].map(compact).filter(Boolean).join(" · ") || compact(node.body_text) || "bez nazvu";
}

function gradeRange(from, to) {
  if (!from && !to) return [];
  const start = Number(from ?? to);
  const end = Number(to ?? from);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const result = [];
  for (let grade = start; grade <= end; grade += 1) result.push(grade);
  return result;
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function chunkText(text) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }
    if ((current.length + paragraph.length + 2) > CHUNK_TARGET_CHARS) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = `${current}\n\n${paragraph}`;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text];
}

function sourceVersion(prefix, id, label) {
  return `${prefix}:${id}:${label}`;
}

async function selectSvp(client, requestedId) {
  const params = [];
  let where = "";
  if (requestedId) {
    params.push(requestedId);
    where = "WHERE svp.id = $1";
  }
  const result = await client.query(
    `
    SELECT
      svp.id,
      svp.label,
      svp.status::text AS status,
      svp.is_current,
      svp.effective_from,
      svp.effective_to,
      svp.based_on_rvp_version_id,
      rvp.dataset_version AS rvp_dataset_version,
      rvp.source_format AS rvp_source_format,
      rvp.source_url AS rvp_source_url,
      rvp.source_hash AS rvp_source_hash
    FROM app_m01_svp_version svp
    JOIN app_m01_rvp_version rvp ON rvp.id = svp.based_on_rvp_version_id
    ${where}
    ORDER BY svp.is_current DESC, svp.effective_from DESC, svp.major DESC, svp.minor DESC
    LIMIT 1
    `,
    params,
  );
  const svp = result.rows[0];
  if (!svp) throw new Error(requestedId ? `M01SvpVersion not found: ${requestedId}` : "No M01SvpVersion found.");
  return svp;
}

async function loadOvuRows(client, rvpVersionId) {
  const result = await client.query(
    `
    SELECT
      o.id,
      o.kod,
      o.zneni,
      o.popis_a_zduvodneni,
      o.hodnoty,
      o.predchazejici_kody,
      o.souvisejici_kody,
      o.nasledujici_kody,
      o.metodicka_podpora,
      o.source_branch,
      o.source_path,
      ub.id AS uzlovy_bod_id,
      ub.kod AS uzlovy_bod_kod,
      ub.nazev AS uzlovy_bod_nazev,
      ub.grade_num,
      ub.stage_code,
      node.id AS graph_node_id
    FROM app_m01_rvp_ovu o
    LEFT JOIN app_m01_rvp_uzlovy_bod ub ON ub.id = o.uzlovy_bod_id
    LEFT JOIN app_m01_rvp_graph_node node ON node.rvp_version_id = o.rvp_version_id
      AND node.source_table = 'app_m01_rvp_ovu'
      AND node.source_id = o.id
    WHERE o.rvp_version_id = $1
    ORDER BY o.kod ASC
    `,
    [rvpVersionId],
  );
  return result.rows;
}

async function loadOvuContexts(client, rvpVersionId) {
  const result = await client.query(
    `
    WITH RECURSIVE ancestors AS (
      SELECT
        o.id AS ovu_id,
        node.id AS graph_node_id,
        parent.id,
        parent.entity_type,
        parent.code,
        parent.title,
        parent.body_text,
        1::int AS depth,
        ARRAY[node.id, parent.id] AS path
      FROM app_m01_rvp_ovu o
      JOIN app_m01_rvp_graph_node node ON node.rvp_version_id = o.rvp_version_id
        AND node.source_table = 'app_m01_rvp_ovu'
        AND node.source_id = o.id
      JOIN app_m01_rvp_graph_edge edge ON edge.to_node_id = node.id
        AND edge.edge_type = 'contains'
      JOIN app_m01_rvp_graph_node parent ON parent.id = edge.from_node_id
      WHERE o.rvp_version_id = $1

      UNION ALL

      SELECT
        ancestors.ovu_id,
        ancestors.graph_node_id,
        parent.id,
        parent.entity_type,
        parent.code,
        parent.title,
        parent.body_text,
        ancestors.depth + 1 AS depth,
        ancestors.path || parent.id
      FROM ancestors
      JOIN app_m01_rvp_graph_edge edge ON edge.to_node_id = ancestors.id
        AND edge.edge_type = 'contains'
      JOIN app_m01_rvp_graph_node parent ON parent.id = edge.from_node_id
      WHERE ancestors.depth < 10
        AND NOT parent.id = ANY(ancestors.path)
    )
    SELECT DISTINCT ovu_id, id, entity_type, code, title, body_text, depth
    FROM ancestors
    ORDER BY ovu_id, depth DESC, entity_type, code NULLS LAST, title NULLS LAST
    `,
    [rvpVersionId],
  );

  const byOvu = new Map();
  for (const row of result.rows) {
    const group = byOvu.get(row.ovu_id) ?? [];
    group.push(row);
    byOvu.set(row.ovu_id, group);
  }
  return byOvu;
}

async function loadMethodSupport(client, rvpVersionId) {
  const result = await client.query(
    `
    SELECT
      o.id AS ovu_id,
      method_node.code,
      method_node.title,
      method_node.body_text
    FROM app_m01_rvp_ovu o
    JOIN app_m01_rvp_graph_node node ON node.rvp_version_id = o.rvp_version_id
      AND node.source_table = 'app_m01_rvp_ovu'
      AND node.source_id = o.id
    JOIN app_m01_rvp_graph_edge method_edge ON method_edge.from_node_id = node.id
      AND method_edge.edge_type = 'has_method_level'
    JOIN app_m01_rvp_graph_node method_node ON method_node.id = method_edge.to_node_id
    WHERE o.rvp_version_id = $1
    ORDER BY o.kod ASC, method_node.code NULLS LAST, method_node.title NULLS LAST
    `,
    [rvpVersionId],
  );
  const byOvu = new Map();
  for (const row of result.rows) {
    const group = byOvu.get(row.ovu_id) ?? [];
    group.push(row);
    byOvu.set(row.ovu_id, group);
  }
  return byOvu;
}

async function loadLodicky(client, svpVersionId) {
  const result = await client.query(
    `
    SELECT
      l.id,
      l.kod,
      l.nazev,
      l.zkraceny_nazev,
      l.popis,
      l.typ::text AS typ,
      l.rocnik_od,
      l.rocnik_do,
      l.stupen::text AS stupen,
      pr.kod AS predmet_kod,
      pr.nazev AS predmet_nazev,
      pp.kod AS podpredmet_kod,
      pp.nazev AS podpredmet_nazev,
      ob.kod AS oblast_kod,
      ob.nazev AS oblast_nazev
    FROM app_m01_lodicka l
    JOIN app_m01_predmet pr ON pr.id = l.predmet_id
    LEFT JOIN app_m01_podpredmet pp ON pp.id = l.podpredmet_id
    JOIN app_m01_oblast ob ON ob.id = l.oblast_id
    WHERE l.svp_version_id = $1
      AND l.is_deleted = false
    ORDER BY l.kod ASC
    `,
    [svpVersionId],
  );
  return result.rows;
}

async function loadLodickaOvuLinks(client, svpVersionId) {
  const result = await client.query(
    `
    SELECT
      l.id AS lodicka_id,
      o.id AS ovu_id,
      o.kod AS ovu_kod,
      o.zneni AS ovu_zneni,
      link.is_primary
    FROM app_m01_lodicka l
    JOIN app_m01_lodicka_ovu_link link ON link.lodicka_id = l.id
    JOIN app_m01_rvp_ovu o ON o.id = link.rvp_ovu_id
    WHERE l.svp_version_id = $1
      AND l.is_deleted = false
    ORDER BY l.kod ASC, o.kod ASC
    `,
    [svpVersionId],
  );
  const byLodicka = new Map();
  for (const row of result.rows) {
    const group = byLodicka.get(row.lodicka_id) ?? [];
    group.push(row);
    byLodicka.set(row.lodicka_id, group);
  }
  return byLodicka;
}

function contextsByType(contextRows) {
  const byType = new Map();
  for (const row of contextRows) {
    const group = byType.get(row.entity_type) ?? [];
    group.push(row);
    byType.set(row.entity_type, uniqueBy(group, (item) => item.id));
  }
  return byType;
}

function buildOvuItem(row, svp, contextRows, methodRows) {
  const byType = contextsByType(contextRows);
  const get = (type) => (byType.get(type) ?? []).map(nodeText);
  const methodSupport = methodRows.map((item) => [item.code, item.title, item.body_text].map(compact).filter(Boolean).join(" · ")).filter(Boolean);
  const uzlovyBod = [row.uzlovy_bod_kod, row.uzlovy_bod_nazev].map(compact).filter(Boolean).join(" · ");
  const payload = {
    type: "rvp_ovu",
    rvpVersionId: svp.based_on_rvp_version_id,
    rvpDatasetVersion: svp.rvp_dataset_version,
    svpVersionId: svp.id,
    code: row.kod,
    sourcePath: row.source_path,
    sourceBranch: row.source_branch,
    uzlovyBod: {
      id: row.uzlovy_bod_id,
      code: row.uzlovy_bod_kod,
      title: row.uzlovy_bod_nazev,
      grade: row.grade_num,
      stage: row.stage_code,
    },
    verticalContext: {
      vzdelavaciOblasti: get("vzdelavaciOblasti"),
      vzdelavaciObory: get("vzdelavaciObory"),
      tematickeOkruhy: get("tematickeOkruhy"),
      klicoveKompetence: get("klicoveKompetence"),
      slozkyKlicoveKompetence: get("slozkyKlicoveKompetence"),
      zakladniGramotnosti: get("zakladniGramotnosti"),
      slozkyZakladniGramotnosti: get("slozkyZakladniGramotnosti"),
      prurezovaTemata: get("prurezovaTemata"),
    },
    horizontalContext: {
      predchazejiciKody: row.predchazejici_kody ?? [],
      souvisejiciKody: row.souvisejici_kody ?? [],
      nasledujiciKody: row.nasledujici_kody ?? [],
    },
    methodSupportCount: methodSupport.length,
  };

  const body = [
    `OVU ${row.kod}`,
    `Zneni: ${row.zneni}`,
    row.popis_a_zduvodneni ? `Popis a zduvodneni: ${row.popis_a_zduvodneni}` : "",
    `Uzlovy bod: ${uzlovyBod || "neuvedeno"}`,
    `Rocnik/stupen: ${[row.grade_num ? `${row.grade_num}. rocnik` : "", row.stage_code].filter(Boolean).join(" · ") || "neuvedeno"}`,
    `Vzdelavaci oblasti: ${arrayText(get("vzdelavaciOblasti"))}`,
    `Vzdelavaci obory: ${arrayText(get("vzdelavaciObory"))}`,
    `Tematicke okruhy: ${arrayText(get("tematickeOkruhy"))}`,
    `Klicove kompetence: ${arrayText(get("klicoveKompetence"))}`,
    `Slozky klicovych kompetenci: ${arrayText(get("slozkyKlicoveKompetence"))}`,
    `Zakladni gramotnosti: ${arrayText(get("zakladniGramotnosti"))}`,
    `Slozky zakladnich gramotnosti: ${arrayText(get("slozkyZakladniGramotnosti"))}`,
    `Prurezova temata: ${arrayText(get("prurezovaTemata"))}`,
    `Predchazejici OVU: ${arrayText(row.predchazejici_kody ?? [])}`,
    `Souvisejici OVU: ${arrayText(row.souvisejici_kody ?? [])}`,
    `Nasledujici OVU: ${arrayText(row.nasledujici_kody ?? [])}`,
    methodSupport.length ? `Metodicka podpora:\n${methodSupport.map((item) => `- ${item}`).join("\n")}` : "Metodicka podpora: neuvedeno",
  ].filter(Boolean).join("\n\n");

  return makeKnowledgeItem({
    domain: "M01_RVP_OVU",
    sourceTable: "app_m01_rvp_ovu",
    sourceId: row.id,
    sourceCode: row.kod,
    sourceVersion: sourceVersion("rvp", svp.based_on_rvp_version_id, svp.rvp_dataset_version),
    title: `OVU ${row.kod}`,
    bodyText: body,
    structuredPayload: payload,
    metadata: { generatedBy: "build-m01-knowledge-corpus", corpus: "svetoplavci_m01_rvp_lodicky_v1" },
  });
}

function buildLodickaItem(row, svp, links) {
  const confirmedOvu = links.map((link) => ({ id: link.ovu_id, code: link.ovu_kod, title: link.ovu_zneni, isPrimary: link.is_primary }));
  const grades = gradeRange(row.rocnik_od, row.rocnik_do);
  const payload = {
    type: "lodicka",
    svpVersionId: svp.id,
    svpLabel: svp.label,
    rvpVersionId: svp.based_on_rvp_version_id,
    rvpDatasetVersion: svp.rvp_dataset_version,
    code: row.kod,
    typeCode: row.typ,
    grades,
    gradeFrom: row.rocnik_od,
    gradeTo: row.rocnik_do,
    stage: row.stupen,
    predmet: { code: row.predmet_kod, title: row.predmet_nazev },
    podpredmet: { code: row.podpredmet_kod, title: row.podpredmet_nazev },
    oblast: { code: row.oblast_kod, title: row.oblast_nazev },
    confirmedOvuCodes: confirmedOvu.map((item) => item.code),
    confirmedOvu,
  };

  const body = [
    `Lodicka ${row.kod}`,
    `Nazev: ${row.nazev}`,
    row.zkraceny_nazev ? `Zkraceny nazev: ${row.zkraceny_nazev}` : "",
    row.popis ? `Popis: ${row.popis}` : "Popis: neuvedeno",
    `Typ: ${row.typ}`,
    `Rocniky: ${row.rocnik_od}. az ${row.rocnik_do}. rocnik`,
    `Stupen: ${row.stupen}`,
    `Predmet: ${[row.predmet_kod, row.predmet_nazev].filter(Boolean).join(" · ")}`,
    row.podpredmet_nazev ? `Podpredmet: ${[row.podpredmet_kod, row.podpredmet_nazev].filter(Boolean).join(" · ")}` : "",
    `Oblast: ${[row.oblast_kod, row.oblast_nazev].filter(Boolean).join(" · ")}`,
    confirmedOvu.length
      ? `Potvrzena OVU:\n${confirmedOvu.map((item) => `- ${item.code}: ${item.title}`).join("\n")}`
      : "Potvrzena OVU: zadna",
  ].filter(Boolean).join("\n\n");

  return makeKnowledgeItem({
    domain: "M01_LODICKA",
    sourceTable: "app_m01_lodicka",
    sourceId: row.id,
    sourceCode: row.kod,
    sourceVersion: sourceVersion("svp", svp.id, svp.label),
    title: `Lodicka ${row.kod} · ${row.nazev}`,
    bodyText: body,
    structuredPayload: payload,
    metadata: { generatedBy: "build-m01-knowledge-corpus", corpus: "svetoplavci_m01_rvp_lodicky_v1" },
    validFrom: svp.effective_from,
    validTo: svp.effective_to,
  });
}

function makeKnowledgeItem(input) {
  const chunks = chunkText(input.bodyText).map((chunk, index) => ({
    chunkIndex: index,
    chunkText: chunk,
    tokenEstimate: estimateTokens(chunk),
    metadata: { chunkStrategy: "paragraph-pack", chunkTargetChars: CHUNK_TARGET_CHARS },
    contentHash: sha256(chunk),
  }));
  const contentHash = sha256(stableStringify({ bodyText: input.bodyText, structuredPayload: input.structuredPayload }));
  return { ...input, contentHash, chunks };
}

async function bulkWriteItems(client, items) {
  const itemRows = items.map((item) => ({
    id: randomUUID(),
    domain: item.domain,
    source_table: item.sourceTable,
    source_id: item.sourceId,
    source_code: item.sourceCode,
    source_version: item.sourceVersion,
    title: item.title,
    body_text: item.bodyText,
    structured_payload: item.structuredPayload,
    metadata: item.metadata,
    valid_from: item.validFrom ? new Date(item.validFrom).toISOString() : null,
    valid_to: item.validTo ? new Date(item.validTo).toISOString() : null,
    content_hash: item.contentHash,
  }));

  await client.query("BEGIN");
  try {
    const upserted = await client.query(
      `
      WITH incoming AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS x(
          id text,
          domain text,
          source_table text,
          source_id text,
          source_code text,
          source_version text,
          title text,
          body_text text,
          structured_payload jsonb,
          metadata jsonb,
          valid_from timestamptz,
          valid_to timestamptz,
          content_hash text
        )
      )
      INSERT INTO app_ai_knowledge_item (
        id, domain, source_table, source_id, source_code, source_version, language, title, body_text,
        structured_payload, metadata, valid_from, valid_to, is_active, content_hash, created_at, updated_at
      )
      SELECT
        id,
        domain::"AiKnowledgeDomain",
        source_table,
        source_id,
        source_code,
        source_version,
        'cs',
        title,
        body_text,
        structured_payload,
        metadata,
        valid_from,
        valid_to,
        true,
        content_hash,
        now(),
        now()
      FROM incoming
      ON CONFLICT (source_table, source_id) DO UPDATE SET
        domain = EXCLUDED.domain,
        source_code = EXCLUDED.source_code,
        source_version = EXCLUDED.source_version,
        language = EXCLUDED.language,
        title = EXCLUDED.title,
        body_text = EXCLUDED.body_text,
        structured_payload = EXCLUDED.structured_payload,
        metadata = EXCLUDED.metadata,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to,
        is_active = true,
        content_hash = EXCLUDED.content_hash,
        updated_at = now()
      RETURNING id, source_table, source_id
      `,
      [JSON.stringify(itemRows)],
    );

    const itemIdBySource = new Map(upserted.rows.map((row) => [`${row.source_table}:${row.source_id}`, row.id]));
    const itemIds = upserted.rows.map((row) => row.id);
    if (itemIds.length > 0) {
      await client.query("DELETE FROM app_ai_knowledge_chunk WHERE item_id = ANY($1::text[])", [itemIds]);
    }

    const chunkRows = items.flatMap((item) => {
      const itemId = itemIdBySource.get(`${item.sourceTable}:${item.sourceId}`);
      if (!itemId) throw new Error(`Missing upserted item id for ${item.sourceTable}:${item.sourceId}`);
      return item.chunks.map((chunk) => ({
        id: randomUUID(),
        item_id: itemId,
        chunk_index: chunk.chunkIndex,
        chunk_text: chunk.chunkText,
        token_estimate: chunk.tokenEstimate,
        metadata: chunk.metadata,
        content_hash: chunk.contentHash,
      }));
    });

    if (chunkRows.length > 0) {
      await client.query(
        `
        INSERT INTO app_ai_knowledge_chunk (
          id, item_id, chunk_index, chunk_text, token_estimate, metadata, content_hash, created_at, updated_at
        )
        SELECT
          id,
          item_id,
          chunk_index,
          chunk_text,
          token_estimate,
          metadata,
          content_hash,
          now(),
          now()
        FROM jsonb_to_recordset($1::jsonb) AS x(
          id text,
          item_id text,
          chunk_index int,
          chunk_text text,
          token_estimate int,
          metadata jsonb,
          content_hash text
        )
        `,
        [JSON.stringify(chunkRows)],
      );
    }

    await client.query("COMMIT");
    return { items: itemRows.length, chunks: chunkRows.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function writeArtifacts(outDir, manifest, items, evalCases) {
  await mkdir(outDir, { recursive: true });
  const itemCatalog = items.map((item) => JSON.stringify({
    domain: item.domain,
    sourceTable: item.sourceTable,
    sourceId: item.sourceId,
    sourceCode: item.sourceCode,
    sourceVersion: item.sourceVersion,
    title: item.title,
    contentHash: item.contentHash,
    structuredPayload: item.structuredPayload,
  })).join("\n");
  const chunkCatalog = items.flatMap((item) => item.chunks.map((chunk) => JSON.stringify({
    domain: item.domain,
    sourceTable: item.sourceTable,
    sourceId: item.sourceId,
    sourceCode: item.sourceCode,
    chunkIndex: chunk.chunkIndex,
    tokenEstimate: chunk.tokenEstimate,
    contentHash: chunk.contentHash,
    chunkText: chunk.chunkText,
  }))).join("\n");

  const sourceCatalog = `# Source catalog: Světoplavci M01 RVP/lodičky\n\n` +
    `- Corpus: ${manifest.corpus}\n` +
    `- Generated at: ${manifest.generatedAt}\n` +
    `- RVP version: ${manifest.rvp.datasetVersion} (${manifest.rvp.id})\n` +
    `- RVP source: ${manifest.rvp.sourceUrl ?? "neuvedeno"}\n` +
    `- SVP version: ${manifest.svp.label} (${manifest.svp.id})\n` +
    `- Domains: M01_RVP_OVU, M01_LODICKA\n\n` +
    `## Counts\n\n` +
    `- Knowledge items: ${manifest.counts.items}\n` +
    `- Chunks: ${manifest.counts.chunks}\n` +
    `- OVU items: ${manifest.counts.ovuItems}\n` +
    `- Lodička items: ${manifest.counts.lodickaItems}\n`;

  const retrievalEval = `# Retrieval eval seed: Světoplavci M01 RVP/lodičky\n\n` +
    `These cases are deterministic seed checks for the future vector index. They verify that the corpus contains enough structured context before embeddings are introduced.\n\n` +
    evalCases.map((test, index) => (
      `## Case ${index + 1}: ${test.name}\n\n` +
      `- Query: ${test.query}\n` +
      `- Expected domain: ${test.expectedDomain}\n` +
      `- Expected codes: ${test.expectedCodes.join(", ") || "n/a"}\n` +
      `- Reason: ${test.reason}\n`
    )).join("\n");

  await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(outDir, "items.jsonl"), `${itemCatalog}\n`, "utf8");
  await writeFile(path.join(outDir, "chunks.jsonl"), `${chunkCatalog}\n`, "utf8");
  await writeFile(path.join(outDir, "source_catalog.md"), sourceCatalog, "utf8");
  await writeFile(path.join(outDir, "retrieval_eval.md"), retrievalEval, "utf8");
}

function buildEvalCases(items) {
  const lodicky = items.filter((item) => item.domain === "M01_LODICKA");
  const ovu = items.filter((item) => item.domain === "M01_RVP_OVU");
  const withLinks = lodicky.filter((item) => item.structuredPayload.confirmedOvuCodes?.length);
  const cases = [];
  for (const item of withLinks.slice(0, 5)) {
    cases.push({
      name: `Known hard link for ${item.sourceCode}`,
      query: `${item.title}: ${item.structuredPayload.predmet?.title ?? ""} ${item.structuredPayload.oblast?.title ?? ""}`,
      expectedDomain: "M01_RVP_OVU",
      expectedCodes: item.structuredPayload.confirmedOvuCodes.slice(0, 5),
      reason: "A future retriever should recover already confirmed OVU for this lodička.",
    });
  }
  for (const item of ovu.filter((entry) => entry.structuredPayload.uzlovyBod?.grade).slice(0, 5)) {
    cases.push({
      name: `Grade context for ${item.sourceCode}`,
      query: `${item.structuredPayload.uzlovyBod.grade}. rocnik ${item.bodyText.slice(0, 140)}`,
      expectedDomain: "M01_RVP_OVU",
      expectedCodes: [item.sourceCode],
      reason: "A future retriever should keep grade and RVP context attached to the OVU text.",
    });
  }
  return cases;
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
    const svp = await selectSvp(client, args.svp);
    const ovuRows = await loadOvuRows(client, svp.based_on_rvp_version_id);
    const contextByOvu = await loadOvuContexts(client, svp.based_on_rvp_version_id);
    const methodByOvu = await loadMethodSupport(client, svp.based_on_rvp_version_id);
    const lodicky = await loadLodicky(client, svp.id);
    const lodickaLinks = await loadLodickaOvuLinks(client, svp.id);

    const ovuItems = ovuRows.map((row) => buildOvuItem(row, svp, contextByOvu.get(row.id) ?? [], methodByOvu.get(row.id) ?? []));
    const lodickaItems = lodicky.map((row) => buildLodickaItem(row, svp, lodickaLinks.get(row.id) ?? []));
    const items = [...ovuItems, ...lodickaItems];
    const chunks = items.flatMap((item) => item.chunks);
    const evalCases = buildEvalCases(items);
    const generatedAt = new Date().toISOString();
    const manifest = {
      corpus: "svetoplavci_m01_rvp_lodicky_v1",
      generatedAt,
      mode: args.write ? "write" : "dry-run",
      rvp: {
        id: svp.based_on_rvp_version_id,
        datasetVersion: svp.rvp_dataset_version,
        sourceFormat: svp.rvp_source_format,
        sourceUrl: svp.rvp_source_url,
        sourceHash: svp.rvp_source_hash,
      },
      svp: {
        id: svp.id,
        label: svp.label,
        status: svp.status,
        isCurrent: svp.is_current,
      },
      counts: {
        items: items.length,
        chunks: chunks.length,
        ovuItems: ovuItems.length,
        lodickaItems: lodickaItems.length,
        evalCases: evalCases.length,
      },
      hashes: {
        corpusHash: sha256(items.map((item) => item.contentHash).sort().join("\n")),
      },
    };

    const outDir = path.join(args.out, `rvp-${svp.rvp_dataset_version}__svp-${svp.id}`);
    await writeArtifacts(outDir, manifest, items, evalCases);

    let writtenItems = 0;
    let writtenChunks = 0;
    if (args.write) {
      console.log(`[m01:knowledge] bulk writing ${items.length} items and ${chunks.length} chunks`);
      const written = await bulkWriteItems(client, items);
      writtenItems = written.items;
      writtenChunks = written.chunks;
    }

    console.log(JSON.stringify({
      ok: true,
      mode: args.write ? "write" : "dry-run",
      selectedSvp: svp.id,
      selectedRvp: svp.based_on_rvp_version_id,
      counts: manifest.counts,
      written: { items: writtenItems, chunks: writtenChunks },
      artifacts: outDir,
      corpusHash: manifest.hashes.corpusHash,
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
