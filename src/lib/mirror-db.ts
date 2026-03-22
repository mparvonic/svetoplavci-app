/**
 * Mirror DB – náhrada Coda API volání pomocí PostgreSQL mirror tabulek.
 * Poskytuje stejné rozhraní jako src/lib/coda.ts, ale čte z lokální DB.
 */

import { prisma } from "@/src/lib/prisma";
import type { CodaParent, CodaChild } from "@/src/types/coda";
import type { CodaRow } from "@/src/lib/coda";

// ─── Column IDs: mirror_seznam_osob (grid-PIwfgW7bQU) ────────────────────────────

const SO_JMENO           = "c-MzlgfRju0X";
const SO_PREZDIVKA       = "c--RSuRrZPWK"; // shoduje se s hodnocení a lodičky
const SO_ROLE            = "c-aI2b_O-scX";
const SO_KONTAKTNI_MAILY = "c-G9HEPv7cRM";
const SO_PRIMARNI_EMAIL  = "c-dYUboRJFlY";
const SO_AKTIVNI         = "c-uLx5khljlC";
const SO_DETI            = "c-9SFUzViDLO";
const SO_ROCNIK          = "c-htPmrPqL_r";
const SO_SMECKA          = "c-HuunarLxmI";
const SO_AKTUALNI_ROCNIK = "c-zqfeZZPsqm";

// ─── Column → name maps (převod JSONB klíčů na názvy sloupců pro CodaRow.values) ──

const OSOBNI_LODICKY_ID_TO_NAME: Record<string, string> = {
  "c-OSMU_hlRmn": "Jméno", "c-zCrx5ZI6_1": "Lodička", "c-AP2fUynFbe": "Stav",
  "c-H7C9KdzQ8I": "Hodnota", "c-wdUUsanACr": "Smečka", "c-wGyKzGNASL": "Aktivní",
  "c-ETfsa_OPRw": "Garant", "c-obSQ5dEK0z": "Předmět", "c-trddTED3wc": "Podpředmět",
  "c-HgMvO9yZzg": "-", "c-k-Fvl5AU_z": "+", "c-kJayOSHA5y": "Pořadí stavu",
  "c-U7KQdppjxK": "Hodnota stavu", "c--2LqS2G1oM": "Kód osobní lodičky",
  "c-WJOFyTmLb0": "ID žáka", "c-eayFSqWKOg": "Poznámka", "c-9yqQ1W6KnV": "Datum stavu",
  "c-awKbb-1mcj": "Název lodičky", "c-LbIdXWqnl0": "Historie", "c-jHa_FpDumI": "Kód lodičky",
  "c-SE3NZt0wQP": "Ročník", "c-bYmKSGL0RL": "Název lodičky dlouhý", "c-KjnU2LstNz": "Kód OVU",
  "c-Clh6Bb_xgT": "Znění RVP", "c-Zp1zU2_ulM": "Fotka", "c-RUxQ0_Ii9O": "Oblast",
  "c-Bqrg4lLbml": "Přezdívka", "c-mVx9z4k5pL": "Úspěch", "c-Sc2enM5VSp": "Typ studia",
  "c-66wgJF9WAF": "Změnil", "c-ZFYsSAGsHy": "Smazaná", "c-KBmhTcIKRc": "Počáteční hodnota",
  "c-X5v5nrWjaW": "Vstupní stav", "c-THoLDgrzlc": "1. plavba", "c-I93mCblJK4": "2. plavba",
  "c-LcDCHr388O": "3. plavba", "c-vZUh_zFRQo": "4. plavba", "c-_OJHt3jmxm": "5. plavba",
};

const HODNOCENI_PREDMETU_ID_TO_NAME: Record<string, string> = {
  "c-UXuyii8itd": "Předmět", "c-HFd9pHASFz": "Předmět celkem", "c-VpreYM7lLn": "Body celkem",
  "c-FQEmOP1h7p": "Norma", "c-cbGW-UNRmI": "Hodnocení", "c-6y8osbNwV1": "Jméno",
};

