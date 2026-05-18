#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const NORMALIZER_VERSION = "rvp-graph-projection-v1";

const PRESETS = {
  "2025-06-24": {
    datasetVersion: "2025-06-24",
    sourceFormat: "full_mp",
    nkodUrl:
      "https://data.gov.cz/datov%C3%A1-sada?iri=https%3A%2F%2Fdata.gov.cz%2Fzdroj%2Fdatov%C3%A9-sady%2F45768455%2F1562413075",
    sourceUrl: "https://opendata.npi.cz/download/rvp/data_final_rvp_zv_full_mp_20250624.json",
  },
  "2025-08-21": {
    datasetVersion: "2025-08-21",
    sourceFormat: "full_mp",
    nkodUrl:
      "https://data.gov.cz/datov%C3%A1-sada?iri=https%3A%2F%2Fdata.gov.cz%2Fzdroj%2Fdatov%C3%A9-sady%2F45768455%2F1569376830",
    sourceUrl: "https://opendata.npi.cz/download/rvp/data_final_rvp_zv_full_mp_20250821.json",
  },
};

const CONTAINER_TYPES = new Set([
  "obecneCasti",
  "kapitoly",
  "podkapitoly",
  "zakladniGramotnosti",
  "slozkyZakladniGramotnosti",
  "podslozkyZakladniGramotnosti",
  "klicoveKompetence",
  "slozkyKlicoveKompetence",
  "podslozkyKlicoveKompetence",
  "prurezovaTemata",
  "slozkyPrurezovehoTematu",
  "vzdelavaciOblasti",
  "vzdelavaciObory",
  "tematickeOkruhy",
]);

const RELATION_FIELDS = [
  ["predchazejiciOcekavaneVysledkyUceni", "ovu_precedes"],
  ["souvisejiciOcekavaneVysledkyUceni", "ovu_related"],
  ["nasledujiciOcekavaneVysledkyUceni", "ovu_follows"],
];

function parseArgs(argv) {
  const args = {
    version: "2025-06-24",
    includeRaw: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      i += 1;
      return value;
    };

    if (arg === "--version") args.version = next();
    else if (arg === "--url") args.sourceUrl = next();
    else if (arg === "--input") args.input = next();
    else if (arg === "--out") args.out = next();
    else if (arg === "--skip-raw") args.includeRaw = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  const preset = PRESETS[args.version] ?? null;
  return {
    ...(preset ?? { datasetVersion: args.version, sourceFormat: "full_mp" }),
    ...args,
    out: args.out ?? path.join(".tmp", "rvp-normalized", args.version),
  };
}

