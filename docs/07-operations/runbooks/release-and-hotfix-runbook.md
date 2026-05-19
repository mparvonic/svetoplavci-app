# Runbook: release a hotfix workflow

## Branch model

- `proto` -> `proto-app.svetoplavci.cz`
- `staging` -> `test-app.svetoplavci.cz`
- `main` -> `app.svetoplavci.cz`

## Standardní release

1. Lokální diagnostika: `npm run ops:doctor`.
2. Test release: `npm run release:test -- --message "fix: short summary"`.
3. Ověření na `test-app`.
4. Produkční release: `npm run release:prod`.
5. Merge PR `staging -> main` po kontrole, případně `npm run release:prod -- --auto-merge`.
6. Post-deploy smoke test.

Skripty jsou závazná cesta pro agenty. Neřešit ručně, jestli pushnout `staging`, jaký host odpovídá testu nebo jak se otevírá produkční PR; skript tuto logiku drží na jednom místě.

## Hotfix

1. Vytvořit `hotfix/*` z `main`.
2. Oprava + commit.
3. `npm run release:test -- --message "fix: short summary"` pokud se má hotfix nejdřív ověřit na testu.
4. Produkční PR přes `npm run release:prod` ze `staging`, nebo ruční hotfix PR do `main` jen při kritickém zásahu.
5. Back-merge hotfixu do `staging`, pokud šel mimo standardní `staging -> main` tok.
6. Ověřit, že `staging` obsahuje stejný fix.

## Kontrolní seznam po release/hotfix

- `prisma migrate deploy` proběhl při startu nové verze bez chyby,
- login flow funguje,
- klíčové API odpovídá,
- bez kritických chyb v logu,
- metriky/healthcheck jsou zelené.
