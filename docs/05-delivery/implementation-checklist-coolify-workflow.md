# Implementační checklist: multi-prostředí + workflow (Coolify)

Datum založení: 2026-04-02

## Cíl

Zavést konzistentní workflow pro:

- `proto-app.svetoplavci.cz` (rychlé prototypování),
- `test-app.svetoplavci.cz` (integrační test),
- `app.svetoplavci.cz` (produkce),
- s deploymentem přes GitHub + Coolify,
- a s řízeným občerstvováním test databáze z produkce.

## Aktuální stav (ověřeno)

- Domény `app.svetoplavci.cz`, `test-app.svetoplavci.cz`, `proto-app.svetoplavci.cz` směřují na `178.104.118.29`.
- Coolify běží na `coolify.parvonic.cz` a aplikace Světoplavci běží přes Coolify.
- Starý ruční kontejner `svetoplavci-app` je zastaven (`restart=no`), aby nekolidoval routing na `app.svetoplavci.cz`.
- Starý Coda sync cron je historický relikt. Runtime aplikace nesmí být závislý na Coda syncu.

## Fáze 0: Governance a Git model

- [x] Potvrdit cílové větve:
  - `main` -> produkce (`app`)
  - `staging` -> test (`test-app`)
  - `proto` -> prototyp (`proto-app`)
- [ ] Zavést branch protection pro `main`, `staging`, `proto`.
- [x] Definovat hotfix pravidlo:
  - `hotfix/*` z `main`, merge do `main`, následně back-merge do `staging`.

Done criteria:

- Všechny 3 větve mají povinné PR + review + status checks.

## Fáze 1: Coolify foundation na VPS

- [x] Nainstalovat Coolify na VPS.
- [x] Napojit GitHub repository.
- [x] Ověřit, že Coolify umí build/deploy image pro tento projekt.
- [x] Založit tým/projekt strukturu pro Světoplavci (`proto`, `test`, `prod`).

Done criteria:

- Coolify UI je dostupné a přihlášení funguje.
- Repo je připojeno a deployment test aplikace proběhne úspěšně.

Poznámka k riziku:

- Na VPS už běží Traefik na portech `80/443`.
- Instalace Coolify musí být provedena tak, aby nevznikl konflikt ingress vrstvy (nejdřív test setup, potom cutover).

## Fáze 2: Aplikace v Coolify

- [x] Založit app `svetoplavci-proto`:
  - doména `proto-app.svetoplavci.cz`
  - větev `proto`
  - environment: mock/proto režim
- [x] Založit app `svetoplavci-test`:
  - doména `test-app.svetoplavci.cz`
  - větev `staging`
  - vlastní DB
- [x] Založit app `svetoplavci-prod`:
  - doména `app.svetoplavci.cz`
  - větev `main`
  - produkční DB
- [x] Nastavit oddělené env/secrets pro každou app.

Done criteria:

- Každá větev deployuje jen do svého prostředí.
- Healthcheck všech 3 URL je zelený.

## Fáze 3: Databáze a migrace

- [x] Připravit 2 oddělené DB: `svetoplavci_prod`, `svetoplavci_test`.
- [x] V CI/CD použít pro server jen `prisma migrate deploy`.
- [x] Zakázat produkční používání `prisma db push`.
- [ ] Ověřit rollback postup DB migrací.

Done criteria:

- Migrace proběhnou na test/prod deterministicky přes `migrate deploy`.

## Fáze 4: Občerstvování test DB z produkce

- [x] Zavést plánovaný job `prod -> test` (aktuálně 2x denně v `06:25` a `12:25`).
- [x] Definovat ochranu test dat (v1):
  - refresh běží jako `upsert` bez `delete`,
  - test-only záznamy se nemažou.
- [x] Potvrdit rozhodnutí scope:
  - aktuálně zůstáváme na `v1`,
  - `v2/v3` odloženo (ADR-0003).
- [x] Logovat průběh a metriky refresh jobu.
- [x] Přidat alerting při chybě jobu.

Done criteria:

- Proběhnou alespoň 3 úspěšné refresh běhy bez ztráty `test_manual` dat.

## Fáze 5: Release + hotfix provoz

- [ ] Zavést runbook pro release `staging -> main`.
- [ ] Zavést runbook pro hotfix `main` + back-merge.
- [ ] Ověřit rollback aplikace (redeploy předchozí verze).