function usage() {
  return `Usage:
  node scripts/normalize-rvp-open-data.mjs [--version 2025-06-24] [--out .tmp/rvp-normalized/2025-06-24]
  node scripts/normalize-rvp-open-data.mjs --version 2025-08-21
  node scripts/normalize-rvp-open-data.mjs --input /path/source.json --version custom --out .tmp/rvp-normalized/custom

Outputs:
  manifest.json   stable summary and validation counts
  entities.jsonl  one normalized RVP graph node per line
  edges.jsonl     one normalized RVP graph edge per line
  ovu.jsonl       compact OVU catalog for review/search
  raw/source.json original source JSON unless --skip-raw is used
`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToText(value) {
  return normalizeWhitespace(
    decodeHtmlEntities(value)
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/p\s*>/gi, "\n")
      .replace(/<\s*\/li\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function segmentFor(node, index) {
  if (node && typeof node === "object") {
    const value = node.kod ?? node.nazev ?? node.zneni;
    if (value !== undefined && value !== null && String(value).trim()) {
      return sanitizePathSegment(String(value));
    }
  }
  return `index-${index}`;
}

function sanitizePathSegment(value) {
  return normalizeWhitespace(value).replace(/[\[\]{}|/\\]+/g, "-").slice(0, 120);
}

function entityText(node, type) {
  if (type === "ovu") {
    return [node.zneni, htmlToText(node.popisAZduvodneni), ...(node.hodnoty ?? [])].filter(Boolean).join("\n\n");
  }

  if (type === "metodickaUroven" || type === "ilustrace") {
    return [node.nazev, htmlToText(node.charakteristika), node.url].filter(Boolean).join("\n\n");
  }

  return [node.nazev, htmlToText(node.charakteristika), htmlToText(node.metodickyKomentar)].filter(Boolean).join("\n\n");
}

function addCount(map, key, count = 1) {
  map.set(key, (map.get(key) ?? 0) + count);
}

function pushEntity(entities, entity) {
  const payload = entity.structuredPayload ?? {};
  const bodyText = normalizeWhitespace(entity.bodyText ?? "");
  entities.push({
    stableKey: entity.stableKey,
    entityType: entity.entityType,
    sourcePath: entity.sourcePath,
    code: entity.code ?? null,
    title: entity.title ?? null,
    bodyText,
    sourceTable: entity.sourceTable ?? null,
    sourceLookup: entity.sourceLookup ?? null,
    metadata: entity.metadata ?? {},
    structuredPayload: payload,
    contentHash: sha256(stableJson({ title: entity.title ?? null, bodyText, payload })),
    structureHash: sha256(stableJson({ sourcePath: entity.sourcePath, metadata: entity.metadata ?? {} })),
  });
}

function pushEdge(edges, edge) {
  edges.push({
    stableKey: `${edge.edgeType}|${edge.fromStableKey}|${edge.toStableKey}`,
    edgeType: edge.edgeType,
    fromStableKey: edge.fromStableKey,
    toStableKey: edge.toStableKey,
    targetCode: edge.targetCode ?? null,
    targetExists: edge.targetExists ?? true,
    metadata: edge.metadata ?? {},
  });
}

function normalizeRvp(data) {
  const entities = [];
  const edges = [];
  const ovuRows = [];
  const ovuCodes = new Set();
  const entityTypeCounts = new Map();
  const edgeTypeCounts = new Map();
  const topLevelCounts = {};

  collectOvuCodes(data, ovuCodes);

  function addEntity(entity) {
    pushEntity(entities, entity);
    addCount(entityTypeCounts, entity.entityType);
  }

  function addEdge(edge) {
    pushEdge(edges, edge);
    addCount(edgeTypeCounts, edge.edgeType);
  }

  function visit(node, ctx) {
    if (!node || typeof node !== "object") return null;

    let currentStableKey = ctx.parentStableKey;
    const sourcePath = ctx.sourcePath;

    if (CONTAINER_TYPES.has(ctx.arrayName)) {
      currentStableKey = `rvp:${ctx.arrayName}:${sourcePath}`;
      addEntity({
        stableKey: currentStableKey,
        entityType: ctx.arrayName,
        sourcePath,
        code: node.kod ?? null,
        title: node.nazev ?? null,
        bodyText: entityText(node, ctx.arrayName),
        metadata: {
          topLevel: ctx.topLevel,
          parentStableKey: ctx.parentStableKey,
          fields: Object.keys(node).sort(),
        },
        structuredPayload: shallowPayload(node),
      });
      if (ctx.parentStableKey) {
        addEdge({ edgeType: "contains", fromStableKey: ctx.parentStableKey, toStableKey: currentStableKey });
      }
    }

    if (ctx.arrayName === "uzloveBody") {
      currentStableKey = `rvp:uzlovyBod:${sourcePath}`;
      addEntity({
        stableKey: currentStableKey,
        entityType: "uzlovyBod",
        sourcePath,
        code: node.kod ?? null,
        title: node.nazev ?? null,
        bodyText: entityText(node, "uzlovyBod"),
        sourceTable: "app_m01_rvp_uzlovy_bod",
        sourceLookup: { graphSourcePath: sourcePath, kod: node.kod ?? null, nazev: node.nazev ?? null },
        metadata: {
          topLevel: ctx.topLevel,
          parentStableKey: ctx.parentStableKey,
          fields: Object.keys(node).sort(),
        },
        structuredPayload: shallowPayload(node),
      });
      if (ctx.parentStableKey) {
        addEdge({ edgeType: "contains", fromStableKey: ctx.parentStableKey, toStableKey: currentStableKey });
      }
    }

    if (ctx.arrayName === "ocekavaneVysledkyUceni") {
      currentStableKey = `rvp:ovu:${node.kod}`;
      const methodLevels = node.urovneMetodickePodpory ?? [];
      const ovuPayload = shallowPayload(node);
      addEntity({
        stableKey: currentStableKey,
        entityType: "ovu",
        sourcePath,
        code: node.kod,
        title: node.zneni ?? null,
        bodyText: entityText(node, "ovu"),
        sourceTable: "app_m01_rvp_ovu",
        sourceLookup: { kod: node.kod },
        metadata: {
          topLevel: ctx.topLevel,
          parentStableKey: ctx.parentStableKey,
          hodnoty: node.hodnoty ?? [],
          methodLevelCount: methodLevels.length,
          fields: Object.keys(node).sort(),
        },
        structuredPayload: ovuPayload,
      });
      if (ctx.parentStableKey) {
        addEdge({ edgeType: "contains", fromStableKey: ctx.parentStableKey, toStableKey: currentStableKey });
      }

      for (const [sourceField, edgeType] of RELATION_FIELDS) {
        for (const targetCode of node[sourceField] ?? []) {
          const targetExists = ovuCodes.has(targetCode);
          addEdge({
            edgeType,
            fromStableKey: currentStableKey,
            toStableKey: targetExists ? `rvp:ovu:${targetCode}` : `external:ovu:${targetCode}`,
            targetCode,
            targetExists,
          });
        }
      }

      for (const value of node.hodnoty ?? []) {
        const valueStableKey = `rvp:hodnota:${sanitizePathSegment(value)}`;
        addEntity({
          stableKey: valueStableKey,
          entityType: "hodnota",
          sourcePath: `hodnoty/${sanitizePathSegment(value)}`,
          title: value,
          bodyText: value,
          metadata: { globalValue: true },
        });
        addEdge({ edgeType: "has_value", fromStableKey: currentStableKey, toStableKey: valueStableKey });
      }

      methodLevels.forEach((level, index) => {
        const levelSourcePath = `${sourcePath}/urovneMetodickePodpory[${segmentFor(level, index)}]`;
        const levelStableKey = `rvp:metodickaUroven:${levelSourcePath}`;
        addEntity({
          stableKey: levelStableKey,
          entityType: "metodickaUroven",
          sourcePath: levelSourcePath,
          title: level.nazev ?? null,
          bodyText: entityText(level, "metodickaUroven"),
          metadata: {
            parentStableKey: currentStableKey,
            ovuCode: node.kod,
            levelName: level.nazev ?? null,
            illustrationCount: level.ilustrace?.length ?? 0,
          },
          structuredPayload: shallowPayload(level),
        });
        addEdge({ edgeType: "has_method_level", fromStableKey: currentStableKey, toStableKey: levelStableKey });

        (level.ilustrace ?? []).forEach((illustration, illustrationIndex) => {
          const illustrationSourcePath = `${levelSourcePath}/ilustrace[${segmentFor(illustration, illustrationIndex)}]`;
          const illustrationStableKey = `rvp:ilustrace:${illustrationSourcePath}`;
          addEntity({
            stableKey: illustrationStableKey,
            entityType: "ilustrace",
            sourcePath: illustrationSourcePath,
            title: illustration.nazev ?? null,
            bodyText: entityText(illustration, "ilustrace"),
            metadata: {
              parentStableKey: levelStableKey,
              ovuCode: node.kod,
              levelName: level.nazev ?? null,
              url: illustration.url ?? null,
            },
            structuredPayload: shallowPayload(illustration),
          });
          addEdge({ edgeType: "has_illustration", fromStableKey: levelStableKey, toStableKey: illustrationStableKey });
        });
      });

      ovuRows.push({
        stableKey: currentStableKey,
        kod: node.kod,
        zneni: node.zneni ?? null,
        sourcePath,
        uzlovyBodStableKey: ctx.parentStableKey,
        topLevel: ctx.topLevel,
        hodnoty: node.hodnoty ?? [],
        predchazejiciKody: node.predchazejiciOcekavaneVysledkyUceni ?? [],
        souvisejiciKody: node.souvisejiciOcekavaneVysledkyUceni ?? [],
        nasledujiciKody: node.nasledujiciOcekavaneVysledkyUceni ?? [],
        methodLevelCount: methodLevels.length,
        contentHash: sha256(stableJson({ zneni: node.zneni ?? null, popis: htmlToText(node.popisAZduvodneni), hodnoty: node.hodnoty ?? [] })),
      });
    }

    for (const [field, value] of Object.entries(node)) {
      if (!Array.isArray(value)) continue;
      value.forEach((child, index) => {
        visit(child, {
          arrayName: field,
          parentStableKey: currentStableKey,
          topLevel: ctx.topLevel,
          sourcePath: `${sourcePath}/${field}[${segmentFor(child, index)}]`,
        });
      });
    }

    return currentStableKey;
  }

  for (const [topLevel, value] of Object.entries(data)) {
    topLevelCounts[topLevel] = Array.isArray(value) ? value.length : null;
    if (!Array.isArray(value)) continue;
    value.forEach((node, index) => {
      visit(node, {
        arrayName: topLevel,
        parentStableKey: null,
        topLevel,
        sourcePath: `${topLevel}[${segmentFor(node, index)}]`,
      });
    });
  }

  const dedupedEntities = dedupeByStableKey(entities);
  const dedupedEdges = dedupeByStableKey(edges);
  const sortedEntities = sortByStableKey(dedupedEntities);
  const sortedEdges = sortByStableKey(dedupedEdges);
  const sortedOvuRows = ovuRows.toSorted((a, b) => a.kod.localeCompare(b.kod, "cs"));

  const relationIntegrity = Object.fromEntries(
    RELATION_FIELDS.map(([, edgeType]) => {
      const relEdges = sortedEdges.filter((edge) => edge.edgeType === edgeType);
      const externalTargets = relEdges.filter((edge) => !edge.targetExists);
      return [
        edgeType,
        {
          total: relEdges.length,
          externalTargetCount: externalTargets.length,
          externalTargetExamples: externalTargets.slice(0, 20).map((edge) => ({ from: edge.fromStableKey, targetCode: edge.targetCode })),
        },
      ];
    }),
  );

  return {
    entities: sortedEntities,
    edges: sortedEdges,
    ovuRows: sortedOvuRows,
    summary: {
      topLevelCounts,
      counts: {
        entities: sortedEntities.length,
        edges: sortedEdges.length,
        ovu: sortedOvuRows.length,
      },
      entityTypeCounts: countBy(sortedEntities, "entityType"),
      edgeTypeCounts: countBy(sortedEdges, "edgeType"),
      relationIntegrity,
      uniqueness: {
        entityStableKeysUnique: sortedEntities.length === new Set(sortedEntities.map((item) => item.stableKey)).size,
        edgeStableKeysUnique: sortedEdges.length === new Set(sortedEdges.map((item) => item.stableKey)).size,
        ovuCodesUnique: sortedOvuRows.length === new Set(sortedOvuRows.map((item) => item.kod)).size,
      },
    },
  };
}

function collectOvuCodes(value, result) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectOvuCodes(item, result));
    return;
  }
  if (!value || typeof value !== "object") return;
  if (typeof value.kod === "string" && Object.hasOwn(value, "zneni") && Object.hasOwn(value, "urovneMetodickePodpory")) {
    result.add(value.kod);
  }
  Object.values(value).forEach((child) => collectOvuCodes(child, result));
}

