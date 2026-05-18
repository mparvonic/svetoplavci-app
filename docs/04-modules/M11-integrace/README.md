# M11 Integrace

## Účel modulu

Integrace externích systémů (Edookit, Google Workspace) pro provozní data školy, zejména rozvrh a synchronizaci kalendářů žáků/skupin.

## Scope

- In-scope:
  - Edookit import uživatelů, rozvrhu, změnového rozvrhu a kurzů,
  - Google Calendar sync (osobní kalendáře žáků + volitelné skupinové kalendáře),
  - fronta synchronizačních jobů a checkpointy delta synchronizace,
  - číselník typů akcí s dynamickou vazbou na rozvrh/kalendář.
- Out-of-scope:
  - řízení přístupových práv v Google UI (mimo technické sdílení kalendářů),
  - interní GUI editor kalendářových feedů třetích stran.

## Závislosti

- M02 Organizace školního roku (skupiny a období),
- M06 Uživatelé a role (identita žáka/průvodce),
- M12 Platform core (queue, audit, API, cron/worker).

## Stav

- Fáze: implementace datového základu
- Priorita: vysoká
- Owner: TBD

## Realizační fáze

- M11-M1: datový základ
  - tabulky `app_calendar_*` + `app_school_event_type`/`app_school_event*`,
  - provisioning osobních kalendářů žáků.
- M11-M2: sync rozvrhu
  - iniciální full sync,
  - delta trigger 3x denně přes změnový rozvrh + cílený refresh přes `list-lessons`.
- M11-M3: školní akce
  - UI-driven vazba akce na hodinu,
  - update detailu existující lesson události nebo separátní event dle číselníku typu akce.