const HODNOCENI_OBLASTI_ID_TO_NAME: Record<string, string> = {
  "c-FbbeJ33EsP": "Předmět", "c-HlTyztXbdQ": "Oblast", "c-5mVt75lgIO": "Oblast celkem",
  "c-B54-A7-5WI": "Dopočet při přestupu", "c-iKucJbAf8_": "Historické lodičky",
  "c-wRu87PvHCi": "Aktuální body", "c-D1XChdOh40": "Body celkem",
  "c-6AxGhTQBq5": "Norma", "c-LbpmBdYHFo": "Hodnocení", "c-H0Dv3JDsqU": "Jméno",
};

// ─── Column IDs: mirror_krivka (grid-WRLBZgw4Vo) ─────────────────────────────────

const KR_ROCNIK         = "c-Gnf85M6reH";
const KR_POLOLETI       = "c-5u_BrMxW9w";
const KR_OBDOBI         = "c-opsHmPPnEm";
const KR_STUPEN         = "c-NXbv0udM99";
const KR_NORMA          = "c-ctMybhCUbr";
const KR_NORMA_ZKRACENA = "c-kRj7A9aitl";

// ─── Helpers ──────────────────────────────────────────────────────────────────────

function parseCSV(raw: string): string[] {
  return raw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
}

function getStr(data: Record<string, unknown>, colId: string): string {
  const v = data[colId];
  return typeof v === "string" ? v : "";
}

function isActive(data: Record<string, unknown>): boolean {
  const v = data[SO_AKTIVNI];
  if (v === false) return false;
  const s = String(v ?? "").trim().toLowerCase();
  return s !== "false" && s !== "ne" && s !== "no";
}

type DbRow = { coda_row_id: string; coda_created_at: Date | null; coda_updated_at: Date | null; data: unknown };

function dbRowToCodaRow(row: DbRow, idToName: Record<string, string>): CodaRow {
  const raw = row.data as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const [id, val] of Object.entries(raw)) {
    values[idToName[id] ?? id] = val;
  }
  return {
    id: row.coda_row_id,
    type: "row",
    href: "",
    name: row.coda_row_id,
    index: 0,
    createdAt: row.coda_created_at?.toISOString() ?? "",
    updatedAt: row.coda_updated_at?.toISOString() ?? "",
    values,
  };
}

function nameMatches(childrenNames: string[], prezdivka: string, jmeno: string): boolean {
  return childrenNames.some(
    (n) => n.toLowerCase() === prezdivka.toLowerCase() || n.toLowerCase() === jmeno.toLowerCase()
  );
}

// ─── findParentByEmail ─────────────────────────────────────────────────────────────

