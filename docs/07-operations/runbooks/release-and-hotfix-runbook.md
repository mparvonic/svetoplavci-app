# Runbook: release a hotfix workflow

## Branch model

- `proto` -> `proto-app.svetoplavci.cz`
- `staging` -> `test-app.svetoplavci.cz`
- `main` -> `app.svetoplavci.cz`

## Standardní release

1. Feature větve merge do `staging`.
2. Ověření na `test-app`.
3. PR `staging -> main`.
4. Merge + deploy produkce.
5. Post-deploy smoke test.

## Hotfix

1. Vytvořit `hotfix/*` z `main`.
2. Oprava + PR do `main`.
3. Deploy produkce.
4. Back-merge hotfixu do `staging`.
5. Ověřit, že `staging` obsahuje stejný fix.

## Kontrolní seznam po release/hotfix

- `prisma migrate deploy` proběhl při startu nové verze bez chyby,
- login flow funguje,
- klíčové API odpovídá,
- bez kritických chyb v logu,
- metriky/healthcheck jsou zelené.
