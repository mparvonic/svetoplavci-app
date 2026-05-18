# Integrace Google Calendar

## Účel

Publikace osobních a skupinových kalendářů z aplikace Světoplavci do Google Workspace for Education.

## Principy

- V aplikaci je interní source-of-truth, Google Calendar je distribuční vrstva.
- Události jsou idempotentní (upsert podle stabilního `source_key`).
- Změny rozvrhu se aplikují přes delta trigger, finální stav se vždy ověřuje proti aktuálnímu rozvrhu.
- Kritické operace jsou auditované a běží přes frontu jobů.

## Google Workspace model

- Service account s Domain-Wide Delegation.
- Impersonace technického účtu (např. `kalendar-bot@svetoplavci.cz`).
- Pro každého žáka se vytváří vlastní Google kalendář.
- Volitelně se zakládají skupinové kalendáře (`smečka`, `posádka`, `kurz`).

## Datový model (M11 foundation)

- `app_calendar_provider_config`: konfigurace provideru (Google Workspace, service account, impersonace).
- `app_student_calendar`: vazba žák -> Google `calendar_id`.
- `app_group_calendar`: vazba skupina -> Google `calendar_id`.
- `app_calendar_event_link`: mapování interního zdroje (`lesson`, `school_event`) na Google event.
- `app_calendar_sync_job`: fronta synchronizačních jobů.
- `app_calendar_sync_cursor`: checkpointy delta synchronizace.
- `app_school_event_type`: číselník typů akcí s pravidly vazby na rozvrh/kalendář.
- `app_school_event`, `app_school_event_target`: konkrétní akce a cílení na osoby/skupiny.

## Pravidla číselníku typů akcí

Každý typ akce je řízen konfiguračně:

- `calendar_behavior`: `none | separate_event | update_linked_lesson`
- `schedule_link_policy`: `none | optional | required`
- `calendar_target`: `student | group | both`
- `group_source`: `none | smecka | posadka | kurz`

Tím je zajištěno, že vazba akce na rozvrh není natvrdo v kódu, ale přes UI číselník.

## Synchronizační režim

- Iniciální sync: plný přenos rozvrhu všech aktivních žáků (denní studium).
- Pravidelný delta check: 3x denně (CET/CEST).
- Noční full refresh: denní konsolidace na rolling okně.
- Při změně školní akce v aplikaci: okamžitý enqueue jobu a push do Google.

## Čas a timezone

- V DB ukládat `timestamptz` (UTC).
- Google eventy zapisovat s timezone `Europe/Prague`.
- UI pracuje v CET/CEST nad UTC instanty.
