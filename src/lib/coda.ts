/**
 * Helper pro komunikaci s Coda API v1
 * @see https://coda.io/developers/apis/v1
 */

import type { CodaParent, CodaChild } from "@/src/types/coda";

const CODA_API_BASE = "https://coda.io/apis/v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minut

function getDocId(): string {
  const id = process.env.CODA_DOC_ID;
  if (!id) throw new Error("CODA_DOC_ID není nastaven v prostředí.");
  return id;
}

function getTableSeznamOsob(): string {
  return process.env.CODA_TABLE_SEZNAM_OSOB ?? "grid-PIwfgW7bQU";
}

type CacheEntry<T> = { data: T; expires: number };
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry || Date.now() > entry.expires) return null;
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

function getHeaders(): HeadersInit {
  const token = process.env.CODA_API_TOKEN;
  if (!token) {
    throw new Error("CODA_API_TOKEN není nastaven v prostředí.");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/** Buňka řádku – sloupec může být ID nebo název sloupce */
export interface CodaCell {
  column: string;
  value: string | number | boolean | null;
}

/** Řádek z Coda API (odpověď list rows) */
export interface CodaRow {
  id: string;
  type: "row";
  href: string;
  name: string;
  index: number;
  createdAt: string;
  updatedAt: string;
  values: Record<string, unknown>;
}

/** Odpověď na list rows */
export interface CodaListRowsResponse {
  items: CodaRow[];
  href?: string;
  nextPageToken?: string;
  nextPageLink?: string;
}

/** Sloupec z Coda API (list columns) */
interface CodaColumn {
  id: string;
  name: string;
}

interface ColumnMaps {
  nameToId: Record<string, string>;
  idToName: Record<string, string>;
}

async function getTableColumnMaps(
  docId: string,
  tableIdOrName: string
): Promise<ColumnMaps> {
  const cacheKey = `columnMaps:${docId}:${tableIdOrName}`;
  const cached = getCached<ColumnMaps>(cacheKey);
  if (cached) return cached;

  const url = `${CODA_API_BASE}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableIdOrName)}/columns`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Coda API list columns failed ${res.status}: ${err}`);
  }
  const data = (await res.json()) as { items: CodaColumn[] };
  const nameToId: Record<string, string> = {};
  const idToName: Record<string, string> = {};
  for (const col of data.items ?? []) {
    if (col.name) {
      const trimmed = col.name.trim();
      nameToId[trimmed.toLowerCase()] = col.id;
      idToName[col.id] = trimmed;
    }
  }
  const maps = { nameToId, idToName };
  setCache(cacheKey, maps);
  return maps;
}

/** Načte sloupce tabulky a vrátí mapu název (lowercase) -> id */
async function getColumnNameToIdMap(
  docId: string,
  tableIdOrName: string
): Promise<Record<string, string>> {
  const { nameToId } = await getTableColumnMaps(docId, tableIdOrName);
  return nameToId;
}

/** Vrátí hodnotu z row.values podle názvu sloupce (použije mapu name->id) */
function getRowValue(
  values: Record<string, unknown>,
  columnName: string,
  nameToId: Record<string, string>
): unknown {
  const id = nameToId[columnName.trim().toLowerCase()];
  if (id && values[id] !== undefined) return values[id];
  return values[columnName] ?? values[columnName.trim()];
}

/** Vrátí první nenulovou hodnotu z řádku pro jeden z uvedených názvů sloupců (např. různé názvy v různých Coda docích). */
function getRowValueFirst(
  values: Record<string, unknown>,
  nameToId: Record<string, string>,
  columnNames: string[]
): unknown {
  for (const name of columnNames) {
    const v = getRowValue(values, name, nameToId);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/** Parametry pro získání řádků */
export interface ListRowsOptions {
  /** Maximální počet řádků (default dle API) */
  limit?: number;
  /** Token pro další stránku */
  pageToken?: string;
  /** Filtrovací dotaz (query) */
  query?: string;
  /** Seřazení, např. "columnId" nebo "-columnId" pro sestupně */
  sortBy?: string;
}

/**
 * Získá řádky z tabulky Coda dokumentu.
 * @param docId ID dokumentu (např. z URL Coda doc)
 * @param tableIdOrName ID nebo název tabulky
 */
export async function getTableRows(
  docId: string,
  tableIdOrName: string,
  options: ListRowsOptions = {}
): Promise<CodaListRowsResponse> {
  const params = new URLSearchParams();
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.pageToken) params.set("pageToken", options.pageToken);
  if (options.query) params.set("query", options.query);
  if (options.sortBy) params.set("sortBy", options.sortBy);

  const url = `${CODA_API_BASE}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableIdOrName)}/rows?${params}`;
  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Coda API getTableRows failed ${res.status}: ${err}`);
  }

  return res.json() as Promise<CodaListRowsResponse>;
}