export async function findParentByEmail(email: string): Promise<CodaParent | null> {
  const normalized = email.trim().toLowerCase();

  // Filtrujeme: aktivní rodiče s emailem v kontaktních mailech nebo primárním emailu
  const candidates = await prisma.$queryRaw<DbRow[]>`
    SELECT coda_row_id, coda_created_at, coda_updated_at, data
    FROM mirror_seznam_osob
    WHERE data->>'c-uLx5khljlC' != 'false'
      AND data->>'c-aI2b_O-scX' LIKE '%Rodič%'
      AND (
        lower(data->>'c-G9HEPv7cRM') LIKE ${"%" + normalized + "%"}
        OR lower(data->>'c-dYUboRJFlY') = ${normalized}
      )
  `;

  for (const row of candidates) {
    const data = row.data as Record<string, unknown>;
    if (!isActive(data)) continue;

    // Přesná shoda emailu (LIKE může dát false positives pro substring)
    const kontaktni = parseCSV(getStr(data, SO_KONTAKTNI_MAILY).toLowerCase());
    const primarni = getStr(data, SO_PRIMARNI_EMAIL).trim().toLowerCase();
    const allEmails = [...new Set([...kontaktni, ...(primarni ? [primarni] : [])])];
    if (!allEmails.includes(normalized)) continue;

    const name = getStr(data, SO_JMENO) || row.coda_row_id;
    const role = getStr(data, SO_ROLE);
    const childrenNames = parseCSV(getStr(data, SO_DETI));

    // Najdeme row IDs dětí
    const childrenIds: { rowId: string; name: string }[] = [];
    if (childrenNames.length > 0) {
      const allSeznam = await prisma.mirrorSeznamOsob.findMany();
      for (const cr of allSeznam) {
        const cd = cr.data as Record<string, unknown>;
        const prezdivka = getStr(cd, SO_PREZDIVKA);
        const jmeno = getStr(cd, SO_JMENO);
        if (nameMatches(childrenNames, prezdivka, jmeno)) {
          childrenIds.push({ rowId: cr.codaRowId, name: prezdivka || jmeno });
        }
      }
    }

    return {
      rowId: row.coda_row_id,
      name,
      email: normalized,
      contactEmails: allEmails,
      roles: role.split(",").map((r) => r.trim()).filter(Boolean),
      childrenIds,
    };
  }

  return null;
}

// ─── getChildrenOfParent ───────────────────────────────────────────────────────────

export async function getChildrenOfParent(parentRowId: string): Promise<CodaChild[]> {
  const parentRow = await prisma.mirrorSeznamOsob.findUnique({ where: { codaRowId: parentRowId } });
  if (!parentRow) return [];

  const childrenNames = parseCSV(getStr(parentRow.data as Record<string, unknown>, SO_DETI));
  if (childrenNames.length === 0) return [];

  const allRows = await prisma.mirrorSeznamOsob.findMany();
  return allRows
    .filter((cr) => {
      const cd = cr.data as Record<string, unknown>;
      return nameMatches(childrenNames, getStr(cd, SO_PREZDIVKA), getStr(cd, SO_JMENO));
    })
    .map((cr) => {
      const cd = cr.data as Record<string, unknown>;
      const prezdivka = getStr(cd, SO_PREZDIVKA);
      const jmeno = getStr(cd, SO_JMENO);
      return {
        rowId: cr.codaRowId,
        name: jmeno || prezdivka,
        nickname: prezdivka,
        rocnik: getStr(cd, SO_ROCNIK),
        currentYear: getStr(cd, SO_AKTUALNI_ROCNIK),
        group: getStr(cd, SO_SMECKA),
      };
    });
}

// ─── getChildTableData ─────────────────────────────────────────────────────────────

function resolveTableId(tableId: string): string {
  const predmetu = process.env.CODA_TABLE_HODNOCENI_PREDMETU ?? "table-oCLreazO22";
  const oblasti = process.env.CODA_TABLE_HODNOCENI_OBLASTI ?? "table-NbDPhMF4ci";
  if (tableId === predmetu) return "table-oCLreazO22";
  if (tableId === oblasti) return "table-NbDPhMF4ci";
  return tableId;
}

async function getNickname(childRowId: string, childNickname?: string): Promise<string | null> {
  if (childNickname) return childNickname;
  const row = await prisma.mirrorSeznamOsob.findUnique({ where: { codaRowId: childRowId } });
  if (!row) return null;
  return getStr(row.data as Record<string, unknown>, SO_PREZDIVKA) || null;
}

