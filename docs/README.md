# Dokumentace Světoplavci

Tato složka obsahuje aktuální technickou dokumentaci i obnovenou historickou dokumentaci projektu.

## Závazné aktuální principy

- PostgreSQL je zdroj pravdy pro provozní data aplikace.
- Coda je pouze archivní/migrační stopa a aplikace ji nesmí používat jako runtime zdroj.
- Auth a role běží přes interní aplikační model, ne přes Coda.
- Správa lodiček je portálové workflow, ne `/admin`.
- Sada lodiček je reprezentovaná jako `M01SvpVersion`.

## Struktura

- `architecture.md` - aktuální architektura aplikace.
- `auth.md` - aktuální autentizace a session.
- `security.md` - aktuální bezpečnostní model.
- `data-structures.md` - aktuální datové struktury.
- `coda-integration.md` - pravidla pro Coda jako archivní zdroj.
- `admin-roadmap.md` - provozní správa aplikace.
- `dev-database-refresh.md` - refresh DEV/TEST databází.
- `schema-rollout.md` - schema rollout a prevence DB driftu.
- `school-year-groups.md` - školní rok, skupiny a členství.

Obnovené historické složky:

- `01-product` - produktový kontext a role.
- `02-domain` - doménový model a pravidla.
- `03-architecture` - širší architektonické návrhy.
- `04-modules` - modulová dokumentace.
- `05-delivery` - checklisty a roadmapy.
- `06-quality` - testovací a kvalitativní dokumenty.
- `07-operations` - runbooky.
- `08-decisions` - ADR.
- `09-status` - datované stavové reporty.
- `10-templates` - šablony.

## Historické dokumenty

Soubory v `09-status` a některé runbooky zachycují stav v konkrétním datu. Mohou zmiňovat Coda jako tehdejší zdroj migrace. Tyto zmínky jsou historický kontext, ne aktuální návrhové pravidlo.

Při konfliktu mezi historickým reportem a aktuálními principy výše platí aktuální principy a současný kód.