/** Načte všechny řádky tabulky (po stránkách) a uloží do cache. */
export async function getTableRowsAll(docId: string, tableId: string): Promise<CodaRow[]> {
  const cacheKey = `tableRows:${docId}:${tableId}`;
  const cached = getCached<CodaRow[]>(cacheKey);
  if (cached) return cached;

  const all: CodaRow[] = [];
  let pageToken: string | undefined;
  do {
    const res = await getTableRows(docId, tableId, { limit: 200, pageToken });
    all.push(...res.items);
    pageToken = res.nextPageToken;
  } while (pageToken);
  setCache(cacheKey, all);
  return all;
}

/** Jeden řádek k vložení (pole buněk) */
export interface RowToInsert {
  cells: CodaCell[];
}

/** Odpověď na insert/upsert rows – API vrací 202 Accepted */
export interface CodaInsertRowsResponse {
  id?: string;
  requestId?: string;
  rowIds?: string[];
}

/**
 * Přidá jeden nebo více řádků do tabulky.
 * @param docId ID dokumentu
 * @param tableIdOrName ID nebo název tabulky (musí být base table, ne view)
 * @param rows Pole řádků, každý s polem cells
 * @param keyColumns Pro upsert: názvy sloupců tvořících klíč (pokud řádek existuje, bude aktualizován)
 */