export async function getChildTableData(
  tableId: string,
  childRowId: string,
  _childName?: string,
  childNickname?: string,
  _childRocnik?: string
): Promise<CodaRow[]> {
  const resolvedId = resolveTableId(tableId);
  const nickname = await getNickname(childRowId, childNickname);
  if (!nickname) return [];
  const nick = nickname.toLowerCase();

  switch (resolvedId) {
    case "table-RuXGEEn2z4": {
      // Osobní lodičky – filtr podle Přezdívky (c-Bqrg4lLbml)
      const rows = await prisma.$queryRaw<DbRow[]>`
        SELECT coda_row_id, coda_created_at, coda_updated_at, data
        FROM mirror_osobni_lodicky
        WHERE lower(data->>'c-Bqrg4lLbml') = ${nick}
      `;
      return rows.map((r) => dbRowToCodaRow(r, OSOBNI_LODICKY_ID_TO_NAME));
    }
    case "table-1wVyfFAjX2":
      // Lodičky po plavbách – tabulka nemá name sloupec, momentálně prázdná
      return [];
    case "table-oCLreazO22": {
      // Hodnocení předmětů – filtr podle Jméno (c-6y8osbNwV1)
      const rows = await prisma.$queryRaw<DbRow[]>`
        SELECT coda_row_id, coda_created_at, coda_updated_at, data
        FROM mirror_hodnoceni_predmetu
        WHERE lower(data->>'c-6y8osbNwV1') = ${nick}
      `;
      return rows.map((r) => dbRowToCodaRow(r, HODNOCENI_PREDMETU_ID_TO_NAME));
    }
    case "table-NbDPhMF4ci": {
      // Hodnocení oblastí – filtr podle Jméno (c-H0Dv3JDsqU)
      const rows = await prisma.$queryRaw<DbRow[]>`
        SELECT coda_row_id, coda_created_at, coda_updated_at, data
        FROM mirror_hodnoceni_oblasti
        WHERE lower(data->>'c-H0Dv3JDsqU') = ${nick}
      `;
      return rows.map((r) => dbRowToCodaRow(r, HODNOCENI_OBLASTI_ID_TO_NAME));
    }
    default:
      return [];
  }
}

// ─── getCurveData ──────────────────────────────────────────────────────────────────

export async function getCurveData(rocnik: string): Promise<{
  rocnik: string;
  stepen_key: string;
  highlight: number | null;
  milestones: (number | null)[];
  milestones2: (number | null)[];
} | null> {
  const allRows = await prisma.mirrorKrivka.findMany();

  function toFloatPct(x: unknown): number | null {
    if (x == null) return null;
    if (typeof x === "number") return Number.isFinite(x) ? x : null;
    const s = String(x).replace(/\u00a0/g, "").replace(/\s/g, "").replace(/%/g, "").replace(/,/g, ".");
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : null;
  }
  const normText = (x: unknown) => String(x ?? "").trim();
  function toIntSafe(x: unknown): number {
    const m = String(x).match(/\d+/);
    return m ? parseInt(m[0], 10) : 999999;
  }

  const rowHighlight = allRows.find((row) => {
    const d = row.data as Record<string, unknown>;
    return normText(d[KR_ROCNIK]) === rocnik.trim() && normText(d[KR_POLOLETI]) === "1. pololetí";
  });
  if (!rowHighlight) return null;

  const hlData = rowHighlight.data as Record<string, unknown>;
  const highlight = toFloatPct(hlData[KR_NORMA]);
  const stepenKey = normText(hlData[KR_STUPEN]);
  if (!stepenKey) return null;

  const sameStep = allRows
    .filter((row) => normText((row.data as Record<string, unknown>)[KR_STUPEN]) === stepenKey)
    .sort((a, b) => toIntSafe((a.data as Record<string, unknown>)[KR_OBDOBI]) - toIntSafe((b.data as Record<string, unknown>)[KR_OBDOBI]));

  const milestones: (number | null)[] = [];
  const milestones2: (number | null)[] = [];
  for (const r of sameStep) {
    const d = r.data as Record<string, unknown>;
    milestones.push(toFloatPct(d[KR_NORMA]));
    milestones2.push(toFloatPct(d[KR_NORMA_ZKRACENA]));
  }

  return { rocnik: rocnik.trim(), stepen_key: stepenKey, highlight: highlight ?? null, milestones, milestones2 };
}
