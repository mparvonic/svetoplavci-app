#!/usr/bin/env node
/**
 * Ověří, která tabulka s lodičkami vrací řádky a má sloupec Jméno.
 * Použití: node scripts/test-lodicky-rows.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvLocal() {
  const path = join(root, ".env.local");
  const content = readFileSync(path, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnvLocal();
const docId = env.CODA_DOC_ID;
const token = env.CODA_API_TOKEN;
const base = "https://coda.io/apis/v1";
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const CANDIDATES = [
  { id: "table-RuXGEEn2z4", name: "Lodičky dítěte" },
  { id: "table-E8XnaMNtfK", name: "Osobní lodičky v tabulce" },
  { id: "grid-3m-_XP8oMp", name: "Osobní lodičky" },
];

async function main() {
  for (const t of CANDIDATES) {
    const colUrl = `${base}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(t.id)}/columns`;
    const rowUrl = `${base}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(t.id)}/rows?limit=5`;
    const colRes = await fetch(colUrl, { headers });
    const rowRes = await fetch(rowUrl, { headers });
    const colOk = colRes.ok;
    const rowOk = rowRes.ok;
    const cols = colOk ? (await colRes.json()).items ?? [] : [];
    const rows = rowOk ? (await rowRes.json()).items ?? [] : [];
    const hasJmeno = cols.some((c) => (c.name || "").toLowerCase() === "jméno");
    const jmenoCol = cols.find((c) => (c.name || "").toLowerCase() === "jméno");
    console.log(`${t.name} (${t.id}):`);
    console.log(`  columns: ${cols.length}, has Jméno: ${hasJmeno}${jmenoCol ? " (id: " + jmenoCol.id + ")" : ""}`);
    console.log(`  rows (limit 5): ${rows.length}`);
    if (rows.length > 0 && rows[0].values && jmenoCol) {
      const val = rows[0].values[jmenoCol.id];
      console.log(`  první řádek Jméno value:`, JSON.stringify(val));
    }
    console.log("");
  }
}

main().catch(console.error);