export async function addTableRows(
  docId: string,
  tableIdOrName: string,
  rows: RowToInsert[],
  keyColumns?: string[]
): Promise<CodaInsertRowsResponse> {
  const body: { rows: RowToInsert[]; keyColumns?: string[] } = { rows };
  if (keyColumns?.length) body.keyColumns = keyColumns;

  const url = `${CODA_API_BASE}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableIdOrName)}/rows`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Coda API addTableRows failed ${res.status}: ${err}`);
  }

  return res.json() as Promise<CodaInsertRowsResponse>;
}

/** Odpověď na update row – API vrací 202 Accepted */
export interface CodaUpdateRowResponse {
  requestId?: string;
}

/**
 * Aktualizuje existující řádek v tabulce.
 * @param docId ID dokumentu
 * @param tableIdOrName ID nebo název tabulky
 * @param rowIdOrName ID nebo název řádku
 * @param cells Buňky k aktualizaci (sloupec -> hodnota)
 */
export async function updateTableRow(
  docId: string,
  tableIdOrName: string,
  rowIdOrName: string,
  cells: CodaCell[]
): Promise<CodaUpdateRowResponse> {
  const url = `${CODA_API_BASE}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableIdOrName)}/rows/${encodeURIComponent(rowIdOrName)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ row: { cells } }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Coda API updateTableRow failed ${res.status}: ${err}`);
  }

  return res.json() as Promise<CodaUpdateRowResponse>;
}

// --- Rodiče a děti (Seznam osob) ---

function parseContactEmails(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function parseRoles(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((r) => String(r).trim()).filter(Boolean);
  }
  if (typeof raw !== "string") return [];
  return raw.split(",").map((r) => r.trim()).filter(Boolean);
}

function hasRole(roles: string[], role: string): boolean {
  const want = role.trim().toLowerCase();
  return roles.some((r) => r.trim().toLowerCase() === want);
}

/** Relation položka z Coda (sloupec Děti) – API vrací id, type, href */
interface CodaRelationItem {
  name?: string;
  id?: string;
  rowId?: string;
  tableId?: string;
  href?: string;
}

function extractRowIdFromHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const m = href.match(/\/rows\/([^/?#]+)/);
  return m ? m[1] : null;
}

function getRelationItems(raw: unknown): CodaRelationItem[] {
  if (Array.isArray(raw)) {
    const result: CodaRelationItem[] = [];
    for (const item of raw) {
      if (item == null) continue;
      if (typeof item === "string") {
        result.push({ id: item, rowId: item });
        continue;
      }
      if (typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const id =
        (obj.rowId ?? obj.id ?? extractRowIdFromHref(obj.href))?.toString() ?? "";
      if (id) result.push({ ...obj, id, rowId: id, name: (obj.name as string) ?? "" });
    }
    return result;
  }
  if (raw != null && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const id =
      (obj.rowId ?? obj.id ?? extractRowIdFromHref(obj.href))?.toString() ?? "";
    if (id) return [{ ...obj, id, rowId: id, name: (obj.name as string) ?? "" }];
  }
  return [];
}

/** Parsuje „Děti“ jako čárkou oddělený text jmen/přezdívek (CSV export má Děti jako text). */
function parseChildrenNamesRaw(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Ze seznamu všech řádků najde ty, jejichž Přezdívka nebo Jméno je v seznamu names
 * (porovnání bez diakritiky a case-insensitive pro robustnost).
 */
function findRowsByNames(
  allRows: CodaRow[],
  names: string[],
  nameToId: Record<string, string>
): CodaRelationItem[] {
  const normalizedNames = new Set(
    names.map((n) => n.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""))
  );
  const result: CodaRelationItem[] = [];
  for (const row of allRows) {
    const values = row.values as Record<string, unknown>;
    const jmeno = String(getRowValue(values, "Jméno", nameToId) ?? row.name ?? "").trim();
    const prezdivka = String(getRowValue(values, "Přezdívka", nameToId) ?? "").trim();
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
    if (!jmeno && !prezdivka) continue;
    const match =
      normalizedNames.has(norm(jmeno)) ||
      (prezdivka ? normalizedNames.has(norm(prezdivka)) : false);
    if (match) {
      result.push({
        id: row.id,
        rowId: row.id,
        name: prezdivka || jmeno,
      });
    }
  }
  return result;
}

/** Názvy sloupců pro kontaktní e-maily (různé Coda tabulky mohou používat jiný název) */
const CONTACT_EMAIL_COLUMNS = [
  "Kontaktní maily",
  "Kontaktní email",
  "Kontaktní e-maily",
  "E-mail",
  "Email",
];

/** Názvy sloupců pro aktivní (checkbox / Ano–Ne) */
const AKTIVNI_COLUMNS = ["Aktivní", "Aktivní osoba", "Aktivní?"];

/**
 * Najde rodiče podle emailu v tabulce Seznam osob.
 * Kontroluje: Role obsahuje "Rodič", Aktivní není Ne/false, sloupec s kontakty obsahuje email.
 * Coda API vrací values klíčované podle column ID – načteme sloupce a mapujeme názvy na ID.
 */
export async function findParentByEmail(email: string): Promise<CodaParent | null> {
  const cacheKey = `parent:${email.trim().toLowerCase()}`;
  const cached = getCached<CodaParent>(cacheKey);
  if (cached) return cached;

  const docId = getDocId();
  const tableId = getTableSeznamOsob();
  const nameToId = await getColumnNameToIdMap(docId, tableId);

  const all = await getTableRowsAll(docId, tableId);

  const normalizedEmail = email.trim().toLowerCase();
  for (const row of all) {
    const values = row.values as Record<string, unknown>;

    const roleRaw = getRowValueFirst(values, nameToId, ["Role", "Role v organizaci"]);
    const roles = parseRoles(roleRaw);
    if (!hasRole(roles, "Rodič")) continue;

    const active = getRowValueFirst(values, nameToId, AKTIVNI_COLUMNS);
    const activeStr = String(active ?? "").trim().toLowerCase();
    if (active === false || activeStr === "false" || activeStr === "ne" || activeStr === "no") continue;

    const contactRaw = getRowValueFirst(values, nameToId, CONTACT_EMAIL_COLUMNS);
    const emails = parseContactEmails(contactRaw);
    if (!emails.includes(normalizedEmail)) continue;

    const name =
      (getRowValue(values, "Jméno", nameToId) as string) ?? (row.name ?? "");
    const relationRaw = getRowValue(values, "Děti", nameToId);
    const relationItems = getRelationItems(relationRaw);
    const childrenIds = relationItems.map((item) => ({
      rowId: (item.rowId ?? item.id ?? "").toString(),
      name: (item.name ?? "").toString(),
    })).filter((c) => c.rowId);

    const parent: CodaParent = {
      rowId: row.id,
      name: String(name),
      email: normalizedEmail,
      contactEmails: emails,
      roles,
      childrenIds,
    };
    setCache(cacheKey, parent);
    return parent;
  }
  return null;
}

/** Z relation hodnoty vrátí pole row id (pro sloupec Rodič = odkaz na rodiče) */
function relationContainsRowId(relationRaw: unknown, targetRowId: string): boolean {
  const items = getRelationItems(relationRaw);
  return items.some(
    (item) => (item.rowId ?? item.id)?.toString() === targetRowId
  );
}

/**
 * Načte děti rodiče: ze sloupce Děti (relation), nebo fallback – řádky, kde sloupec Rodič odkazuje na tohoto rodiče.
 */
export async function getChildrenOfParent(parentRowId: string): Promise<CodaChild[]> {
  const cacheKey = `children:${parentRowId}`;
  const cached = getCached<CodaChild[]>(cacheKey);
  if (cached) return cached;

  const docId = getDocId();
  const tableId = getTableSeznamOsob();
  const nameToId = await getColumnNameToIdMap(docId, tableId);

  const parentRowUrl = `${CODA_API_BASE}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(parentRowId)}`;
  const parentRes = await fetch(parentRowUrl, { headers: getHeaders() });
  if (!parentRes.ok) return [];

  const parentData = (await parentRes.json()) as { id: string; values: Record<string, unknown> };
  const detiRaw = getRowValue(parentData.values, "Děti", nameToId);
  let relationItems = getRelationItems(detiRaw);

  if (relationItems.length === 0 && (typeof detiRaw === "string" && detiRaw.trim())) {
    const childNames = parseChildrenNamesRaw(detiRaw);
    if (childNames.length > 0) {
      const all = await getTableRowsAll(docId, tableId);
      relationItems = findRowsByNames(all, childNames, nameToId);
    }
  }

  if (relationItems.length === 0) {
    const all = await getTableRowsAll(docId, tableId);
    const rodicCol = nameToId["rodiče"] ?? nameToId["rodič"] ?? nameToId["rodic"];
    if (rodicCol != null) {
      const parentNameRaw = getRowValue(parentData.values, "Jméno", nameToId);
      const parentPrezdivka = getRowValue(parentData.values, "Přezdívka", nameToId);
      const parentNames = [
        ...parseChildrenNamesRaw(parentNameRaw),
        ...parseChildrenNamesRaw(parentPrezdivka),
      ].filter(Boolean);
      if (parentNames.length > 0) {
        relationItems = all
          .filter((row) => {
            const rodiceRaw = (row.values as Record<string, unknown>)[rodicCol];
            const rodiceStr = typeof rodiceRaw === "string" ? rodiceRaw : Array.isArray(rodiceRaw) ? (rodiceRaw as unknown[]).map(String).join(",") : "";
            const rodiceNames = parseChildrenNamesRaw(rodiceStr);
            const rowNorm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
            const parentNormSet = new Set(parentNames.map(rowNorm));
            return rodiceNames.some((n) => parentNormSet.has(rowNorm(n)));
          })
          .map((row) => ({
            id: row.id,
            rowId: row.id,
            name: String(getRowValue(row.values as Record<string, unknown>, "Jméno", nameToId) ?? row.name ?? ""),
          }));
      }
    }
  }

  if (relationItems.length === 0) {
    setCache(cacheKey, []);
    return [];
  }

  const children: CodaChild[] = [];
  for (const item of relationItems) {
    const rowId = (item.rowId ?? item.id)?.toString();
    if (!rowId) continue;
    const rowUrl = `${CODA_API_BASE}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(rowId)}`;
    const rowRes = await fetch(rowUrl, { headers: getHeaders() });
    if (!rowRes.ok) continue;
    const rowData = (await rowRes.json()) as { id: string; name: string; values: Record<string, unknown> };
    const v = rowData.values;
    children.push({
      rowId: rowData.id,
      name: String(getRowValue(v, "Jméno", nameToId) ?? rowData.name ?? ""),
      nickname: String(getRowValue(v, "Přezdívka", nameToId) ?? ""),
      rocnik: String(getRowValue(v, "Ročník", nameToId) ?? "").trim(),
      currentYear: String(getRowValue(v, "Aktuální", nameToId) ?? ""),
      group: String(getRowValue(v, "Smečka", nameToId) ?? ""),
    });
  }
  setCache(cacheKey, children);
  return children;
}

/**
 * Transformuje row.values z klíčů (column ID) na názvy sloupců (pro zobrazení v UI).
 */
function rowValuesToNameKeys(
  values: Record<string, unknown>,
  idToName: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, val] of Object.entries(values)) {
    const name = idToName[id];
    if (name != null) out[name] = val;
    else out[id] = val;
  }
  return out;
}

/**
 * Pro každou tabulku dítěte: názvy sloupců (lowercase), které odkazují na řádek dítěte v Seznam osob.
 */
const TABLE_RELATION_COLUMNS: Record<string, string[]> = {
  "table-RuXGEEn2z4": ["jméno"],
  "table-1wVyfFAjX2": ["jméno"],
  "table-oCLreazO22": ["jméno"],
  "table-NbDPhMF4ci": ["jméno"],
};

/**
 * View tabulky "Lodičky dítěte" po ročnících (1.–9. ročník).
 * Env: CODA_VIEW_1_ROCNIK, CODA_VIEW_2_ROCNIK, … CODA_VIEW_9_ROCNIK = ID view tabulky v Coda.
 * Když je nastaveno, načítáme z příslušného view místo ze zdrojové tabulky (menší objem dat, API limit OK).
 */
function getViewTableIdForRocnik(rocnik: string): string | undefined {
  const trimmed = (rocnik || "").trim();
  const m = trimmed.match(/^(\d+)/);
  const num = m ? m[1] : "";
  if (!num || Number(num) < 1 || Number(num) > 9) return undefined;
  const id = process.env[`CODA_VIEW_${num}_ROCNIK`];
  return id?.trim() || undefined;
}

/**
 * Zdrojová tabulka pro "Lodičky dítěte" – použije se jen když není view pro ročník (getViewTableIdForRocnik).
 */
const TABLE_ROW_SOURCE: Record<string, string> = {
  "table-RuXGEEn2z4": "grid-3m-_XP8oMp", // Lodičky dítěte -> Osobní lodičky (fallback)
};

const GLOBAL_RELATION_COL_NAMES = [
  "osoba",
  "žák",
  "jméno",
  "jmeno",
  "name",
  "osoba (seznam osob)",
  "žák (seznam osob)",
];

function normalizeForMatch(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Vrátí true, pokud hodnota sloupce Jméno odpovídá dítěti (relation nebo text přezdívka/jméno). */
function jmenoValueMatchesChild(
  rel: unknown,
  childRowId: string,
  childName?: string,
  childNickname?: string
): boolean {
  if (relationContainsRowId(rel, childRowId)) return true;
  if (typeof rel !== "string") return false;
  const normalized = normalizeForMatch(rel);
  if (!normalized) return false;
  const nNick = childNickname ? normalizeForMatch(childNickname) : "";
  const nName = childName ? normalizeForMatch(childName) : "";
  if (nNick && normalized === nNick) return true;
  if (nName && normalized === nName) return true;
  if (nNick && (normalized.includes(nNick) || nNick.includes(normalized))) return true;
  if (nName && (normalized.includes(nName) || nName.includes(normalized))) return true;
  return false;
}

/**
 * Načte řádky z tabulky dítěte. Pro "Lodičky dítěte" (table-RuXGEEn2z4): pokud je childRocnik a máme view pro daný ročník (CODA_VIEW_1_ROCNIK … CODA_VIEW_9_ROCNIK), načítáme z něj; jinak ze zdrojové tabulky Osobní lodičky. Filtruje podle Přezdívka/Jméno nebo relation na childRowId.
 */
export async function getChildTableData(
  tableId: string,
  childRowId: string,
  childName?: string,
  childNickname?: string,
  childRocnik?: string
): Promise<CodaRow[]> {
  const rocnikSuffix = childRocnik ? `:${childRocnik.trim()}` : "";
  const cacheKey = `table:${tableId}:${childRowId}${rocnikSuffix}`;
  const cached = getCached<CodaRow[]>(cacheKey);
  if (cached) return cached;

  const docId = getDocId();
  const isLodickyDite = tableId === "table-RuXGEEn2z4";
  const viewTableId = isLodickyDite && childRocnik ? getViewTableIdForRocnik(childRocnik) : undefined;
  const fetchTableId = viewTableId ?? TABLE_ROW_SOURCE[tableId] ?? tableId;
  const { nameToId, idToName } = await getTableColumnMaps(docId, fetchTableId);

  const useSourceTable = tableId in TABLE_ROW_SOURCE && !viewTableId;
  const useLodickyViewOrSource = useSourceTable || !!viewTableId;
  const searchTerm =
    (childNickname ?? childName)
      ? (childNickname || childName!.split(/\s+/)[0] || "").trim()
      : undefined;

  const jmenoColId = nameToId["jméno"] ?? nameToId["jmeno"];
  const prezdivkaColId = nameToId["přezdívka"] ?? nameToId["prezdivka"];
  const relationColIdForQuery = (() => {
    const tableCols = TABLE_RELATION_COLUMNS[tableId] ?? [];
    const relationColNames = [...new Set([...tableCols, ...GLOBAL_RELATION_COL_NAMES])];
    for (const n of relationColNames) {
      const id = nameToId[n];
      if (id) return id;
    }
    return null;
  })();

  let queryFilter: string | undefined;
  if (useLodickyViewOrSource) {
    if (!searchTerm) {
      setCache(cacheKey, []);
      return [];
    }
    const filterColId = prezdivkaColId ?? jmenoColId;
    queryFilter =
      filterColId && searchTerm
        ? `${filterColId}:"${String(searchTerm).replace(/"/g, '\\"')}"`
        : undefined;
    if (!queryFilter) {
      setCache(cacheKey, []);
      return [];
    }
  } else {
    // Tabulky s relation sloupcem (Jméno) – Coda API při filtru podle row ID často vrací 0 řádků.
    // Načteme všechny řádky a filtrujeme v paměti (jmenoValueMatchesChild: relation i text „Adinka Sch.“).
    if (relationColIdForQuery) {
      queryFilter = undefined;
    } else {
      queryFilter =
        jmenoColId && searchTerm
          ? `${jmenoColId}:"${String(searchTerm).replace(/"/g, '\\"')}"`
          : undefined;
    }
  }

  const all: CodaRow[] = [];
  let pageToken: string | undefined;
  // Bez query načítáme víc stránek (Hodnocení oblastí může mít mnoho řádků).
  const maxPages = queryFilter ? 5 : (useSourceTable ? 50 : 30);
  let pages = 0;
  try {
    do {
      const res = await getTableRows(docId, fetchTableId, {
        limit: 200,
        pageToken,
        ...(queryFilter ? { query: queryFilter } : {}),
      });
      all.push(...res.items);
      pageToken = res.nextPageToken;
      pages++;
    } while (pageToken && pages < maxPages);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("422") || msg.includes("maximum row count")) {
      throw new Error(
        "Tabulka Osobní lodičky překračuje limit Coda API (247 %). Coda odmítá filtrované dotazy na tuto tabulku. Řešení: zmenšit tabulku v Coda nebo kontaktovat Coda podporu."
      );
    }
    throw err;
  }

  const tableCols = TABLE_RELATION_COLUMNS[tableId] ?? [];
  const relationColNames = [...new Set([...tableCols, ...GLOBAL_RELATION_COL_NAMES])];
  let relationColId: string | null = null;
  for (const n of relationColNames) {
    const id = nameToId[n];
    if (id) {
      relationColId = id;
      break;
    }
  }

  let filtered: CodaRow[];
  if (relationColId != null) {
    filtered = all.filter((row) => {
      const rel = (row.values as Record<string, unknown>)[relationColId!];
      return jmenoValueMatchesChild(rel, childRowId, childName, childNickname);
    });
  } else {
    filtered = all.filter((row) => {
      const values = row.values as Record<string, unknown>;
      for (const val of Object.values(values)) {
        if (relationContainsRowId(val, childRowId)) return true;
      }
      if (childName != null || childNickname != null) {
        for (const val of Object.values(values)) {
          if (typeof val === "string" && jmenoValueMatchesChild(val, childRowId, childName, childNickname))
            return true;
        }
      }
      return false;
    });
  }

  const rowsWithNameKeys: CodaRow[] = filtered.map((row) => ({
    ...row,
    values: rowValuesToNameKeys(row.values as Record<string, unknown>, idToName),
  }));
  setCache(cacheKey, rowsWithNameKeys);
  return rowsWithNameKeys;
}

