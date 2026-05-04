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

---

### 7. Pravidlo read-only pro údaje z API

Pro interní adresář uživatelů platí závazné pravidlo:

- údaje přenesené z Edookit API (`source_type = edookit_student` / `edookit_employee`) jsou **jen pro čtení**,
- profilová data osoby (`display_name`, `first_name`, `middle_name`, `last_name`, `identifier`, `plus4u_id`) může přepisovat pouze sync z API,
- ne-API zdroje (např. CSV import rodičů) nesmí tato API data přepsat, pokud už osoba API zdroj má.

Technicky je pravidlo vynucené v `src/lib/user-sync.ts` při upsertu osoby:

- API záznamy mohou profil aktualizovat,
- CSV/manual záznamy profil aktualizují jen u osob bez API zdroje.

---

### 8. Převod čipu: `Čip UID` -> `Čip HID`

Pro kiosky a interní evidenci se používá:

- `chip_uid` (hex řetězec, typicky 8 hex znaků, např. `006A4E74`)
- `chip_hid` (desítkové číslo odvozené z UID)

Výpočet `chip_hid` je **little-endian převod 4 bajtů**:

1. `UID` se rozdělí na 4 bajty po 2 hex znacích: `B0 B1 B2 B3`
2. `HID = B0 + B1*256 + B2*65536 + B3*16777216`

Stejný vzorec je použitý v Coda i v app sync skriptech.

Příklad:

- `UID = 006A4E74`
- `B0=0x00`, `B1=0x6A`, `B2=0x4E`, `B3=0x74`
- `HID = 0 + 106*256 + 78*65536 + 116*16777216 = 1951296000`

Poznámky:

- před výpočtem je potřeba UID normalizovat (`trim`, `uppercase`),
- pokud UID není přesně 8 hex znaků, HID se nepočítá (neplatná hodnota),
- cílové sloupce v DB jsou `app_person.chip_uid` a `app_person.chip_hid`.
