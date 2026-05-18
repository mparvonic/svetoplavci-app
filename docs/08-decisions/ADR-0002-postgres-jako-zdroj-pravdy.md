# ADR-0002 PostgreSQL jako zdroj pravdy

## Status

Proposed

## Kontext

Současný stav je historicky navázaný na Coda. Cíl projektu je postupné úplné odstřižení od Coda jako runtime zdroje dat.

## Rozhodnutí

PostgreSQL bude cílový zdroj pravdy pro provozní data aplikace Světoplavci. Externí systémy budou napájet data přes integrační vrstvu.

## Důsledky

- Pozitivní:
  - plná kontrola nad datovým modelem,
  - lepší auditovatelnost,
  - předvídatelný výkon.
- Negativní:
  - vyšší nárok na vlastní datovou správu,
  - nutnost řídit migrace dat a kontrakty integrací.
- Otevřené body:
  - detailní migrační plán tabulka po tabulce.

## Alternativy

- Zachovat Coda jako primární runtime datový zdroj.
- Hybridní model bez jasného source-of-truth.
