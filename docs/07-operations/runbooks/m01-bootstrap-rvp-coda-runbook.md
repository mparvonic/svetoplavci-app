# Runbook: Bootstrap M01 dat (RVP + historická Coda migrace)

## Účel

Historický runbook pro bezpečný bootstrap dat M01:

- import RVP z open dat,
- import lodiček z Coda,
- import osobních lodiček a jejich historie z Coda.

## Zdroje

- RVP open data:
  - `data_final_rvp_zv_full_mp_20250624.json`
- Coda tabulky:
  - `grid-tKkiEMWXEO` (Lodičky),
  - `grid-3m-_XP8oMp` (Osobní lodičky),
  - `grid-nYzDRw4zl3` (Historie osobních lodiček).

## Historické předpoklady

- Historicky nastavené env pro jednorázový export:
  - `CODA_DOC_ID`,
  - `CODA_API_TOKEN`.
- Přístup do DB prostředí, kde se bootstrap provádí.
- Schválený plán verze ŠVP pro cílová data.

## Aktuální stav

Migrace je považovaná za dokončenou. Tento runbook slouží jako archivní dokumentace původu dat a postupů ověření. Běžný provoz aplikace nesmí číst z Coda API.

## Postup (v1)

1. Stáhnout RVP open data do raw snapshotu.
2. Exportovat Coda tabulky do raw snapshotu.
3. Spustit transformaci lodiček.
4. Spustit transformaci osobních lodiček.
5. Spustit transformaci historie osobních lodiček.
6. Spustit validační report.
7. Potvrdit výsledek a uzavřít bootstrap běh.

### Raw export příkazy

```bash
npm run rvp:export:2025-06-24 -- --out /tmp/rvp-bootstrap
npm run coda:export:m01 -- --out /tmp/coda-m01-bootstrap
```

## Kontroly po běhu

- Počet importovaných lodiček odpovídá zdrojové Coda tabulce.
- Počet osobních lodiček odpovídá zdrojové Coda tabulce.
- Historie je append-only a časově konzistentní.
- Poslední historický stav odpovídá aktuálnímu stavu osobní lodičky.

## Historický incident checklist

- Historicky chybějící přístup do Coda při exportu:
  - ověřit `CODA_API_TOKEN`,
  - ověřit `CODA_DOC_ID`.
- Chybějící vazby (žák/lodička):
  - spustit validační report,
  - opravit mapování a opakovat běh.
- Nekonzistence historie:
  - ověřit deduplikaci dle `Kód osobní lodičky`,
  - zkontrolovat pořadí událostí podle datumu.
