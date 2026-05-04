## DEV databaze: refresh z produkce s anonymizaci

Tento runbook zavadi standardni proces:

- `PROD` (`svetoplavci`): ostra data
- `TEST/STAGING` (`svetoplavci_test`): verna kopie produkce (bez anonymizace), stejne bezpecnostni omezeni jako produkce
- `DEV` (`svetoplavci_dev`): kopie produkce po anonymizaci

### Co je v repozitari

- anonymizace: `sql/anonymize_dev.sql`
- validace po anonymizaci: `sql/validate_dev_refresh.sql`
- orchestrace refresh procesu: `scripts/db-refresh-dev.sh`
- refresh staging kopie (bez anonymizace): `scripts/db-refresh-staging.sh`

### Pozadavky

- nastroje: `psql`, `pg_dump`, `pg_restore`
- DB ucet s opravnenim vytvaret/mazat databaze (pro `ADMIN_DB_URL`)
- nikdy nespoustet proti produkcni DB jako cil

### Povinne promenné

- `ADMIN_DB_URL` - admin spojeni (typicky DB `postgres`)
- `PROD_DB_URL` - zdroj (produkce)
- `DEV_DB_URL` - cilova dev DB
- `DEV_TMP_DB_URL` - docasna DB pro refresh

### Volitelne promenné

- `ANONYMIZE_SALT` - tajny salt pro deterministickou pseudonymizaci (doporuceno)
- `KEEP_TMP_DB=1` - ponecha docasnou DB po dokonceni

### Doporucene spusteni

```bash
export ADMIN_DB_URL='postgresql://.../postgres'
export PROD_DB_URL='postgresql://.../svetoplavci'
export DEV_DB_URL='postgresql://.../svetoplavci_dev'
export DEV_TMP_DB_URL='postgresql://.../svetoplavci_dev_refresh_tmp'
export ANONYMIZE_SALT='rotate-me-regularly'

./scripts/db-refresh-dev.sh
```

### Kontrola schema pred/po refreshi

Pred refreshi i po refreshi spust:

```bash
npm run db:check:schema
```

Pokud check selze, nejdriv dorovnej schema (migrace / SQL patch), az pak res data refresh.

### Spusteni pres npm scripts

```bash
npm run db:check:schema
npm run db:refresh:dev
npm run db:refresh:staging
npm run db:check:schema
```

`db:refresh:staging` vyzaduje:

- `ADMIN_DB_URL`
- `PROD_DB_URL`
- `STAGING_DB_URL`
- `STAGING_TMP_DB_URL`

### Co script dela

1. vytvori prazdnou `DEV_TMP` DB
2. nakopiruje data z `PROD` do `DEV_TMP`
3. spusti anonymizaci (`sql/anonymize_dev.sql`)
4. spusti validaci (`sql/validate_dev_refresh.sql`)
5. nahradi `DEV` databazi anonymizovanou kopii
6. znovu provede validaci
7. smaze `DEV_TMP` (pokud neni `KEEP_TMP_DB=1`)

### Minimalni anonymizacni pravidla (v1)

- `app_person`: jmena, identifiery, plus4u id pseudonymizovany; `chip_uid/chip_hid` nulovane
- `app_login_identity`: email identity na `@example.test`
- `app_person_source_record`: anonymizace `primary_email`, source id a citlivych klicu v payloadu
- `app_person_photo`: smazani blobu
- vybrane volne texty v eventech: maskovane + metadata `anonymized=true`

### Operacni poznamky

- `svetoplavci_test` ber jako produkcni data (ne-anonymizovana)
- `svetoplavci_dev` je jedine prostredi pro vyvojare
- pred kazdym vetsim testovanim je vhodny novy refresh `DEV`
- anonymizacni SQL drzte pod verzovanim a menite pouze pres PR

### Doporuceny harmonogram (cron/CI)

Minimalni bezpecny standard:

1. `staging` refresh z produkce:
: denne v noci (napr. `02:00 Europe/Prague`) pres `db-refresh-staging.sh`.
2. `dev` refresh + anonymizace:
: 2-3x tydne (napr. Po/St/Pá `03:00 Europe/Prague`) pres `db-refresh-dev.sh`.

Doporucene guardy v CI/jobu:

- job failne, pokud cilova DB jmena odpovida `svetoplavci`
- job zapisuje log s casem, source snapshotem a vysledkem validace
- `ANONYMIZE_SALT` je pouze v secrets (nikdy v repozitari)
- refresh bezi pod dedikovanym servisnim uctem

### Priklad cronu na serveru

```cron
# STAGING: daily full copy from PROD
0 2 * * * cd /path/to/svetoplavci-app && /usr/bin/env bash -lc 'source .env.db-refresh && npm run db:refresh:staging >> /var/log/svetoplavci/db-refresh-staging.log 2>&1'

# DEV: Mon/Wed/Fri anonymized refresh
0 3 * * 1,3,5 cd /path/to/svetoplavci-app && /usr/bin/env bash -lc 'source .env.db-refresh && npm run db:refresh:dev >> /var/log/svetoplavci/db-refresh-dev.log 2>&1'
```
