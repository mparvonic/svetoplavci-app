## Tabulky Coda, se kterými pracuje aplikace

Tento přehled shrnuje **jen ty tabulky/view v Coda dokumentu, které aplikace skutečně načítá přes API** (`src/lib/coda.ts` a `app/api/coda/...`).

---

## 1. Seznam osob (`grid-PIwfgW7bQU`)

- **ID:** `grid-PIwfgW7bQU`
- **Název v Coda:** „Seznam osob“
- **Typ:** base table
- **Env:** `CODA_TABLE_SEZNAM_OSOB`
- **Použití v aplikaci:**
  - `findParentByEmail(email)` – hledání rodiče podle e‑mailu (Auth).
  - `getChildrenOfParent(parentRowId)` – načtení dětí daného rodiče.
  - Endpointy:
    - `GET /api/coda/my-children` – seznam dětí přihlášeného rodiče.
    - `GET /api/coda/child/[childId]` – základní info o dítěti (ověření, že patří rodiči).
  - Sloupce: role, kontaktní e‑maily, aktivita, Děti/Rodič(e), ročník, smečka atd.

---

## 2. Lodičky dítěte (`table-RuXGEEn2z4`)

- **ID:** `table-RuXGEEn2z4`
- **Název v Coda:** „Lodičky dítěte“
- **Typ:** view
- **Použití v aplikaci:**
  - Hlavní zdroj dat pro tab „Lodičky“ v portálu dítěte.
  - Načítá se přes helper `getChildTableData("table-RuXGEEn2z4", ...)`.
  - Endpointy:
    - `GET /api/coda/child/[childId]/data` – základní data pro dashboard dítěte (Lodičky).
    - `GET /api/coda/child/[childId]/[table]` – dynamický přístup s whitelistem (`ALLOWED_TABLES`).
  - Sloupce zobrazované v UI: Předmět, Podpředmět, Oblast, Název lodičky, Stav, Úspěch, Poznámka.

---

## 3. Lodičky po plavbách (`table-1wVyfFAjX2`)

- **ID:** `table-1wVyfFAjX2`
- **Název v Coda:** „Lodičky dítěte po plavbách“
- **Typ:** view
- **Použití v aplikaci:**
  - Tab „Lodičky po plavbách“ – stejné lodičky, ale po jednotlivých plavbách.
  - Helper `getChildTableData("table-1wVyfFAjX2", ...)`.
  - Endpointy:
    - `GET /api/coda/child/[childId]/[table]` – pokud `table` je `table-1wVyfFAjX2`.
  - Sloupce zobrazované v UI: Předmět, Podpředmět, Oblast, Název lodičky, Vstupní stav, 1.–5. plavba.

---

## 4. Hodnocení předmětů (`table-o85zm2oqc_` → env `CODA_TABLE_HODNOCENI_PREDMETU`)

- **ID:** `table-o85zm2oqc_`
- **Název v Coda:** „Hodnocení předmětů export“
- **Typ:** view
- **Env:** `CODA_TABLE_HODNOCENI_PREDMETU`
- **Použití v aplikaci:**
  - Tab „Vysvědčení – data“ (souhrn za předměty).
  - Část dat pro „Vysvědčení – grafy“ (predmetové grafy a report).
  - Helper `getChildTableData(CODA_TABLE_HODNOCENI_PREDMETU, ...)`.
  - Endpointy:
    - `GET /api/coda/child/[childId]/vysvedceni` – vrací pole `predmetu`.
    - `GET /api/coda/child/[childId]/vysvedceni-grafy` – používá stejná data pro report/graf.
    - `GET /api/coda/child/[childId]/[table]` – pokud `table` je hodnocení předmětů (přes `ALLOWED_TABLES`).

---

## 5. Hodnocení oblastí (`table-TbzZTQK1dj` → env `CODA_TABLE_HODNOCENI_OBLASTI`)

- **ID:** `table-TbzZTQK1dj`
- **Název v Coda:** „Hodnocení oblastí export“
- **Typ:** view
- **Env:** `CODA_TABLE_HODNOCENI_OBLASTI`
- **Použití v aplikaci:**
  - Tab „Vysvědčení – data“ (detail za oblasti/podpředměty).
  - Základní tabulka pro výpočty v „Vysvědčení – grafy“ (milníky, zbylé body).
  - Helper `getChildTableData(CODA_TABLE_HODNOCENI_OBLASTI, ...)`.
  - Endpointy:
    - `GET /api/coda/child/[childId]/vysvedceni` – vrací pole `oblasti`.
    - `GET /api/coda/child/[childId]/vysvedceni-grafy` – vstup pro výpočet reportu a grafů.
    - `GET /api/coda/child/[childId]/[table]` – pokud `table` je hodnocení oblastí (přes `ALLOWED_TABLES`).

---

## 6. View lodiček po ročnících (`CODA_VIEW_X_ROCNIK`)

Tyto view nejsou volány přímo z API, ale **mohou být použity uvnitř helperu** `getChildTableData` pro `table-RuXGEEn2z4`:

- **Env:**
  - `CODA_VIEW_1_ROCNIK = table-yEEWei_5V6`
  - `CODA_VIEW_2_ROCNIK = table-Ne5GJTiRsp`
  - `CODA_VIEW_3_ROCNIK = table-dlHd_OQzDo`
  - `CODA_VIEW_4_ROCNIK = table-XNp8CBW4b4`
  - (další ročníky zatím nenastavené)
- **Použití v aplikaci:**
  - Pokud je pro daný ročník nastaveno `CODA_VIEW_N_ROCNIK`, `getChildTableData` pro Lodičky dítěte místo base tabulky `grid-3m-_XP8oMp` volá právě toto view:
    - `GET /docs/{docId}/tables/{viewId}/rows?...`
  - Cíl: zmenšit objem dat a vyhnout se limitům Coda API na velké tabulky.

---

## 7. Shrnutí – jaké tabulky se opravdu načítají přes API

Z hlediska migrace do Supabase je potřeba modelovat minimálně tyto tabulky/view:

1. **Seznam osob** (`grid-PIwfgW7bQU`) – identita rodičů a dětí, role, kontakty, přirazení rodič–dítě.
2. **Lodičky dítěte** (`table-RuXGEEn2z4`) + případně zdrojová **Osobní lodičky** (`grid-3m-_XP8oMp`) a view pro ročníky (`CODA_VIEW_X_ROCNIK`).
3. **Lodičky po plavbách** (`table-1wVyfFAjX2`).
4. **Hodnocení předmětů export** (`table-o85zm2oqc_` / `CODA_TABLE_HODNOCENI_PREDMETU`).
5. **Hodnocení oblastí export** (`table-TbzZTQK1dj` / `CODA_TABLE_HODNOCENI_OBLASTI`).

Další Coda tabulky (Školní roky, Plavby, Knihy, technika atd.) jsou v dokumentu, ale aktuální verze aplikace je přes API vůbec nečte – lze je z migračního plánu vypustit nebo řešit samostatně, pokud je budeš chtít v budoucnu do aplikace zapojit.

