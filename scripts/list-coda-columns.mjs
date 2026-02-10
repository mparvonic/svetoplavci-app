#!/usr/bin/env node
/**
 * Načte sloupce všech 4 tabulek z Coda API (včetně skrytých).
 * Použití: node scripts/list-coda-columns.mjs
 * Vyžaduje .env.local s CODA_DOC_ID a CODA_API_TOKEN.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvLocal() {
  try {
    const path = join(root, ".env.local");
    const content = readFileSync(path, "utf8");
    const env = {};
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return env;
  } catch (e) {
    console.error("Nelze načíst .env.local:", e.message);
    process.exit(1);
  }
}

const CHILD_TABLES = [
  { id: "table-RuXGEEn2z4", name: "Lodičky dítěte" },
  { id: "table-1wVyfFAjX2", name: "Lodičky po plavbách" },
  { id: "table-oCLreazO22", name: "Hodnocení předmětů" },
  { id: "table-NbDPhMF4ci", name: "Hodnocení oblastí" },
];

async function main() {
  const env = loadEnvLocal();
  const docId = env.CODA_DOC_ID;
  const token = env.CODA_API_TOKEN;
  if (!docId || !token) {
    console.error("V .env.local chybí CODA_DOC_ID nebo CODA_API_TOKEN.");
    process.exit(1);
  }

  const base = "https://coda.io/apis/v1";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Seznam všech tabulek a view v dokumentu (pro hledání zdrojové tabulky)
  try {
    const listUrl = `${base}/docs/${encodeURIComponent(docId)}/tables?limit=50`;
    const listRes = await fetch(listUrl, { headers });
    if (listRes.ok) {
      const listData = await listRes.json();
      const tablesList = listData.items ?? [];
      const lodicky = tablesList.filter((t) => /lodič|lodick|boat/i.test(t.name || ""));
      console.log("=== Tabulky/view v docu (obsahující 'lodič') ===\n");
      lodicky.forEach((t) => console.log(t.id, t.name));
      console.log("\n");
    }
  } catch (e) {
    console.log("List tables error:", e.message, "\n");
  }

  const tables = [
    ...CHILD_TABLES,
    { id: (env.CODA_TABLE_SEZNAM_OSOB && env.CODA_TABLE_SEZNAM_OSOB.trim()) || "grid-PIwfgW7bQU", name: "Seznam osob" },
  ];
  const result = {};
  for (const table of tables) {
    const url = `${base}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(table.id)}/columns`;
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        result[table.name] = { error: `${res.status} ${res.statusText}`, body: await res.text() };
        continue;
      }
      const data = await res.json();
      const items = data.items ?? [];
      result[table.name] = items.map((col) => ({ id: col.id, name: col.name }));
    } catch (e) {
      result[table.name] = { error: e.message };
    }
  }

  console.log("=== Sloupce (list columns) ===\n");
  console.log(JSON.stringify(result, null, 2));

  // Test: list rows z Lodičky dítěte – klíče a ukázka hodnoty Jméno (relation)
  const firstTable = CHILD_TABLES[0];
  const rowsUrl = `${base}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(firstTable.id)}/rows?limit=100`;
  try {
    const rowsRes = await fetch(rowsUrl, { headers });
    if (rowsRes.ok) {
      const rowsData = await rowsRes.json();
      const items = rowsData.items ?? [];
      const cols = result[firstTable.name];
      const colNameToId = {};
      if (Array.isArray(cols)) for (const c of cols) colNameToId[c.name.toLowerCase()] = c.id;
      const jmenoColId = colNameToId["jméno"] || colNameToId["jmeno"];
      console.log("\n=== Lodičky dítěte: sloupce (id -> name) ===\n");
      if (Array.isArray(cols)) console.log(JSON.stringify(cols, null, 2));
      console.log("\n=== Počet řádků (limit 100) ===\n", items.length);
      if (rowsData.nextPageToken) console.log("nextPageToken:", rowsData.nextPageToken);
      if (items.length > 0 && items[0].values) {
        const valueKeys = Object.keys(items[0].values);
        console.log("\n=== Klíče v row.values (první řádek) ===\n", valueKeys);
        if (jmenoColId && items[0].values[jmenoColId] !== undefined) {
          console.log("\n=== Hodnota sloupce Jméno (relation) – první řádek ===\n");
          console.log(JSON.stringify(items[0].values[jmenoColId], null, 2));
        }
        console.log("\n=== Celý values prvního řádku (pro kontrolu) ===\n");
        console.log(JSON.stringify(items[0].values, null, 2));
      }
    } else {
      console.log("\nList rows failed:", rowsRes.status, await rowsRes.text());
    }
  } catch (e) {
    console.log("\nList rows error:", e.message);
  }
}

main();