function getCurveTableId(): string | undefined {
  return process.env.CODA_TABLE_CURVE || undefined;
}

/** Data křivky plnění pro daný ročník (1. pololetí): highlight norma, stupeň, milníky. */
export async function getCurveData(rocnik: string): Promise<{
  rocnik: string;
  stepen_key: string;
  highlight: number | null;
  milestones: (number | null)[];
  milestones2: (number | null)[];
} | null> {
  const tableId = getCurveTableId();
  if (!tableId) return null;
  const docId = getDocId();
  const { nameToId } = await getTableColumnMaps(docId, tableId);
  const all = await getTableRowsAll(docId, tableId);
  const CURVE_POLOLETI = "1. pololetí";

  function toFloatPct(x: unknown): number | null {
    if (x == null) return null;
    if (typeof x === "number") return Number.isFinite(x) ? x : null;
    const s = String(x).replace(/\u00a0/g, "").replace(/\s/g, "").replace(/%/g, "").replace(/,/g, ".");
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : null;
  }
  function toIntSafe(x: unknown, def: number): number {
    const m = String(x).match(/\d+/);
    return m ? parseInt(m[0], 10) : def;
  }
  function normText(x: unknown): string {
    return String(x ?? "").trim();
  }

  const rowHighlight = all.find(
    (row) =>
      normText(getRowValue(row.values as Record<string, unknown>, "Ročník", nameToId)) === rocnik.trim() &&
      normText(getRowValue(row.values as Record<string, unknown>, "Pololetí", nameToId)) === CURVE_POLOLETI
  );
  if (!rowHighlight) return null;

  const highlight = toFloatPct(getRowValue(rowHighlight.values as Record<string, unknown>, "Norma", nameToId));
  const stepenKey = normText(getRowValue(rowHighlight.values as Record<string, unknown>, "Stupeň", nameToId));
  if (!stepenKey) return null;

  const sameStep = all.filter(
    (row) => normText(getRowValue(row.values as Record<string, unknown>, "Stupeň", nameToId)) === stepenKey
  );
  sameStep.sort((a, b) =>
    toIntSafe(getRowValue(a.values as Record<string, unknown>, "Období", nameToId), 999999) -
    toIntSafe(getRowValue(b.values as Record<string, unknown>, "Období", nameToId), 999999)
  );

  const milestones: (number | null)[] = [];
  const milestones2: (number | null)[] = [];
  for (const r of sameStep) {
    const v = r.values as Record<string, unknown>;
    milestones.push(toFloatPct(getRowValue(v, "Norma", nameToId)));
    milestones2.push(toFloatPct(getRowValue(v, "Norma zkrácená", nameToId)));
  }

  return {
    rocnik: rocnik.trim(),
    stepen_key: stepenKey,
    highlight: highlight ?? null,
    milestones,
    milestones2,
  };
}
