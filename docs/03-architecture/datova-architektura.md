# Datová architektura

## Princip

PostgreSQL je cílový zdroj pravdy pro aplikační data Světoplavci.

## Datové vrstvy

- `raw import`: technický otisk externích dat (např. import z Coda/Edookit).
- `core domain`: normalizované entity domény.
- `read model`: odvozené pohledy pro dashboardy a reporty.
- `ai index`: textové znalostní položky, chunky a embeddingy pro AI dotazování.
- `archive snapshot`: neměnné podklady pro vysvědčení a triangly.

## AI-ready princip

- Klíčová data (RVP, lodičky, osobní lodičky, historie) musí jít převést do `ai index` vrstvy.
- AI index odděluje:
  - zdrojovou entitu (`source_table`, `source_id`),
  - textovou reprezentaci (`body_text`, chunking),
  - embedding vrstvu (model, dimenze, stav).
- Návrh umožňuje:
  - interní uložení embeddingů v PostgreSQL,
  - i napojení na externí vektorovou DB přes `external_vector_id`.

## Datová governance

- každá zásadní entita má `created_at`, `updated_at`, `created_by`, `updated_by`;
- citlivé změny mají auditní event;
- verzované entity mají `version` + `valid_from`/`valid_to`.
- časové údaje se řídí standardem: `docs/03-architecture/cas-a-timezone-standard.md`.
