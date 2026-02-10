## Datové struktury

Tento dokument popisuje hlavní datové struktury, které aplikace používá nad daty z Coda a Auth.js.

---

### 1. Entita rodič (`CodaParent`)

Definice: `src/types/coda.ts`

```ts
export interface CodaParent {
  rowId: string;
  name: string;
  email: string;
  contactEmails: string[];
  roles: string[];
  childrenIds: { rowId: string; name: string }[];
}
```

- **`rowId`**: interní ID řádku v tabulce „Seznam osob“.
- **`name`**: zobrazované jméno rodiče.
- **`email`**: primární e‑mail (většinou první z `contactEmails`).
- **`contactEmails`**: normalizovaný seznam všech e‑mailů z Coda (string nebo multi‑select); parsováno funkcí `parseContactEmails`.
- **`roles`**: role osoby (např. obsahuje `"Rodič"`).
- **`childrenIds`**: seznam dětí přiřazených rodiči (jen `rowId` a `name`).

Tato struktura se používá:

- v autentizaci (`findParentByEmail`) pro ověření, že přihlášený e‑mail patří rodiči,
- v API `/api/coda/my-children` pro načtení seznamu dětí rodiče.

---

### 2. Entita dítě (`CodaChild`)

Definice: `src/types/coda.ts`

```ts
export interface CodaChild {
  rowId: string;
  name: string;
  nickname: string;
  rocnik: string;      // např. "1. ročník"
  currentYear: string; // např. "2025/2026"
  group: string;       // Smečka
}
```

- **`rowId`**: ID řádku dítěte v „Seznam osob“.
- **`name`**: celé jméno dítěte.
- **`nickname`**: přezdívka (zobrazuje se v UI, pokud je k dispozici).
- **`rocnik`**: ročník, používá se pro výběr správných view/tabulek (např. pro křivku a hodnocení).
- **`currentYear`**: aktuální školní rok.
- **`group`**: smečka / skupina.

Použití:

- dashboard (`home-page-client.tsx`) – seznam dětí,
- všechny `/portal/dite/[childId]` stránky – detail dítěte, taby a grafy.

---

### 3. Tabulky hodnocení (`TableId`, lodičky, předměty, oblasti)

Definice mapování: `src/types/coda.ts`

```ts
export type TableId =
  | "table-RuXGEEn2z4"   // Lodičky dítěte
  | "table-1wVyfFAjX2"   // Lodičky po plavbách
  | "table-oCLreazO22"   // Hodnocení předmětů
  | "table-NbDPhMF4ci";  // Hodnocení oblastí

export const TABLE_IDS: Record<string, TableId> = {
  lodicky: "table-RuXGEEn2z4",
  lodickyPoPlavbach: "table-1wVyfFAjX2",
  hodnoceniPredmetu: "table-oCLreazO22",
  hodnoceniOblasti: "table-NbDPhMF4ci",
} as const;
```

Tyto identifikátory se používají:

- v API routách `app/api/coda/child/[childId]/*`,
- ve helperu `getChildTableData` pro jednotnou práci s daty tabulek.

Každá z tabulek je v UI reprezentována jako tabulka nebo rozklikávací řádky:

- **Lodičky dítěte** – průběžné plnění lodiček podle oblastí a aktivit.
- **Lodičky po plavbách** – agregovaná data po jednotlivých plavbách.
- **Hodnocení předmětů** – známky / hodnocení za předměty.
- **Hodnocení oblastí** – souhrnné hodnocení jednotlivých oblastí.

Detailní mapping sloupců → zobrazované hodnoty je implementován přímo v API routách a komponentách tabulek (`child-detail-tabs.tsx`, `CollapsibleLodickyTable`).

---

### 4. Struktura pro grafy vysvědčení

Grafy ve „Vysvědčení – grafy“ (`vysvedceni-grafy.tsx`) používají datovou strukturu postavenou nad výstupem z `getCurveData(rocnik)`:

- **Vstupní zdroj:** tabulka křivek v Coda (`CODA_TABLE_CURVE`).
- **Výsledná struktura (zjednodušeně):**
  - `milestones`: body pro hlavní křivku (osa času / období),
  - `milestones2`: alternativní body pro speciální případy,
  - `highlight`: oblast zvýraznění (např. norma),
  - metadata pro popisky (název předmětu/oblasti, ročník, pololetí).

Na frontend se data posílají přes endpoint:

- `GET /api/coda/child/[childId]/vysvedceni-grafy`

a následně se transformují v `buildAreaPlot(...)` na vstup pro Plotly (`data`, `layout`).

---

### 5. Struktury pro Auth.js a session

I když primárním zdrojem doménových dat je Coda, aplikace používá i standardní typy Auth.js / NextAuth:

- **Uživatel / session:**
  - standardní `User`, `Session` a `JWT` typy z Auth.js,
  - v `session` callbacku se doplňuje:
    - `session.user.email` – e‑mail přihlášeného rodiče,
    - případně další metadata z Coda (dle potřeby).

- **VerificationToken (Prisma):**
  - interní tabulka v DB (Neon/PostgreSQL) pro magické odkazy,
  - obsahuje:
    - `identifier` (e‑mail),
    - `token`,
    - `expires`.

Tyto struktury jsou popsány detailněji v `docs/auth.md` a `GDPR.md`.

---

### 6. Další pomocné struktury

V `src/lib/coda.ts` existují i interní pomocné typy:

- `CodaRow`, `CodaCell` – generické typy pro řádky a buňky z Coda API.
- `ListRowsOptions` – parametry pro stránkování, filtrování a řazení.
- `RowToInsert`, `CodaInsertRowsResponse`, `CodaUpdateRowResponse` – typy pro zápis/aktualizaci řádků.

Tyto typy slouží primárně jako technický most mezi Coda API a doménovými strukturami popsanými výše.

