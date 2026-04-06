#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function fail(errors) {
  console.error("\nPolicy guard failed:\n");
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
    args[key] = value;
    if (value !== "true") i += 1;
  }
  return args;
}

function getChangedFiles(baseRef) {
  run(`git fetch --no-tags --depth=1 origin ${baseRef}:refs/remotes/origin/${baseRef}`);
  const output = run(`git diff --name-only origin/${baseRef}...HEAD`);
  if (!output) return [];
  return output.split("\n").map((item) => item.trim()).filter(Boolean);
}

function getAddedLinesForFile(baseRef, filePath) {
  const escaped = filePath.replace(/(["\\$`])/g, "\\$1");
  const diff = run(`git diff --unified=0 origin/${baseRef}...HEAD -- "${escaped}"`);
  if (!diff) return [];

  const lines = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) continue;
    if (line.startsWith("+")) {
      lines.push(line.slice(1));
    }
  }
  return lines;
}

function matchesAnyPrefix(value, prefixes) {
  return prefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`));
}

const args = parseArgs(process.argv.slice(2));
const baseRef = args.base ?? process.env.POLICY_BASE_REF ?? process.env.GITHUB_BASE_REF;

if (!baseRef) {
  console.log("Policy guard: missing base ref, skipping.");
  process.exit(0);
}

const guardedBases = new Set(["proto", "staging", "main"]);
if (!guardedBases.has(baseRef)) {
  console.log(`Policy guard: base '${baseRef}' is out of scope, skipping.`);
  process.exit(0);
}

const errors = [];
const changedFiles = getChangedFiles(baseRef);

if (changedFiles.length === 0) {
  console.log("Policy guard: no changed files.");
  process.exit(0);
}

const hasStatusUpdate = changedFiles.some((file) => file.startsWith("docs/09-status/"));
if (!hasStatusUpdate) {
  errors.push("Missing status documentation update in 'docs/09-status/'.");
}

const promotionRecordPattern = /^docs\/09-status\/promotions\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/;
const hasPromotionRecord = changedFiles.some((file) => promotionRecordPattern.test(file));

if ((baseRef === "staging" || baseRef === "main") && !hasPromotionRecord) {
  errors.push(
    `PR to '${baseRef}' must include a promotion record in docs/09-status/promotions/ (YYYY-MM-DD-<from>-to-<to>-<slug>.md).`,
  );
}

if (baseRef === "staging" || baseRef === "main") {
  const forbiddenPromotionPaths = ["app/(prototype)", "src/lib/mock"];
  const badPaths = changedFiles.filter((file) => matchesAnyPrefix(file, forbiddenPromotionPaths));
  if (badPaths.length > 0) {
    errors.push(
      `PR to '${baseRef}' cannot modify prototype/mock sources (${badPaths.join(", ")}). Move those changes to a dedicated proto-sync PR.`,
    );
  }
}

const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const codeRoots = ["app", "src", "components"];
const codeExclusions = ["app/(prototype)", "src/lib/mock", ".github", "docs", "scripts"];
const envIdentifierRegex =
  /\b(?:PROTO|STAGING|PROD|TEST|DEV)(?:_[A-Z0-9_]+|[A-Z][A-Za-z0-9_]*)\b|\b(?:proto|staging|prod|test|dev)(?:[A-Z_][A-Za-z0-9_]*)\b/g;

for (const file of changedFiles) {
  const ext = path.extname(file);
  if (!codeExtensions.has(ext)) continue;
  if (!codeRoots.some((root) => file === root || file.startsWith(`${root}/`))) continue;
  if (matchesAnyPrefix(file, codeExclusions)) continue;

  const addedLines = getAddedLinesForFile(baseRef, file);
  const violatingLines = addedLines.filter((line) => envIdentifierRegex.test(line));
  envIdentifierRegex.lastIndex = 0;

  if (violatingLines.length > 0) {
    errors.push(
      `Environment naming found in app code '${file}'. Use neutral domain names (ports/adapters) instead of env-based identifiers.`,
    );
  }

  const absolute = path.resolve(process.cwd(), file);
  if (!fs.existsSync(absolute)) continue;
  const content = fs.readFileSync(absolute, "utf8");
  const importsPrototype = /(from\s+["'][^"']*\(prototype\)[^"']*["'])|(href\s*=\s*["']\/(?:proto-shell|prototype))/g;
  if (importsPrototype.test(content)) {
    errors.push(`Runtime file '${file}' references prototype-only routes/imports.`);
  }
}

if (errors.length > 0) {
  fail(errors);
}

console.log("Policy guard passed.");
