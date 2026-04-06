#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

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

function loadEnvFile(fileName) {
  const absolute = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(absolute)) return;
  const parsed = parseDotEnv(fs.readFileSync(absolute, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function parseDotEnv(content) {
  const result = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    const valueRaw = line.slice(eqIndex + 1).trim();
    const value =
      (valueRaw.startsWith("\"") && valueRaw.endsWith("\"")) ||
      (valueRaw.startsWith("'") && valueRaw.endsWith("'"))
        ? valueRaw.slice(1, -1)
        : valueRaw;
    result[key] = value;
  }
  return result;
}

function splitCsv(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fail(message, details = []) {
  console.error("\nLocal DB safety guard blocked startup.\n");
  console.error(message);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  console.error("\nSet ALLOW_UNSAFE_DB=1 only for explicit emergency override.");
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

if (args.help === "true") {
  console.log(`Usage:\n  node scripts/db/assert-safe-local-db.mjs [--url <postgres-url>]\n\nChecks that local dev DB URL is not production.`);
  process.exit(0);
}

if (!args.url) {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
}

const dbUrlRaw = args.url ?? process.env.POSTGRES_PRISMA_URL;

if (!dbUrlRaw) {
  console.log("Local DB safety guard: POSTGRES_PRISMA_URL not set, skipping.");
  process.exit(0);
}

if (process.env.ALLOW_UNSAFE_DB === "1" || args.allowUnsafe === "true") {
  console.warn("Local DB safety guard bypassed via override.");
  process.exit(0);
}

let parsed;
try {
  parsed = new URL(dbUrlRaw);
} catch {
  fail("POSTGRES_PRISMA_URL is not a valid URL.", ["Fix .env.local or pass --url for diagnostics."]);
}

const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, "").trim());
const host = parsed.hostname.toLowerCase();
const rawLower = dbUrlRaw.toLowerCase();

const forbiddenDbNames = splitCsv(process.env.DB_FORBIDDEN_DATABASES ?? "svetoplavci_prod");
const forbiddenHostSubstrings = splitCsv(process.env.DB_FORBIDDEN_HOST_SUBSTRINGS ?? "");
const forbiddenUrlSubstrings = splitCsv(process.env.DB_FORBIDDEN_URL_SUBSTRINGS ?? "");

const violations = [];

if (forbiddenDbNames.some((name) => name.toLowerCase() === dbName.toLowerCase())) {
  violations.push(`Database '${dbName}' is forbidden for local dev.`);
}

for (const fragment of forbiddenHostSubstrings) {
  if (host.includes(fragment.toLowerCase())) {
    violations.push(`Host '${host}' matches forbidden fragment '${fragment}'.`);
  }
}

for (const fragment of forbiddenUrlSubstrings) {
  if (rawLower.includes(fragment.toLowerCase())) {
    violations.push(`Connection URL contains forbidden fragment '${fragment}'.`);
  }
}

if (/\bsvetoplavci_prod\b/i.test(rawLower)) {
  violations.push("Connection string references production database name marker 'svetoplavci_prod'.");
}

if (violations.length > 0) {
  fail("Local development cannot run against production DB.", violations);
}

console.log(`Local DB safety guard passed: host=${host}, db=${dbName || "<unknown>"}`);