Done criteria:

- Simulovaný hotfix projde end-to-end a větve zůstanou synchronní.

## Fáze 6: Decommission starého runtime modelu

- [ ] Po stabilizaci vypnout staré ruční deploy pathy (mimo Coolify).
- [x] Aktualizovat provozní dokumentaci a status.

Done criteria:

- Světoplavci běží plně přes GitHub + Coolify workflow.

## První pracovní sprint (doporučeno)

1. Fáze 0 + Fáze 1.
2. Fáze 2 jen pro `test-app`.
3. Ověření deploy pipeline.
4. Až potom `proto-app` a `prod` převod.

## Průběžný log realizace

### 2026-04-02

- Ověřeno, že `app.svetoplavci.cz`, `test-app.svetoplavci.cz`, `proto-app.svetoplavci.cz` směřují na `178.104.118.29`.
- Ověřeno, že Světoplavci runtime aktuálně běží přes Docker/Traefik (Coolify pro Světoplavci zatím neběží).
- Založeny runbooky pro:
  - setup Coolify,
  - release/hotfix flow,
  - občerstvování test DB z produkce.
- Přidán GitHub workflow pro build image z `proto` větve (`.github/workflows/docker-build-proto.yml`).
- Přidán CI workflow pro lint změněných JS/TS souborů v PR (`.github/workflows/ci.yml`).
- Ověřeno, že v repozitáři aktuálně existují větve `main` a `staging`; `proto` je potřeba založit.
- Vytvořen pre-cutover snapshot konfigurace VPS:
  - `/srv/backups/miroslav/cutover-prep-20260402-235304.tar.gz`.
- Doplněn detailní no-downtime cutover plán:
  - `docs/07-operations/runbooks/coolify-cutover-no-downtime-plan.md`.
- Přidán a ověřen preflight skript:
  - `scripts/ops/coolify-cutover-preflight.sh`.

### 2026-04-03

- Opraven deploy `staging` image:
  - v `staging` branch vypnuto `prisma db push` během Docker build kroku.
  - GitHub Actions build `:staging` proběhl úspěšně.
- Ověřen a dokončen cutover do Coolify:
  - `svetoplavci-prod` (`main`) běží na `app.svetoplavci.cz`,
  - `svetoplavci-test` (`staging`) běží na `test-app.svetoplavci.cz`,
  - `svetoplavci-proto` (`proto`) běží na `proto-app.svetoplavci.cz`.
- Opraven kritický problém auth DB konektivity:
  - nasazena DB proxy `svetoplavci-auth-db-proxy` mezi `edge_net` a `prod_net`,
  - opraveny `POSTGRES_PRISMA_URL` pro `prod`, `test`, `proto`,
  - vytvořena oddělená test databáze `svetoplavci_test` jako klon produkce.
- Eliminována routing kolize:
  - starý kontejner `svetoplavci-app` zastaven a přepnut na `restart=no`.
- Ověřeny smoke testy:
  - `app`, `test-app`, `proto-app` vrací očekávané HTTP odpovědi,
  - `app/auth/signin` i `test-app/auth/signin` vrací `200`.
- Zavedeno občerstvování `prod -> test`:
  - vytvořen skript `scripts/ops/refresh-test-db-from-prod.sh`,
  - nasazen na VPS jako `/usr/local/sbin/svetoplavci-refresh-test-db.sh`,
  - nastaven cron `25 6,12 * * *` s logem `/var/log/svetoplavci/test-db-refresh.log`,
  - audit běhů v `svetoplavci_test.ops.test_db_refresh_runs`.
- Zaveden runtime migration model:
  - `docker-entrypoint.sh` spouští `prisma migrate deploy`,
  - Docker image obsahuje Prisma CLI + `prisma/migrations`,
  - `prisma db push` není součást deploy flow.
- Zaveden health + alerting check refresh jobu:
  - skript `/opt/prod/jobs/monitoring/check_test_db_refresh_status.sh`,
  - cron check `35 6,12 * * *`,
  - výstupy v `/var/log/svetoplavci/health.log` a `/var/log/svetoplavci/alerts.log`.
- Potvrzen scope rozhodnutí:
  - aktuálně zůstáváme na `v1`,
  - návrat k `v2/v3` je evidován v `docs/08-decisions/ADR-0003-fazovana-strategie-obcerstvovani-test-db.md`.
