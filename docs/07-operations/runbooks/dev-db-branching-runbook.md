# Runbook: DEV data strategy (local Mac + Neon branches)

Datum aktualizace: 2026-04-06

## Cíl

Zajistit stabilní DEV prostředí bez rizika práce nad produkční DB a bez rozbíjení rozpracovaných změn.

## Model datových vrstev

1. `proto`: pouze mock data (`app/(prototype)`, `src/lib/mock`).
2. `dev-template` branch (Neon): pravidelně obnovovaná šablona z prod.
3. `dev-<developer>-<feature>` branch (Neon): osobní integrační větev každého vývojáře.
4. `test` (`staging`): sdílená test DB.
5. `prod` (`main`): produkční DB.

## Proč neobčerstvovat každou DEV branch automaticky

Automatický refresh každé osobní DEV branch by průběžně přepisoval rozdělanou práci.
Doporučení: refreshovat pouze `dev-template`, a osobní DEV branch zakládat/resetovat podle potřeby.

## Perioda refresh

- `prod -> test`: běžící pravidelný provozní refresh (stávající).
- `prod -> dev-template`: doporučeno 1x denně nebo on-demand před větším integračním blokem.

## Požadované proměnné

```
NEON_API_KEY=...
NEON_PROJECT_ID=...
NEON_PROD_BRANCH_ID=...               # nebo NEON_PROD_BRANCH_NAME=main
NEON_DEV_TEMPLATE_BRANCH_NAME=dev-template
```

## Operace

### 1. Refresh template branch

Destruktivní operace (přepis template branch):

```bash
npm run db:dev-template:refresh -- --yes
```

### 2. Vytvoření osobní DEV branch

```bash
npm run db:dev-branch:create -- --developer miroslav --feature user-management
```

Nebo explicitní jméno:

```bash
npm run db:dev-branch:create -- --name dev-miroslav-user-management
```

### 3. Reset osobní DEV branch

Destruktivní operace:

```bash
npm run db:dev-branch:reset -- --developer miroslav --feature user-management --yes
```

## Lokální .env.local

Po vytvoření branch nastav `POSTGRES_PRISMA_URL` na connection string této DEV branch.

Lokální start je chráněn guardem:

```bash
npm run dev
```

`npm run dev` nejdřív provede `db:assert:local-safe`, který zablokuje start, pokud URL míří na produkční DB.

## Guard konfigurace

Volitelné zpřísnění v `.env.local`:

```
DB_FORBIDDEN_DATABASES=svetoplavci_prod
DB_FORBIDDEN_HOST_SUBSTRINGS=
DB_FORBIDDEN_URL_SUBSTRINGS=
```

Nouzový override (jen výjimečně):

```bash
ALLOW_UNSAFE_DB=1 npm run dev
```

## CI ověření guardu

Workflow `dev-db-safety` kontroluje:

1. že guard odmítne URL s `svetoplavci_prod`.
2. že guard propustí URL s `svetoplavci_test`.
3. že `npm run dev` stále obsahuje bezpečnostní guard.
