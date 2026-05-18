# M01 ŠVP lodičky import verification (2026-04-04)

## Scope

- Cíl: naplnit test DB (`svetoplavci_test`) o číselníky ŠVP a lodičky (bez osobních sad lodiček).
- Zdroj CSV: `/Users/miroslav/Downloads/Lodičky od 1.9.2025.csv`.
- Script: `scripts/import-svp-lodicky-2025-from-csv.mjs`.

## Aplikované změny schématu

- Migrace: `20260404134000_m01_stage_dimensions_and_lodicka_garanti`
- Přidány sloupce `stupen` do:
  - `app_m01_predmet`,
  - `app_m01_podpredmet`,
  - `app_m01_oblast`.
- Přidána tabulka `app_m01_lodicka_garant` (M:N vazba lodička-garant).

## Výsledek importu

- `svpVersionId`: `cmnk83id90000g5f3mqljgkvd`
- `svpLabel`: `2025`
- `importedLodicky`: `604`
- `importedOblasti`: `71`
- `importedOvuLinks`: `744`
- `importedPrereqLinks`: `259`
- `importedGarantLinks`: `1428`

## Stav tabulek po importu

- `app_m01_svp_version`: `1`
- `app_m01_predmet`: `10`
- `app_m01_podpredmet`: `11`
- `app_m01_oblast`: `71`
- `app_m01_lodicka`: `604`
- `app_m01_lodicka_garant`: `1428`
- `app_m01_lodicka_ovu_link`: `744`
- `app_m01_lodicka_prerequisite`: `259`
- `app_m01_osobni_sada_lodicek`: `0`
- `app_m01_osobni_lodicka`: `0`

## Otevřené body

- `Garant`:
  - `unresolvedGarants = 0` (mapování upraveno na primární párování přes `app_person.nickname`).
- `Prerekvizita`:
  - `unresolvedPrereq = 32` (nejednoznačné nebo nenalezené textové reference).
- `OVU`:
  - `unresolvedOvu = 0`.
