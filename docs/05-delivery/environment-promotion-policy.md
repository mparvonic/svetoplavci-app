# Environment Promotion Policy (Agent Standard)

Datum aktualizace: 2026-04-06

Tento dokument je závazný technický standard pro AI agenty a vývojáře.
Cíl: zachovat 1:1 konzistenci UI a funkčnosti mezi prostředími a eliminovat rozpady při přenosu.

## 1. Prostředí a role

| Vrstva | Prostředí | URL | Git zdroj | Účel |
|---|---|---|---|---|
| P0 | Local (Mac) | `localhost:3000` | `feature/*` | Implementace a integrace |
| P1 | Proto | `proto-app.svetoplavci.cz` | `proto` | UX prototyp nad mock daty |
| P2 | Test | `test-app.svetoplavci.cz` | `staging` | Integrační test nad test daty |
| P3 | Prod | `app.svetoplavci.cz` | `main` | Produkční provoz |

## 2. Principy, které jsou povinné

1. `Single UI Source`: Produkční UI komponenta existuje pouze jednou a sdílí se mezi Proto/Local/Test/Prod.
2. `Adapter Pattern`: Data se přepínají přes adaptery (`mock`, `api`, `db`) bez změny UI komponenty.
3. `Build Once, Promote Artifact`: stejný artifact (image digest) se promuje P2 -> P3.
4. `No Environment Naming in App Code`: v aplikačním kódu (mimo izolované prototypové složky) se nesmí zavádět identifikátory nesoucí názvy prostředí (`proto`, `staging`, `test`, `prod`, `dev`).
5. `Proto Isolation`: proto-specifické nástroje (role switcher, debug menu, mock action toolbar) žijí pouze v `app/(prototype)` a nesmí se importovat do dashboard/runtime kódu.
6. `Traceability`: každý přechod mezi prostředími musí mít promotion záznam v `docs/09-status/promotions/`.

## 3. Povolené přechody

1. `feature/* -> proto` (UX validace nad mocky)
2. `feature/* -> staging` (DEV výstup do testu)
3. `staging -> main` (release do produkce)
4. `main -> proto` (synchronizace proto katalogu/mock coverage po release)

Nepovolené přechody:

- Přímý deploy Local -> Test/Prod
- Přímý deploy Proto -> Prod
- Produkční hotfix bez následného návratu do `staging`

## 4. Co musí agent dodat při každém kroku

### 4.1 Proto fáze (`feature/* -> proto`)

1. UX prototyp a interakce nad mock daty.
2. Seznam rozhodnutí, co je shared UI a co je proto-only wrapper.
3. Záznam v `docs/09-status/` (co se ověřilo a co je schválený stav).

### 4.2 DEV/Test fáze (`feature/* -> staging`)

1. Shared UI komponenta identická s proto schváleným návrhem.
2. Přepnutí na integrační adaptery (API/DB), bez změny vizuálu.
3. Promotion záznam v `docs/09-status/promotions/` dle šablony.
4. Bez změn v `app/(prototype)` a `src/lib/mock` v tomto promotion PR.

### 4.3 Release (`staging -> main`)

1. Promotion záznam s release checklistem.
2. Potvrzení, že test a prod používají stejný artifact class (build parity).
3. Post-release plán synchronizace proto mock pokrytí.

### 4.4 Sync back (`main -> proto`)

1. Aktualizace mock coverage matrix (které moduly mají aktuální mock scénář).
2. Dopsání chybějících mock scénářů pro nové moduly.
3. Záznam do status dokumentace.

## 5. Struktura kódu (norma)

### 5.1 Shared UI

- Umístění: `src/components/<domain>/...` nebo `components/<domain>/...`
- Bez závislosti na konkrétním prostředí.

### 5.2 Adaptery

- Umístění: `src/lib/<domain>/adapters/`
- Rozhraní: `src/lib/<domain>/ports/`
- Implementace:
  - `mock` adapter pro prototypování
  - `api` nebo `db` adapter pro runtime

### 5.3 Proto-only wrapper

- Umístění: pouze `app/(prototype)/...`
- Může obsahovat přepínače rolí a demo/debug prvky.
- Nesmí být importovaný z `app/(dashboard)` ani z runtime API.

## 6. Povinný deník a audit

Povinné dokumenty:

1. `docs/09-status/changelog.md`
2. `docs/09-status/current-status.md`
3. Promotion záznamy v `docs/09-status/promotions/`

Každý promotion záznam musí obsahovat minimálně:

- zdroj/cíl prostředí
- seznam commitů
- seznam modulů/stránek
- parity check (UI + funkce)
- data mode (`mock` / `test` / `prod`)
- rollback plán

## 7. Co je vynucováno automaticky

CI policy guard (`.github/workflows/policy-guard.yml`) kontroluje PR do `proto`, `staging`, `main`.

Automaticky se blokuje PR, pokud:

1. chybí update ve `docs/09-status/`
2. pro `staging` nebo `main` chybí promotion záznam
3. pro `staging` nebo `main` obsahuje změny v `app/(prototype)` nebo `src/lib/mock`
4. mimo prototypové složky zavádí environment-based identifikátory (`proto|staging|test|prod|dev`)
5. runtime kód importuje prototype route group

## 8. Výjimky

Výjimka je možná jen přes explicitní rozhodnutí v ADR a s odkazem v promotion záznamu.
Bez ADR je výjimka neplatná.
