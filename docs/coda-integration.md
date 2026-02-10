## Integrace s Coda API

Tento dokument shrnuje, jak aplikace komunikuje s Coda API (v1), jaké helper funkce jsou k dispozici a jaké tabulky se používají.

---

### 1. Základní nastavení

- **Základní URL:** `https://coda.io/apis/v1`
- **Konfigurace v env:**
  - `CODA_API_TOKEN` – API token s oprávněním číst/zapisovat do školního dokumentu.
  - `CODA_DOC_ID` – ID dokumentu (v URL Coda doc).
  - Další tabulky:
    - `CODA_TABLE_SEZNAM_OSOB` (fallback ID `grid-PIwfgW7bQU`) – „Seznam osob“.
    - `CODA_TABLE_HODNOCENI_PREDMETU`, `CODA_TABLE_HODNOCENI_OBLASTI` – tabulky hodnocení.
    - `CODA_TABLE_CURVE` – tabulka křivky plnění („Křivka plnění lodiček“).

Helper funkce a typy jsou definovány v `src/lib/coda.ts` a `src/types/coda.ts`.

---

### 2. Obecné helpery pro tabulky

#### 2.1 `getTableRows(docId, tableIdOrName, options?)`

Nízká úroveň – přímý wrapper nad endpointem:

```ts
GET /docs/{docId}/tables/{tableIdOrName}/rows
```

Podporuje parametry:

- `limit`, `pageToken`, `query`, `sortBy`.

Vrací `CodaListRowsResponse`:

- `items: CodaRow[]` (viz typ níže),
- `nextPageToken`.

#### 2.2 `getTableRowsAll(docId, tableId)`

Vysoká úroveň – načte všechny řádky tabulky po stránkách a uloží je do paměťové cache:

- cache klíč: `tableRows:{docId}:{tableId}`,
- TTL: 5 minut (`CACHE_TTL_MS`),
- používá se např. při hledání rodičů a dětí v tabulce „Seznam osob“.

#### 2.3 Zápis / update do tabulek

Aplikace momentálně data primárně čte, ale helpery jsou připravené:

- `addTableRows(docId, tableIdOrName, rows, keyColumns?)`
  - wrapper nad `POST /docs/{docId}/tables/{tableIdOrName}/rows`,
  - podporuje upsert přes `keyColumns`.
- `updateTableRow(docId, tableIdOrName, rowIdOrName, cells)`
  - wrapper nad `PUT /docs/{docId}/tables/{tableIdOrName}/rows/{rowIdOrName}`.

---

### 3. Typy pro Coda (shrnutí)

Definované v `src/types/coda.ts`:

```ts
export interface CodaParent {
  rowId: string;
  name: string;
  email: string;
  contactEmails: string[];
  roles: string[];
  childrenIds: { rowId: string; name: string }[];
}

export interface CodaChild {
  rowId: string;
  name: string;
  nickname: string;
  rocnik: string;      // např. "1. ročník"
  currentYear: string; // např. "2025/2026"
  group: string;       // Smečka
}

export type TableId =
  | "table-RuXGEEn2z4"   // Lodičky dítěte
  | "table-1wVyfFAjX2"   // Lodičky po plavbách
  | "table-oCLreazO22"   // Hodnocení předmětů
  | "table-NbDPhMF4ci";  // Hodnocení oblastí
```

---

### 4. Seznam osob – rodiče a děti

#### 4.1 `findParentByEmail(email): Promise<CodaParent | null>`

Základní funkce pro ověření, že e‑mail patří rodiči:

1. Načte mapování názvů sloupců (`getColumnNameToIdMap`) pro tabulku „Seznam osob“.
2. Načte všechny řádky tabulky (`getTableRowsAll`).
3. Pro každý řádek:
   - získá role (`parseRoles`),
   - ověří, že obsahují „Rodič“,
   - ověří aktivitu (sloupce `Aktivní`, `Aktivní osoba`, `Aktivní?`),
   - načte kontaktní e‑maily (`parseContactEmails`), podporuje:
     - stringy s více e‑maily oddělenými čárkami / středníky,
     - multi‑select (pole hodnot).
4. Pokud e‑mail sedí, vrací `CodaParent`:
   - `rowId`, `name`, `contactEmails`, `roles`,
   - `childrenIds` ze sloupce `Děti` (relation).

Výsledek je cacheován na 5 minut (s možností vypnutí cache při `AUTH_DEBUG=1`).

#### 4.2 `getChildrenOfParent(parentRowId): Promise<CodaChild[]>`

Načte všechny děti rodiče daného `rowId`:

1. Načte řádek rodiče (`/rows/{parentRowId}`).
2. Získá hodnotu sloupce `Děti`:
   - pokud je to relation, použije `getRelationItems` a `extractRowIdFromHref` k získání `rowId` dětí,
   - pokud je to text, parsuje jména a přezdívky dětí a vyhledá odpovídající řádky v celé tabulce.
3. Fallback přes sloupec rodičů („Rodič(e)“) podle jména/přezdívky rodiče pro starší struktury.
4. Pro každé dítě načte detail řádku:
   - `Jméno`, `Přezdívka`, `Ročník`, `Aktuální`, `Smečka`.

> **Poznámka:** kvůli aktuálnosti dat je pro děti cache vypnutá – `getChildrenOfParent` vždy čte přímo z Coda.

---

### 5. Lodičky a hodnocení

#### 5.1 `getChildTableData(tableId, childRowId, childName, nickname, rocnik)`

Helper pro načítání řádků konkrétních tabulek pro dítě:

- Použitý pro:
  - `table-RuXGEEn2z4` (Lodičky dítěte),
  - `table-1wVyfFAjX2` (Lodičky po plavbách),
  - `table-oCLreazO22` (Hodnocení předmětů),
  - `table-NbDPhMF4ci` (Hodnocení oblastí).
- Funkce kombinuje několik způsobů filtrování:
  - podle `rowId` dítěte (relation),
  - podle jména/přezdívky,
  - podle ročníku (např. view tabulky pro konkrétní ročník).
- Výsledkem je pole `CodaRow[]`, které se dál mapuje v API routách na konkrétní struktury pro frontend (např. `TAB1_COLUMNS`, `TAB2_COLUMNS`, grafy).

#### 5.2 Křivka plnění (`getCurveData(rocnik)`)

Pro tabulku křivky („Křivka plnění lodiček“):

- Načte všechny řádky tabulky.
- Najde řádek odpovídající ročníku dítěte a pololetí `1. pololetí`.
- Z tohoto řádku vezme:
  - `Norma` (highlight),
  - `Stupeň`.
- Poté projde všechny řádky se stejným stupněm a seřadí je podle `Období` → `milestones` a `milestones2`.
- Vrací strukturu použitelou pro Plotly grafy ve „Vysvědčení – grafy“.

---

### 6. Whitelist tabulek pro dynamický endpoint

`app/api/coda/child/[childId]/[table]/route.ts` používá typ `TableId` a pole `ALLOWED_TABLES`:

```ts
const ALLOWED_TABLES: TableId[] = [
  "table-RuXGEEn2z4", // Lodičky dítěte
  "table-1wVyfFAjX2", // Lodičky po plavbách
  "table-oCLreazO22", // Hodnocení předmětů
  "table-NbDPhMF4ci", // Hodnocení oblastí
];
```

To zajišťuje, že dynamický endpoint nemůže načítat libovolné tabulky mimo ty, pro které je aplikace navržená.

