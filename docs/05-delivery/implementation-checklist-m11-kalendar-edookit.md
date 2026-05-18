# Implementační checklist M11: Edookit + Google Calendar

## Cíl

Zprovoznit synchronizaci rozvrhu a školních akcí do Google kalendářů žáků (a volitelně skupin) s využitím Edookit API.

## M11-M1 Datový základ

- [ ] Nasadit migraci `20260405123000_m11_calendar_event_sync_foundation`.
- [ ] Vytvořit záznam `app_calendar_provider_config` (Google Workspace service account + impersonace).
- [ ] Připravit bootstrap `app_student_calendar` pro aktivní žáky (denní studium).
- [ ] Zavést číselník `app_school_event_type` (včetně pravidel vazby na rozvrh/kalendář).

## M11-M2 Rozvrh sync

- [ ] Implementovat worker pro `app_calendar_sync_job`.
- [ ] Implementovat inicializační job `INITIAL_STUDENT_SYNC`.
- [ ] Implementovat delta job `PROCESS_CHANGE_DELTA` (3x denně).
- [ ] Implementovat cílený refresh přes `lesson/v2/list-lessons` pro dotčené žáky/dny.
- [ ] Zajistit idempotentní mapování přes `app_calendar_event_link`.

## M11-M3 Školní akce

- [ ] CRUD `app_school_event_type` v admin UI.
- [ ] CRUD `app_school_event` + `app_school_event_target`.
- [ ] Validace `schedule_link_policy` podle vybraného typu akce.
- [ ] Podpora `calendar_behavior=update_linked_lesson` (update existující lesson události).
- [ ] Podpora `calendar_behavior=separate_event` (samostatná událost).

## Provoz

- [ ] Nastavit cron pro delta sync 3x denně (CET/CEST).
- [ ] Nastavit noční konsolidační refresh.
- [ ] Přidat monitorování fronty (`FAILED`, stáří `PENDING`, retry count).
- [ ] Přidat runbook incidentů (Google API kvóty, auth chyby, konflikt mappingu).
