#!/usr/bin/env node
/**
 * Načte prvních 20 řádků z view "Lodičky dítěte" a ze zdrojové tabulky "Osobní lodičky",
 * vypíše sloupce + ukázkové hodnoty – podle čeho filtrovat.
 * Použití: node scripts/inspect-lodicky-20-rows.mjs
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

async function fetchTableInfo(tableId, label, query) {
  const colUrl = `${base}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/columns`;
  let rowUrl = `${base}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows?limit=20`;
  if (query) rowUrl += `&query=${encodeURIComponent(query)}`;

  const colRes = await fetch(colUrl, { headers });
  const rowRes = await fetch(rowUrl, { headers });

  const colOk = colRes.ok;
  const rowOk = rowRes.ok;
  const cols = colOk ? (await colRes.json()).items ?? [] : [];
  let rows = [];
  let rowError = null;
  if (rowOk) {
    const data = await rowRes.json();
    rows = data.items ?? [];
  } else {
    rowError = `${rowRes.status} ${await rowRes.text()}`;
  }

  return { label, tableId, cols, rows, rowError };
}

function printTable({ label, tableId, cols, rows, rowError }) {
  const idToName = {};
  cols.forEach((c) => {
    idToName[c.id] = c.name || c.id;
  });

  console.log(`\n${"=".repeat(60)}`);
  console.log(`${label} (${tableId})`);
  console.log("=".repeat(60));

  console.log("\nSloupce (id -> název):");
  cols.forEach((c) => console.log(`  ${c.id}  ->  ${c.name || "(bez názvu)"}`));

  if (rowError) {
    console.log("\nŘádky: CHYBA –", rowError);
    return;
  }

  console.log("\nPočet načtených řádků:", rows.length);

  if (rows.length === 0) return;

  console.log("\nPrvní 2 řádky – hodnoty (název: hodnota):");
  for (let i = 0; i < Math.min(2, rows.length); i++) {
    const row = rows[i];
    console.log(`\n  --- Řádek ${i + 1} (id: ${row.id}) ---`);
    const values = row.values || {};
    for (const [colId, val] of Object.entries(values)) {
      const name = idToName[colId] || colId;
      const preview = typeof val === "object" && val !== null ? JSON.stringify(val) : String(val);
      const short = preview.length > 100 ? preview.slice(0, 97) + "..." : preview;
      console.log(`    ${name}: ${short}`);
    }
  }

  const jmenoCol = cols.find((c) => (c.name || "").toLowerCase().replace(/\s+/g, "") === "jméno" || (c.name || "").toLowerCase() === "jmeno");
  const zakCol = cols.find((c) => (c.name || "").toLowerCase().includes("žák") || (c.name || "").toLowerCase().includes("zak"));
  const osobaCol = cols.find((c) => (c.name || "").toLowerCase().includes("osoba"));
  if (jmenoCol || zakCol || osobaCol) {
    console.log("\nSloupec vhodný pro filtr (Jméno/Žák/Osoba):");
    for (const col of [jmenoCol, zakCol, osobaCol].filter(Boolean)) {
      const sample = rows[0]?.values?.[col.id];
      console.log(`  ${col.name} (id: ${col.id}): ukázka = ${JSON.stringify(sample)}`);
    }
  }
}

async function main() {
  const viewId = "table-RuXGEEn2z4";
  const sourceId = "grid-3m-_XP8oMp";

  console.log("Načítám view Lodičky dítěte (bez filtru)...");
  const viewInfo = await fetchTableInfo(viewId, "View: Lodičky dítěte", null);
  printTable(viewInfo);

  console.log("\nNačítám zdrojovou tabulku Osobní lodičky (limit 20, bez filtru)...");
  const sourceInfo = await fetchTableInfo(sourceId, "Zdroj: Osobní lodičky", null);
  printTable(sourceInfo);

  console.log("\nZkouším zdrojovou tabulku S filtrem query (Jméno obsahuje něco)...");
  const colsRes = await fetch(
    `${base}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(sourceId)}/columns`,
    { headers }
  );
  const cols = colsRes.ok ? (await colsRes.json()).items ?? [] : [];
  const jmenoCol = cols.find((c) => (c.name || "").toLowerCase().replace(/\s+/g, "") === "jméno" || (c.name || "").toLowerCase() === "jmeno");
  if (jmenoCol) {
    const queryWithText = `${jmenoCol.id}:"Viktorka"`;
    const withFilter = await fetchTableInfo(sourceId, "Zdroj s query: " + queryWithText, queryWithText);
    printTable(withFilter);
  }

  const idZakaCol = cols.find((c) => (c.name || "").toLowerCase().includes("id žáka"));
  if (idZakaCol) {
    console.log("\nZkouším filtr podle ID žáka (497)...");
    const queryById = `${idZakaCol.id}:497`;
    const withIdFilter = await fetchTableInfo(sourceId, "Zdroj s query: " + queryById, queryById);
    printTable(withIdFilter);
  }
}

main().catch(console.error);
