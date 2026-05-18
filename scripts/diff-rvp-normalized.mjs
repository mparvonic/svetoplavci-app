#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };

    if (arg === "--from") args.from = next();
    else if (arg === "--to") args.to = next();
    else if (arg === "--out") args.out = next();
    else if (arg === "--examples") args.examples = Number(next());
    else if (arg === "--format") args.format = next();
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  args.examples ??= 10;
  args.format ??= args.out?.endsWith(".md") ? "markdown" : "json";
  if (!["json", "markdown"].includes(args.format)) throw new Error("--format must be json or markdown.");
  return args;
}

function usage() {
  return `Usage:
  node scripts/diff-rvp-normalized.mjs --from .tmp/rvp-normalized/2025-06-24 --to .tmp/rvp-normalized/2025-08-21
  node scripts/diff-rvp-normalized.mjs --from <dir-a> --to <dir-b> --format markdown --out .tmp/rvp-normalized/diff.md
`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await readFile(filePath, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function byStableKey(rows) {
  return new Map(rows.map((row) => [row.stableKey, row]));
}

function countBy(rows, field) {
  const counts = new Map();
  for (const row of rows) counts.set(row[field] ?? "(none)", (counts.get(row[field] ?? "(none)") ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "cs")));
}

function pickExamples(rows, limit) {
  return rows.slice(0, limit).map((row) => ({
    stableKey: row.stableKey,
    entityType: row.entityType,
    edgeType: row.edgeType,
    code: row.code,
    title: row.title,
    fromStableKey: row.fromStableKey,
    toStableKey: row.toStableKey,
    targetCode: row.targetCode,
  }));
}

function diffEntities(fromRows, toRows, examples) {
  const from = byStableKey(fromRows);
  const to = byStableKey(toRows);

  const added = [];
  const removed = [];
  const contentChanged = [];
  const structureChanged = [];
  const contentAndStructureChanged = [];

  for (const [key, row] of to) {
    if (!from.has(key)) added.push(row);
  }

  for (const [key, row] of from) {
    const next = to.get(key);
    if (!next) {
      removed.push(row);
      continue;
    }

    const content = row.contentHash !== next.contentHash;
    const structure = row.structureHash !== next.structureHash;
    if (content && structure) contentAndStructureChanged.push(next);
    else if (content) contentChanged.push(next);
    else if (structure) structureChanged.push(next);
  }

  const changed = [...contentChanged, ...structureChanged, ...contentAndStructureChanged];
  return {
    counts: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      contentChanged: contentChanged.length,
      structureChanged: structureChanged.length,
      contentAndStructureChanged: contentAndStructureChanged.length,
    },
    byType: {
      added: countBy(added, "entityType"),
      removed: countBy(removed, "entityType"),
      changed: countBy(changed, "entityType"),
    },
    affectedOvuCodes: {
      added: added.filter((row) => row.entityType === "ovu").map((row) => row.code).sort(),
      removed: removed.filter((row) => row.entityType === "ovu").map((row) => row.code).sort(),
      changed: changed.filter((row) => row.entityType === "ovu").map((row) => row.code).sort(),
    },
    examples: {
      added: pickExamples(added, examples),
      removed: pickExamples(removed, examples),
      changed: pickExamples(changed, examples),
    },
  };
}

function diffEdges(fromRows, toRows, examples) {
  const from = byStableKey(fromRows);
  const to = byStableKey(toRows);
  const added = [];
  const removed = [];

  for (const [key, row] of to) {
    if (!from.has(key)) added.push(row);
  }
  for (const [key, row] of from) {
    if (!to.has(key)) removed.push(row);
  }

  return {
    counts: {
      added: added.length,
      removed: removed.length,
    },
    byType: {
      added: countBy(added, "edgeType"),
      removed: countBy(removed, "edgeType"),
    },
    examples: {
      added: pickExamples(added, examples),
      removed: pickExamples(removed, examples),
    },
  };
}

function markdownTable(counts) {
  const rows = Object.entries(counts ?? {});
  if (rows.length === 0) return "_None._\n";
  return ["| Type | Count |", "| --- | ---: |", ...rows.map(([type, count]) => `| ${escapeMd(type)} | ${count} |`)].join("\n") + "\n";
}

