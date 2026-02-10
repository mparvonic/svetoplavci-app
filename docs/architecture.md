## Architektura aplikace

### Přehled

- **Framework:** Next.js 16 (app router, Turbopack).
- **Jazyk:** TypeScript.
- **UI knihovna:** shadcn/ui + Tailwind CSS, vlastní „metro“ design (modrá `#002060`, červená `#DA0100`, bílá).
- **Autentizace:** Auth.js / NextAuth (Google OAuth + e‑mailový magic link).
- **Datové úložiště výsledků:** Coda (REST API v1).
- **Databáze pro Auth:** PostgreSQL (Neon), spravovaná přes Prisma.

### Vrstevnaté členění

1. **Frontend (app router)**
   - `/auth/*` – přihlášení, verify-request, error (vše česky, metro design).
   - `/` (dashboard) – přehled dětí rodiče a jejich výsledků.
   - `/portal/dite/[childId]` – detail dítěte se 4 záložkami (na mobilu 3; „Vysvědčení – grafy“ je skrytá).

2. **API vrstva (Next.js app routes)**
   - `/api/coda/my-children` – seznam dětí přihlášeného rodiče.
   - `/api/coda/child/[childId]` – základní info o dítěti (kontrola „patří rodiči?“).
   - `/api/coda/child/[childId]/data` – Lodičky (tabulky).
   - `/api/coda/child/[childId]/vysvedceni` – data pro záložku „Vysvědčení – data“.
   - `/api/coda/child/[childId]/vysvedceni-grafy` – data pro záložku „Vysvědčení – grafy“ (curve + report).
   - `/api/coda/child/[childId]/[table]` – parametrizovaný přístup k vybraným tabulkám (whitelist).

3. **Integrace s Coda (`src/lib/coda.ts`)**
   - helpery `getTableRowsAll`, `getChildTableData`, `findParentByEmail`, `getChildrenOfParent`, `getCurveData`, atd.
   - interní cache sloupců a některých výsledků (kromě seznamu dětí, kde je cache vypnutá).

4. **Auth vrstva (`src/lib/auth.ts`, `src/lib/auth.config.ts`)**
   - konfigurace Auth.js (providers, callbacks),
   - Nodemailer Email provider s českým textem e‑mailu,
   - Prisma adapter pro PostgreSQL.

### Hlavní datové toky

#### 1. Přihlášení rodiče

1. Uživatel zadá e‑mail nebo použije Google login na `/auth/signin`.
2. Auth.js ověří Google / e‑mailový magic link.
3. V `signIn` callbacku:
   - zavolá `findParentByEmail(email)` v Codě,
   - pokud rodič neexistuje, vrací `/auth/signin?error=NoRole`.
4. V `jwt` callbacku se ukládá role `"rodic"` a jméno rodiče.
5. Dashboard čte `session` přes `auth()` a podle role zobrazuje obsah.

#### 2. Načtení dětí rodiče

1. Stránka `/` volá `/api/coda/my-children`.
2. API:
   - ověří session (`auth()`),
   - najde rodiče v Codě (`findParentByEmail`),
   - zavolá `getChildrenOfParent(parent.rowId)`,
   - vrací `children` (použito pro metro dlaždice dětí).

#### 3. Načtení dat pro jedno dítě

- Při přepnutí na dítě se ve `HomeContent` volá `/api/coda/child/[childId]/data`.
- API:
  - ověří session,
  - znovu najde rodiče,
  - z `getChildrenOfParent` vezme **jen děti tohoto rodiče** a ověří `childId`,
  - vrátí tabulková data pro Lodičky.
- Ostatní záložky (`vysvedceni`, `vysvedceni-grafy`) používají podobný pattern s příslušnými Coda tabulkami.

