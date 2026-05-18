# Runbook: Sync uživatelů z Edookit

## Účel

Bezpečně a opakovatelně spouštět synchronizaci uživatelů (děti, zaměstnanci, rodiče z CSV) do interní DB aplikace.

## Předpoklady

- Nasazená verze aplikace obsahuje endpoint `POST /api/sync/users`.
- Nastavené env proměnné:
  - `EDOOKIT_BASE_URL=https://svetoplavci.edookit.net`
  - `EDOOKIT_API_USERNAME`
  - `EDOOKIT_API_PASSWORD`
  - `USER_SYNC_SECRET`
- Admin účet pro řešení konfliktů identity.

## 1) Prvotní sync (historie od 1. 9. 2021)

```bash
curl -X POST "https://app.svetoplavci.cz/api/sync/users" \
  -H "Authorization: Bearer $USER_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "initial",
    "date": "2021-09-01",
    "includeInactiveSince": "2021-09-01"
  }'
```

Poznámka: pokud se importují rodiče z CSV, je nutné spustit sync s `csvPath` dostupnou na serveru.

## 2) Denní sync

```bash
curl -X POST "https://app.svetoplavci.cz/api/sync/users" \
  -H "Authorization: Bearer $USER_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "daily"
  }'
```

## 3) Kontrola posledních běhů

```bash
curl -X GET "https://app.svetoplavci.cz/api/sync/users" \
  -H "Authorization: Bearer $USER_SYNC_SECRET"
```

## 4) Řešení konfliktů identity (varianta C)

Konflikt znamená, že stejný email je navázán na více osob a alespoň jedna vazba je `pending`.

### Výpis konfliktů

```bash
curl -X GET "https://app.svetoplavci.cz/api/admin/users/conflicts?limit=100" \
  --cookie "<admin-session-cookie>"
```

### Schválení vazeb

```bash
curl -X POST "https://app.svetoplavci.cz/api/admin/users/conflicts" \
  --cookie "<admin-session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{
    "identityId": "IDENTITY_ID",
    "approvedPersonIds": ["PERSON_ID_1", "PERSON_ID_2"]
  }'
```

Neschválené osoby se nastaví na `rejected`.

## 5) Doporučený cron (produkce)

Např. každý den v 05:15:

```cron
15 5 * * * curl -fsS -X POST "https://app.svetoplavci.cz/api/sync/users" -H "Authorization: Bearer ${USER_SYNC_SECRET}" -H "Content-Type: application/json" -d '{"mode":"daily"}' >> /var/log/svetoplavci/user-sync.log 2>&1
```

## Incident checklist

- `401 Unauthorized`:
  - ověřit `USER_SYNC_SECRET`.
- `500` při syncu:
  - ověřit dostupnost Edookit API,
  - ověřit platnost API účtu,
  - zkontrolovat payload v `app_user_sync_run.error`.
- Přihlášení uživatelů nefunguje:
  - zkontrolovat otevřené konflikty identity,
  - schválit odpovídající `approvedPersonIds`.