function formatExamples(items, emptyText = "None") {
  if (!items?.length) return `_${emptyText}._\n`;
  return `${items
    .map((item) => {
      const label = item.code || item.targetCode || item.title || item.edgeType || item.entityType || item.stableKey;
      const detail = item.edgeType ? `${item.fromStableKey} -> ${item.toStableKey}` : item.stableKey;
      return `- \`${escapeBackticks(label)}\` - ${escapeMd(detail)}`;
    })
    .join("\n")}\n`;
}

function formatOvuCodes(codes, limit = 80) {
  if (!codes.length) return "_None._\n";
  const shown = codes.slice(0, limit).map((code) => `\`${escapeBackticks(code)}\``).join(", ");
  const suffix = codes.length > limit ? `\n\n_${codes.length - limit} more not shown._` : "";
  return `${shown}${suffix}\n`;
}

function escapeMd(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

function escapeBackticks(value) {
  return String(value ?? "").replace(/`/g, "'");
}

function renderMarkdown(result) {
  return `# RVP normalized diff: ${result.from.datasetVersion} -> ${result.to.datasetVersion}

## Sources

| Version | Source hash | Entities | Edges | OVU |
| --- | --- | ---: | ---: | ---: |
| ${result.from.datasetVersion} | \`${result.from.sourceHash}\` | ${result.from.counts.entities} | ${result.from.counts.edges} | ${result.from.counts.ovu} |
| ${result.to.datasetVersion} | \`${result.to.sourceHash}\` | ${result.to.counts.entities} | ${result.to.counts.edges} | ${result.to.counts.ovu} |

## Entity Summary

| Change | Count |
| --- | ---: |
| Added | ${result.entities.counts.added} |
| Removed | ${result.entities.counts.removed} |
| Changed | ${result.entities.counts.changed} |
| Content changed | ${result.entities.counts.contentChanged} |
| Structure changed | ${result.entities.counts.structureChanged} |
| Content and structure changed | ${result.entities.counts.contentAndStructureChanged} |

### Added Entities By Type

${markdownTable(result.entities.byType.added)}
### Removed Entities By Type

${markdownTable(result.entities.byType.removed)}
### Changed Entities By Type

${markdownTable(result.entities.byType.changed)}
## Affected OVU

### Added OVU

${formatOvuCodes(result.entities.affectedOvuCodes.added)}
### Removed OVU

${formatOvuCodes(result.entities.affectedOvuCodes.removed)}
### Changed OVU (${result.entities.affectedOvuCodes.changed.length})

${formatOvuCodes(result.entities.affectedOvuCodes.changed)}
## Edge Summary

| Change | Count |
| --- | ---: |
| Added | ${result.edges.counts.added} |
| Removed | ${result.edges.counts.removed} |

### Added Edges By Type

${markdownTable(result.edges.byType.added)}
### Removed Edges By Type

${markdownTable(result.edges.byType.removed)}
## Examples

### Added Entities

${formatExamples(result.entities.examples.added)}
### Removed Entities

${formatExamples(result.entities.examples.removed)}
### Changed Entities

${formatExamples(result.entities.examples.changed)}
### Added Edges

${formatExamples(result.edges.examples.added)}
### Removed Edges

${formatExamples(result.edges.examples.removed)}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.from || !args.to) throw new Error("Both --from and --to are required.");

  const [fromManifest, toManifest, fromEntities, toEntities, fromEdges, toEdges] = await Promise.all([
    readJson(path.join(args.from, "manifest.json")),
    readJson(path.join(args.to, "manifest.json")),
    readJsonl(path.join(args.from, "entities.jsonl")),
    readJsonl(path.join(args.to, "entities.jsonl")),
    readJsonl(path.join(args.from, "edges.jsonl")),
    readJsonl(path.join(args.to, "edges.jsonl")),
  ]);

  const result = {
    from: {
      datasetVersion: fromManifest.datasetVersion,
      sourceHash: fromManifest.sourceHash,
      counts: fromManifest.counts,
    },
    to: {
      datasetVersion: toManifest.datasetVersion,
      sourceHash: toManifest.sourceHash,
      counts: toManifest.counts,
    },
    entities: diffEntities(fromEntities, toEntities, args.examples),
    edges: diffEdges(fromEdges, toEdges, args.examples),
  };

  const output = args.format === "markdown" ? renderMarkdown(result) : `${JSON.stringify(result, null, 2)}\n`;
  if (args.out) {
    await writeFile(args.out, output, "utf8");
    console.log(`[rvp:diff] wrote ${args.out}`);
  } else {
    console.log(output);
  }
}

main().catch((error) => {
  console.error("[rvp:diff] Failed:", error);
  process.exit(1);
});
