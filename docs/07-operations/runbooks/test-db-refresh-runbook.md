# Runbook: občerstvování test DB z produkce

## Cíl

Udržovat `svetoplavci_test` databázi blízko produkčních dat (`svetoplavci`) bez mazání test-only dat.

## Princip

- Job běží jako **non-destructive refresh**:
  - z produkce se dělá `INSERT ... ON CONFLICT ... DO UPDATE`,
  - **neprovádí se `DELETE`** v test DB.
- Důsledek:
  - produkční řádky se v test DB průběžně aktualizují,
  - test-only řádky zůstávají zachované.

## Předpoklady

- Oddělené DB pro `prod` a `test`.
- Přístupové údaje jsou mimo git (`/root/.svetoplavci-refresh.env`).
- PostgreSQL běží v kontejneru `svetoplavci-app-postgres`.

## Implementace (aktuální)

- Skript v repozitáři:
  - `scripts/ops/refresh-test-db-from-prod.sh`
  - `scripts/ops/check-test-db-refresh-status.sh`
- Skript nasazený na VPS:
  - `/usr/local/sbin/svetoplavci-refresh-test-db.sh`
  - `/opt/prod/jobs/monitoring/check_test_db_refresh_status.sh`
- Env soubor na VPS:
  - `/root/.svetoplavci-refresh.env` (`chmod 600`)
  - obsahuje `PGPASSWORD=...`
- Audit tabulka:
  - `svetoplavci_test.ops.test_db_refresh_runs`
- Backupy:
  - `/var/lib/postgresql/data/backups/svetoplavci-test-refresh/`
- Log:
  - `/var/log/svetoplavci/test-db-refresh.log`
  - `/var/log/svetoplavci/health.log` (health check výsledky)
  - `/var/log/svetoplavci/alerts.log` (alerty)

## Plánovaný běh (cron)

```
25 6,12 * * * . /root/.svetoplavci-refresh.env && RUN_TAG=cron /usr/local/sbin/svetoplavci-refresh-test-db.sh >> /var/log/svetoplavci/test-db-refresh.log 2>&1
35 6,12 * * * /opt/prod/jobs/monitoring/check_test_db_refresh_status.sh >> /var/log/svetoplavci/health.log 2>&1
```

Historicky byl tento běh navázaný na Coda sync pipeline. Aktuálně se Coda nepoužívá jako runtime zdroj; refresh se má řídit PostgreSQL backup/restore postupem a následnou anonymizací.

## Manuální spuštění

```bash
set -a
. /root/.svetoplavci-refresh.env
set +a
RUN_TAG=manual /usr/local/sbin/svetoplavci-refresh-test-db.sh
```

Rychlý běh bez backupu:

```bash
set -a
. /root/.svetoplavci-refresh.env
set +a
RUN_TAG=manual_quick NO_BACKUP=1 /usr/local/sbin/svetoplavci-refresh-test-db.sh
```

## Kontrola výsledku

- počet řádků na klíčových tabulkách není nulový,
- poslední běh v `ops.test_db_refresh_runs` má `status = success`,
- timestamp posledního běhu je aktuální.
- health check zapsal `OK test-db-refresh ...` do `/var/log/svetoplavci/health.log`.

Kontrolní SQL:

```sql
select id, started_at, finished_at, status, run_tag, tables_processed, rows_written, message
from ops.test_db_refresh_runs
order by id desc
limit 10;
```

## Failure handling

- Při chybě zkontrolovat:
  - `/var/log/svetoplavci/test-db-refresh.log`
  - `/var/log/svetoplavci/alerts.log`
  - poslední řádek v `ops.test_db_refresh_runs.message`
- Pokud je potřeba rollback, obnovit poslední dump test DB:
  - soubory `test-before-refresh-*.dump` v backup adresáři.
- Incident zapsat do `docs/07-operations/incident-log.md`.

## Poznámka

Aktuální preserve model neřeší oddělení `prod_sync`/`test_manual` na úrovni sloupce. Ochrana je teď řešena tím, že refresh nemaže test-only záznamy.

## Rozhodnutí scope (2026-04-03)

- Pro aktuální fázi projektu zůstáváme na `v1` modelu refresh.
- Robustní varianty `v2/v3` jsou odloženy na pozdější fázi.
- Formální rozhodnutí je v ADR:
  - `docs/08-decisions/ADR-0003-fazovana-strategie-obcerstvovani-test-db.md`
