#!/usr/bin/env node
/**
 * Vypíše všechny sloupce zdrojové tabulky Osobní lodičky (včetně skrytých).
 * Coda API list columns vrací všechny sloupce – skrytí je jen UI.
 * Použití: node scripts/check-source-table-columns.mjs
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
const headers = { Authorization: `Bearer ${token}` };
const sourceId = "grid-3m-_XP8oMp";

async function main() {
  const url = `${base}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(sourceId)}/columns`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error("Chyba:", res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  const items = data.items ?? [];
  console.log("Sloupce zdrojové tabulky Osobní lodičky (všechny, včetně skrytých):\n");
  const forFilter = [];
  for (const col of items) {
    const name = col.name ?? "(bez názvu)";
    const hidden = col.hidden === true ? " [SKRYTÝ]" : "";
    console.log(`  ${col.id}  ->  ${name}${hidden}`);
    const n = (name || "").toLowerCase();
    if (n.includes("jméno") || n.includes("jmeno") || n.includes("přezdívka") || n.includes("prezdivka")) {
      forFilter.push({ id: col.id, name: name });
    }
  }
  console.log("\nSloupce vhodné pro filtr (Jméno / Přezdívka):");
  forFilter.forEach((c) => console.log(`  ${c.id}  ->  ${c.name}`));
  console.log("\n(Kód hledá nameToId['jméno'] a nameToId['přezdívka'] – lowercase po trim.)");
}

main().catch(console.error);
