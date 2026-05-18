# Integrace RVP open data

## Účel

Importovat a verzovat oficiální RVP data jako základ pro vazby na OVU.

## Zásady

- Import je reprodukovatelný (verze datasetu + datum importu).
- Změna RVP se promítá přes verzování, ne přepis historie.

## Závazný zdroj (v1)

- Referenční verze: `24. 6. 2025`.
- Datová sada NKOD:
  - `https://data.gov.cz/datová-sada?iri=https%3A%2F%2Fdata.gov.cz%2Fzdroj%2Fdatové-sady%2F45768455%2F1562413075`
- Distribuce používaná aplikací:
  - JSON (full_mp): `https://opendata.npi.cz/download/rvp/data_final_rvp_zv_full_mp_20250624.json`
  - CSV (full_mp): `https://opendata.npi.cz/download/rvp/data_final_rvp_zv_full_mp_20250624.csv`
  - Schéma JSON: `https://opendata.npi.cz/download/rvp/schema_final_rvp_zv_full.json`
  - Schéma CSV: `https://opendata.npi.cz/download/rvp/schema_final_rvp_zv_full.csv`

## Provozní pravidla

- RVP je v aplikaci `read-only` referenční vrstva.
- Každý import ukládá:
  - URL zdroje,
  - verzi (z názvu souboru),
  - datum a čas importu,
  - hash souboru.
- Při vydání nové verze RVP nevzniká přepis, ale nová verze v systému.
