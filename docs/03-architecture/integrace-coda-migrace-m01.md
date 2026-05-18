# Coda pro M01 (archivní stopa)

## Účel

Historicky byla Coda použitá jako přechodový zdroj pro naplnění modulu M01:

- lodičky,
- osobní lodičky (aktuální stav),
- historie osobních lodiček.

Aktuální stav je provoz bez závislosti na Coda. Aplikace nesmí Coda používat jako runtime zdroj.

## Závazné zdrojové tabulky

- Lodičky: `grid-tKkiEMWXEO`
- Osobní lodičky (aktuální stav): `grid-3m-_XP8oMp`
- Historie osobních lodiček: `grid-nYzDRw4zl3`

## Historický režim přenosu

- `v1`: jednorázová migrace + validační doimporty podle potřeby.
- Průběžný dlouhodobý sync z Coda se pro M01 neplánuje a nesmí se zavádět jako nový runtime mechanismus.

## Zásady importu

- Z Coda se přenáší jen zdrojová data, ne vypočítané pomocné sloupce, pokud nejsou nutné pro audit.
- Historie osobních lodiček je `append-only` zdroj.
- Každý import je auditovaný (`source_table_id`, `imported_at`, `row_count`, `checksum`).
- Import musí být idempotentní (opakovaný běh nesmí vytvářet duplicity).

## Aktuální pravidlo

- Coda je pro M01 archivní zdroj.
- Nové změny M01 se zapisují jen do aplikace/PostgreSQL.
- Coda metadata se uchovávají pouze pro zpětné ověření migrace.