function shallowPayload(node) {
  const payload = {};
  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value)) {
      if (value.every((item) => typeof item !== "object")) payload[key] = value;
      else payload[`${key}Count`] = value.length;
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

function dedupeByStableKey(items) {
  const byKey = new Map();
  for (const item of items) {
    if (!byKey.has(item.stableKey)) byKey.set(item.stableKey, item);
  }
  return [...byKey.values()];
}

function sortByStableKey(items) {
  return items.toSorted((a, b) => a.stableKey.localeCompare(b.stableKey, "cs"));
}

function countBy(items, field) {
  const counts = new Map();
  items.forEach((item) => addCount(counts, item[field] ?? "(none)"));
  return Object.fromEntries([...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "cs")));
}

async function loadSource(config) {
  if (config.input) {
    return {
      text: await readFile(config.input, "utf8"),
      sourceUrl: null,
      sourceKind: "file",
    };
  }

  const response = await fetch(config.sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${config.sourceUrl}: ${response.status} ${response.statusText}`);
  }

  return {
    text: await response.text(),
    sourceUrl: config.sourceUrl,
    sourceKind: "url",
    lastModified: response.headers.get("last-modified"),
    contentLength: response.headers.get("content-length"),
    contentType: response.headers.get("content-type"),
  };
}

async function writeJsonl(filePath, rows) {
  await writeFile(filePath, `${rows.map((row) => stableJson(row)).join("\n")}\n`, "utf8");
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  if (config.help) {
    console.log(usage());
    return;
  }

  const source = await loadSource(config);
  const sourceHash = sha256(source.text);
  const data = JSON.parse(source.text);
  const normalized = normalizeRvp(data);

  const outDir = path.resolve(config.out);
  await mkdir(outDir, { recursive: true });
  if (config.includeRaw) {
    await mkdir(path.join(outDir, "raw"), { recursive: true });
    await writeFile(path.join(outDir, "raw", "source.json"), source.text, "utf8");
  }

  const manifest = {
    datasetVersion: config.datasetVersion,
    sourceFormat: config.sourceFormat,
    nkodUrl: config.nkodUrl ?? null,
    sourceUrl: source.sourceUrl ?? config.input,
    sourceKind: source.sourceKind,
    sourceHash,
    sourceBytes: Buffer.byteLength(source.text),
    sourceHttp: source.sourceKind === "url" ? {
      contentLength: source.contentLength,
      contentType: source.contentType,
      lastModified: source.lastModified,
    } : null,
    normalizerVersion: NORMALIZER_VERSION,
    outputs: {
      entities: "entities.jsonl",
      edges: "edges.jsonl",
      ovu: "ovu.jsonl",
      raw: config.includeRaw ? "raw/source.json" : null,
    },
    ...normalized.summary,
  };

  await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeJsonl(path.join(outDir, "entities.jsonl"), normalized.entities);
  await writeJsonl(path.join(outDir, "edges.jsonl"), normalized.edges);
  await writeJsonl(path.join(outDir, "ovu.jsonl"), normalized.ovuRows);

  console.log(`[rvp:normalize] ${config.datasetVersion}`);
  console.log(`[rvp:normalize] sourceHash=${sourceHash}`);
  console.log(`[rvp:normalize] entities=${normalized.entities.length} edges=${normalized.edges.length} ovu=${normalized.ovuRows.length}`);
  console.log(`[rvp:normalize] out=${outDir}`);
}

main().catch((error) => {
  console.error("[rvp:normalize] Failed:", error);
  process.exit(1);
});
