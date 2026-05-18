# M01 Status

## Stav k 2026-04-05

- Fáze: `ŠVP lodičky + osobní lodičky + historie (v1 import dokončen)`
- RAG: `Green`
- Owner: `TBD`

## Co je hotové

- Definovaný rámec požadavků, doménového modelu, API návrhu a implementačního plánu.
- Schválené workflow verzování ŠVP (`MINOR/MAJOR`) a migrace osobních lodiček.
- Potvrzené zdroje pro bootstrap M01:
  - RVP z open dat (`full_mp`, verze 24. 6. 2025),
  - Historické Coda tabulky: `grid-tKkiEMWXEO`, `grid-3m-_XP8oMp`, `grid-nYzDRw4zl3`.
- Založen implementační checklist bootstrapu dat M01.
- Implementována a nasazena DB struktura M01 + AI projekční vrstva na `svetoplavci_test`.
- Opraven model RVP uzlových bodů (`source_path` místo unikátnosti podle `kod`).
- Implementován a spuštěn import RVP 24. 6. 2025 do `svetoplavci_test`:
  - `app_m01_rvp_version`: 1 aktivní verze,
  - `app_m01_rvp_uzlovy_bod`: 327,
  - `app_m01_rvp_ovu`: 475.
- Rozšířen model ŠVP číselníků o `stupen`:
  - `M01Predmet`,
  - `M01Podpredmet`,
  - `M01Oblast`.
- Přidána M:N vazba `lodička <-> garant` (`M01LodickaGarant`).
- Proveden import `Lodičky od 1.9.2025.csv` do `svetoplavci_test`:
  - `svp`: 1 (`label=2025`),
  - `predmet`: 10,
  - `podpredmet`: 11,
  - `oblast`: 71,
  - `lodicka`: 604,
  - `lodicka_garant`: 1428,
  - `lodicka_ovu_link`: 744,
  - `lodicka_prerequisite`: 259.
- Připraveno verzované kódování lodiček:
  - formát `2025-SP-CJ-5-001` (prefix verze ŠVP).
- Připraven import osobních lodiček a historie jako eventů:
  - skript `scripts/import-svp-osobni-lodicky-and-events-2025-from-csv.mjs`,
  - krok 1: vytvoření sad a osobních lodiček (`žák + lodička stupně`),
  - krok 2: import historie z CSV jako `append-only` eventy,
  - krok 3: projekce aktuálního stavu s kontrolou shody proti poslednímu eventu.
- Připravena migrace pro guard projekce a univerzální poznámky:
  - `20260404162000_m01_events_notes_projection_guard`.
- Migrace `20260404162000_m01_events_notes_projection_guard` aplikována na `svetoplavci_test`.
- Na `svetoplavci_test` proveden reimport lodiček s verzovanými kódy:
  - všechny lodičky ve formátu `2025-*`.
- Na `svetoplavci_test` proveden krok 1 bootstrapu osobních lodiček (bez historie):
  - `preparedStudents`: 106,
  - `osobni_sada_lodicek`: 106,
  - `osobni_lodicka`: 32044,
  - `osobni_lodicka_event`: 0 (historie zatím nespouštěna).
- Dotažen bootstrap osobních lodiček z CSV:
  - `osobni_sada_lodicek`: 107,
  - `osobni_lodicka`: 32210.
- Proveden import historie osobních lodiček:
  - `historyRows`: 14175,
  - `historyInserted`: 14159,
  - `historyUnresolvedLodicka`: 0,
  - `historyUnresolvedStav`: 16 (export mimo import),
  - `baselineEventsInserted`: 19626,
  - `projectionMismatch`: 0.
- Zaveden audit-safe mechanismus oprav historie:
  - pole `is_invalidated`, `invalidated_at`, `invalidated_reason`, `invalidated_by_event_id`,
  - migrace `20260405091500_m01_event_invalidation`.
- Upraveny projekce tak, aby pracovaly jen s aktivními (`is_invalidated = false`) eventy.
- Spuštěna hromadná oprava backdated konfliktů na `svetoplavci_test`:
  - nalezeno/zneplatněno `171` eventů,
  - následná verifikace: `candidatesTotal=0`, `projectionMismatch=0`.

## Co chybí

- Implementace API a výpočtů.
- UI pro průvodce a portálovou správu lodiček.
- Test suite.
- Doplnit řešení pro 16 nevalidních řádků historie (chybějící stav/datum) a rozhodnout jejich finální zpracování.
- Zpřesnit normalizaci porovnávacích reportů (např. `VEX` vs `Velké expedice`) kvůli falešným rozdílům.

## Aktuální poznámka

Coda je po migraci pouze archivní stopa. Nový M01 runtime nesmí číst z Coda API.

## Blokery

- Upřesnění pravidel vážení hodnocení.
- Otevřené ruční dočištění prerekvizit:
  - `unresolvedPrereq = 32`.
