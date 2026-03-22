#!/usr/bin/env node
/**
 * Kompletní snapshot Coda dokumentu: všechny tabulky, sloupce (včetně typu, vzorců), relace.
 * Výstup: docs/coda-doc-snapshot.json a docs/coda-doc-snapshot.md
 * Použití: node scripts/coda-doc-snapshot.mjs
 * Vyžaduje .env.local s CODA_DOC_ID a CODA_API_TOKEN.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
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

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json();
}

async function listAllTables(base, docId, headers) {
  const out = [];
  let pageToken;
  do {
    const url = `${base}/docs/${encodeURIComponent(docId)}/tables?limit=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const data = await fetchJson(url, headers);
    out.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

async function listAllColumns(base, docId, tableId, headers) {
  const out = [];
  let pageToken;
  do {
    const url = `${base}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/columns?limit=100&visibleOnly=false${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const data = await fetchJson(url, headers);
    out.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

async function getColumn(base, docId, tableId, columnId, headers) {
  const url = `${base}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/columns/${encodeURIComponent(columnId)}`;
  return fetchJson(url, headers);
}

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

  const snapshot = {
    docId,
    generatedAt: new Date().toISOString(),
    tables: [],
    envTableIds: {
      CODA_TABLE_SEZNAM_OSOB: env.CODA_TABLE_SEZNAM_OSOB || "grid-PIwfgW7bQU",
      CODA_TABLE_HODNOCENI_PREDMETU: env.CODA_TABLE_HODNOCENI_PREDMETU || "table-oCLreazO22",
      CODA_TABLE_HODNOCENI_OBLASTI: env.CODA_TABLE_HODNOCENI_OBLASTI || "table-NbDPhMF4ci",
      CODA_TABLE_CURVE: env.CODA_TABLE_CURVE || null,
      CODA_VIEW_1_ROCNIK: env.CODA_VIEW_1_ROCNIK || null,
      CODA_VIEW_2_ROCNIK: env.CODA_VIEW_2_ROCNIK || null,
      CODA_VIEW_3_ROCNIK: env.CODA_VIEW_3_ROCNIK || null,
      CODA_VIEW_4_ROCNIK: env.CODA_VIEW_4_ROCNIK || null,
      CODA_VIEW_5_ROCNIK: env.CODA_VIEW_5_ROCNIK || null,
      CODA_VIEW_6_ROCNIK: env.CODA_VIEW_6_ROCNIK || null,
      CODA_VIEW_7_ROCNIK: env.CODA_VIEW_7_ROCNIK || null,
      CODA_VIEW_8_ROCNIK: env.CODA_VIEW_8_ROCNIK || null,
      CODA_VIEW_9_ROCNIK: env.CODA_VIEW_9_ROCNIK || null,
    },
  };

  console.log("Načítám seznam tabulek...");
  const tables = await listAllTables(base, docId, headers);
  console.log(`Nalezeno ${tables.length} tabulek/view.`);

  for (const table of tables) {
    const tableId = table.id;
    const tableName = table.name || tableId;
    const tableType = table.tableType || "table";
    console.log(`  Tabulka: ${tableName} (${tableId}, ${tableType})`);

    let columns = [];
    try {
      columns = await listAllColumns(base, docId, tableId, headers);
    } catch (e) {
      snapshot.tables.push({
        id: tableId,
        name: tableName,
        tableType,
        href: table.href,
        parentTable: table.parentTable,
        error: e.message,
        columns: [],
      });
      continue;
    }

    const columnsWithDetail = [];
    for (const col of columns) {
      const colBase = { id: col.id, name: col.name, display: col.display, calculated: col.calculated };
      if (col.formula != null) colBase.formula = col.formula;
      if (col.defaultValue != null) colBase.defaultValue = col.defaultValue;
      if (col.format != null) colBase.format = col.format;
      columnsWithDetail.push(colBase);
    }

    snapshot.tables.push({
      id: tableId,
      name: tableName,
      tableType,
      href: table.href,
      parentTable: table.parentTable,
      parent: table.parent,
      rowCount: table.rowCount,
      displayColumn: table.displayColumn,
      columns: columnsWithDetail,
    });
  }

  const docsDir = join(root, "docs");
  mkdirSync(docsDir, { recursive: true });
  const jsonPath = join(docsDir, "coda-doc-snapshot.json");
  writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`\nZapsáno: ${jsonPath}`);

  const md = buildMarkdown(snapshot);
  const mdPath = join(docsDir, "coda-doc-snapshot.md");
  writeFileSync(mdPath, md, "utf8");
  console.log(`Zapsáno: ${mdPath}`);
}

function buildMarkdown(snapshot) {
  const lines = [];
  lines.push("# Snapshot Coda dokumentu pro migraci do Supabase");
  lines.push("");
  lines.push("**Dokument ID:** `" + snapshot.docId + "`  ");
  lines.push("**Vygenerováno:** " + snapshot.generatedAt);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 1. Přehled tabulek");
  lines.push("");
  lines.push("| ID | Název | Typ | Počet sloupců | Poznámka |");
  lines.push("|----|-------|-----|----------------|----------|");

  for (const t of snapshot.tables) {
    const colCount = Array.isArray(t.columns) ? t.columns.length : 0;
    const note = t.tableType === "view" ? "view" : "base table";
    lines.push("| `" + t.id + "` | " + escapeMd(t.name) + " | " + (t.tableType || "table") + " | " + colCount + " | " + note + " |");
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 2. Env proměnné (mapování tabulek)");
  lines.push("");
  lines.push("| Proměnná | Hodnota (ID tabulky/view) |");
  lines.push("|----------|---------------------------|");
  for (const [key, val] of Object.entries(snapshot.envTableIds)) {
    lines.push("| `" + key + "` | " + (val == null ? "—" : "`" + val + "`") + " |");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 3. Struktura tabulek a sloupců");
  lines.push("");

  for (const t of snapshot.tables) {
    lines.push("### " + escapeMd(t.name) + " (`" + t.id + "`)");
    lines.push("");
    if (t.error) {
      lines.push("*Chyba načtení: " + t.error + "*");
      lines.push("");
      continue;
    }
    lines.push("| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |");
    lines.push("|------------------|-----|----------|------------|---------------------------|---------------|");
    const cols = t.columns || [];
    for (const c of cols) {
      const formulaCell = [c.formula, c.defaultValue].filter(Boolean).join(" / ") || "—";
      const formatType = c.format && typeof c.format === "object" ? (c.format.type || JSON.stringify(c.format)) : (c.format || "—");
      lines.push("| " + escapeMd(c.name) + " | `" + c.id + "` | " + (c.display ? "ano" : "ne") + " | " + (c.calculated ? "ano" : "ne") + " | " + escapeMd(String(formulaCell).slice(0, 60)) + " | " + escapeMd(String(formatType)) + " |");
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## 4. Relace (identifikované z kódu aplikace)");
  lines.push("");
  lines.push("Následující vztahy jsou použity v `src/lib/coda.ts` a API:");
  lines.push("");
  lines.push("| Tabulka | Sloupec | Odkazuje na | Popis |");
  lines.push("|---------|---------|-------------|--------|");
  lines.push("| Seznam osob | **Děti** | Seznam osob (řádky) | Relation: rodič → děti |");
  lines.push("| Seznam osob | **Rodič(e)** | Seznam osob (řádky) | Fallback pro přiřazení rodič–dítě |");
  lines.push("| Lodičky dítěte / Lodičky po plavbách / Hodnocení předmětů / Hodnocení oblastí | **Jméno** (nebo osoba/žák) | Seznam osob | Filtrování řádků podle dítěte |");
  lines.push("| Lodičky dítěte (view) | — | Osobní lodičky (base) | View podle ročníku (CODA_VIEW_1_ROCNIK … 9) |");
  lines.push("");
  lines.push("Pro migraci do Supabase: tyto relation sloupce nahradit cizími klíči (např. `parent_id`, `child_id`, `person_id`) odkazujícími na primární klíč odpovídající tabulky.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 5. Sloupce s vzorci (calculated / formula)");
  lines.push("");
  let hasFormula = false;
  for (const t of snapshot.tables) {
    const withFormula = (t.columns || []).filter((c) => c.calculated || c.formula);
    if (withFormula.length) {
      hasFormula = true;
      lines.push(`### ${escapeMd(t.name)}`);
      lines.push("");
      for (const c of withFormula) {
        lines.push("- **" + escapeMd(c.name) + "** (`" + c.id + "`): `" + escapeMd(String(c.formula || c.defaultValue || "")) + "`");
      }
      lines.push("");
    }
  }
  if (!hasFormula) {
    lines.push("*Žádné sloupce se vzorci v tomto snapshotu (nebo list columns nevrací formula). Pro plný detail použijte Get column API pro každý sloupec.*");
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push("## 6. Doporučení pro migraci do Supabase");
  lines.push("");
  lines.push("1. **Base tabulky** z Coda mapovat na PostgreSQL tabulky; **view** buď jako materializované view, nebo dotazy v aplikaci.");
  lines.push("2. **Relation sloupce** (Děti, Rodič, Jméno → osoba) nahradit FK na `seznam_osob(id)` resp. odpovídající entity.");
  lines.push("3. **Vzorce (calculated columns)** v Coda převést na generované sloupce v PostgreSQL, trigger nebo výpočet v aplikaci.");
  lines.push("4. **Multi-select / Select list** (např. Role, Kontaktní maily) uložit jako pole (`text[]`) nebo normalizovanou tabulku.");
  lines.push("5. **Křivka plnění** (CODA_TABLE_CURVE): jedna tabulka s sloupci Ročník, Pololetí, Stupeň, Období, Norma, Norma zkrácená.");
  lines.push("");
  return lines.join("\n");
}

function escapeMd(s) {
  if (s == null) return "";
  return String(s)
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
