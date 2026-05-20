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

## Rychlý hotfix

Rychlý hotfix je určený pro malé, reverzibilní změny s nízkým rizikem: skrytí tlačítka, opravu textu, vypnutí části UI, drobný guard nebo konfiguraci. Cíl je jeden izolovaný commit, jeden Docker build na GX10, push hotového image tagu a přímý Coolify deploy. Rychlá cesta nečeká na GitHub PR, branch protection ani GitHub Actions.

Základní postup:

1. Nastaguj jen přesné soubory hotfixu: `git add cesta/k/souboru`.
2. Ověř staged diff: `git diff --cached`.
3. Test + produkce jedním průchodem: `npm run release:hotfix -- --message "fix: short summary"`.
4. Jen test: `npm run hotfix:test -- --message "fix: short summary"`.
5. Jen produkce: `npm run hotfix:prod -- --message "fix: short summary"`.
6. Volitelná lokální precheck fáze před Docker buildem: přidej `--precheck`.

Skript `hotfix:*`:

- nikdy nedělá `git add -A`, pokud není explicitně předán `--include-all`,
- vytváří dočasný izolovaný `git worktree`, kde commitne pouze staged diff a ignoruje ostatní rozpracované lokální změny,
- pro produkci přerovná hotfix commit nad aktuální `origin/main`,
- spustí Docker build přes SSH přímo na GX10 v lokálním worktree mimo Mac NFS mount,
- pro `hotfix:both` buildí jen jednou a pouze přidá tagy `:staging`, `:latest` a `:sha-...`,
- pushne hotový image do registry, kterou Coolify sleduje,
- zavolá Coolify deploy hook pro vybraná prostředí,
- zapisuje auditní JSONL záznam s commitem, cíli, časem, autorem, důvodem a výsledkem deploy hooku.

Konfigurace:

```bash
HOTFIX_DEPLOY_MODE=image
HOTFIX_GX10_HOST=gx10
HOTFIX_GX10_REPO_PATH=/srv/projects/svetoplavci-app
HOTFIX_GX10_BUILD_ROOT=/data/tmp/svetoplavci/hotfix-image-builds
HOTFIX_BUNDLE_DIR=/data/projects/svetoplavci-app/hotfix-bundles

HOTFIX_IMAGE_NAME=ghcr.io/mparvonic/svetoplavci-app
HOTFIX_GHCR_USER=mparvonic
HOTFIX_GHCR_TOKEN=...
HOTFIX_DOCKER_POSTGRES_PRISMA_URL=...

HOTFIX_TEST_REMOTE=origin
HOTFIX_TEST_BRANCH=staging
HOTFIX_TEST_DEPLOY_WEBHOOK=https://...

HOTFIX_PROD_REMOTE=origin
HOTFIX_PROD_BRANCH=main
HOTFIX_PROD_DEPLOY_WEBHOOK=https://...
HOTFIX_DEPLOY_AUTH_BEARER=...

HOTFIX_AUDIT_LOG=/data/projects/svetoplavci-app/hotfix-audit.jsonl
HOTFIX_WORKTREE_ROOT=/data/tmp/svetoplavci/hotfix-worktrees
```

`HOTFIX_GHCR_TOKEN` musí mít právo zapisovat package do GHCR (`write:packages`). `HOTFIX_DOCKER_POSTGRES_PRISMA_URL` je jen build-time Prisma URL; runtime databázi dál určuje env v Coolify. Pokud není nastavená, skript použije `POSTGRES_PRISMA_URL`.

Alternativní názvy hooků jsou `COOLIFY_TEST_DEPLOY_WEBHOOK` a `COOLIFY_PROD_DEPLOY_WEBHOOK`. Alternativní název pro Bearer token je `COOLIFY_API_TOKEN`.

Hotfix skript načítá secrets z prostředí a potom z těchto souborů, pokud existují:

- `HOTFIX_ENV_FILE`
- `.env.local`
- `/Users/miroslav/Projects/gx10/data/projects/svetoplavci-app/secrets/env.local`
- `/data/projects/svetoplavci-app/secrets/env.local`

Git fallback existuje jen pro situaci, kdy image lane není dostupná. Spustí původní chráněnou cestu přes větve:

```bash
npm run release:hotfix -- --mode git --message "fix: short summary"
```

Stav konfigurace:

```bash
npm run hotfix:status
```

Bez `HOTFIX_AUDIT_LOG` se audit zapisuje do ignorovaného lokálního souboru `.tmp/hotfix-audit.jsonl`. Pro provoz nastav trvalou cestu mimo repozitář, ideálně na GX10. Image lane zároveň ukládá git bundle hotfix commitu do `HOTFIX_BUNDLE_DIR`, aby šel později dohledat a promítnout do standardního Git toku.

## Codex, NFS a buildy

NFS mount nesmí být součást release/hotfix cesty. Pokud se `scripts/hotfix-release.mjs` spustí z Mac mountu `/Users/miroslav/Projects/gx10/...`, okamžitě se přes SSH znovu spustí na GX10 v `/srv/projects/svetoplavci-app` a Mac proces skončí jako pouhý wrapper.

Pravidla:

- Git status, diff, index, commit-tree a archive pro hotfix běží na GX10 lokálně.
- Build kontext vzniká z `git archive` na GX10, ne čtením přes NFS.
- Docker image se buildí na hostu nastaveném v `HOTFIX_IMAGE_BUILD_HOST`; pro produkční VPS architekturu je výchozí `vps`.
- Dočasné build adresáře jsou mimo repo a mimo NFS.
- Audit log je na `/data/projects/svetoplavci-app/hotfix-audit.jsonl`.

Pokud má být bez NFS i samotné čtení a editace souborů Codexem, nepoužívat Codex Desktop nad Mac mountem; pro release zásahy spouštět Codex CLI přímo na GX10 v `/srv/projects/svetoplavci-app`. Desktop nad NFS je pouze pohodlné zobrazení/editace, ne provozní release prostředí.

## GitHub nastavení

Pro `main` ponechat branch protection a povinné kontroly pro standardní release. Nezeslabovat ochranu produkční větve jen kvůli hotfixům; rychlá cesta ji nepotřebuje, protože deployuje hotový image tag a ukládá audit mimo větev.

Doporučené nastavení:

- `main`: vyžadovat PR, povinné checks, zakázat přímý push běžným uživatelům.
- `staging`: může zůstat chráněná pro standardní lane; hotfix image lane ji nepotřebuje.
- GitHub Actions `docker-build*`: ponechat pro standardní release, ne pro urgentní hotfix.
- Hotfix evidence: po urgentním deployi vytvořit následný PR nebo backport commit do `staging/main`, ale tento krok už nesmí blokovat nasazení.
- GHCR: vytvořit samostatný fine-grained token pro hotfix lane s minimálním právem zapisovat package `mparvonic/svetoplavci-app`; uložit jako `HOTFIX_GHCR_TOKEN` do `/data/projects/svetoplavci-app/secrets/env.local`.

## Pomalý hotfix přes PR

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
