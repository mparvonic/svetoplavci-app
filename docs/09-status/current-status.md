# Aktuální stav projektu

## Datum

2026-04-05

## Shrnutí

Projekt je ve fázi stabilizace provozu po cutoveru na Coolify, s aktivní implementací datových modulů M01/M02/M03 a integrací M11.

## Stav modulů (RAG)

- M01 Výsledky vzdělávání: Amber
- M02 Organizace školního roku: Red
- M03 Ostrovy: Amber
- M04 Půjčovna a rezervace zdrojů: Red
- M05 Studijní portfolio: Red
- M06 Uživatelé a role: Amber
- M07 Kiosk: Red
- M08 AI vrstva: Red
- M09 Síťový management: Red
- M10 Dashboard a UX vrstvy: Amber
- M11 Integrace: Amber
- M12 Platform core: Amber

## Co se právě děje

- Cutover prostředí dokončen:
  - `app.svetoplavci.cz` (`main`) běží přes Coolify,
  - `test-app.svetoplavci.cz` (`staging`) běží přes Coolify,
  - `proto-app.svetoplavci.cz` (`proto`) běží přes Coolify.
- Opraven kritický problém auth DB konektivity:
  - nasazena proxy `svetoplavci-auth-db-proxy`,
  - opraveny `POSTGRES_PRISMA_URL` pro `prod/test/proto`,
  - založena oddělená DB `svetoplavci_test`.
- Odstraněna kolize routingu:
  - starý kontejner `svetoplavci-app` zastaven,
  - auto-restart přepnut na `restart=no`.
- Rozpracované navazující kroky:
  - ověřit rollback postup DB migrací v praxi,
  - uzavřít decommission starých ručních deploy path.
- M10 frontend proto-first:
  - zapsán implementační plán + checklist Fází A-E,
  - spuštěna Fáze A na `proto`:
    - nová stránka `/proto-shell` (role switch, navigace, dashboard, lodičky mock, akce mock),
    - nový rozcestník `/prototype`.
  - navazující Fáze B:
    - doplněn klikací detail lodičky a historie změn,
    - pokryty stavové varianty `prázdno/načítání/chyba/read-only`.
- Nově dokončen základ M03 Akce:
  - databázový model M03 (šablony/série/cílení/snapshot/registrace/docházka/module links),
  - lifecycle backend (`publish` + `close_registration` + `manual snapshot`),
  - dynamické cílení pravidly se snapshotem účastníků při publikaci/uzávěrce,
  - registrační API včetně výjimek průvodce po uzávěrce a auditní stopy,
  - schedule refresh API, které respektuje `time_override_lock` (rozvrh nepřepíše ruční čas akce zpět),
  - kalendářový sync engine + worker s retry strategií a enqueue triggerem z lifecycle/registrace/refresh workflow.
- Lokálně implementováno (čeká na deploy do `test/prod`):
  - nový datový model `app_person*`, `app_login_*`, `app_role_assignment`, `app_user_sync_run`,
  - API sync uživatelů z Edookit (`student-data`, `employee-data`) + CSV import rodičů,
  - varianta C pro kolize emailu (manuální schválení přes admin endpoint),
  - host-based role guard:
    - `test-app.svetoplavci.cz` -> `tester|admin`,
    - `proto-app.svetoplavci.cz` -> `proto|admin`.
- Dokončena analýza mapování Coda `Seznam osob` (`grid-PIwfgW7bQU`) proti `svetoplavci_test`:
  - namapováno `230/361` řádků (hlavně přes `Identifikátor`),
  - nenamapováno `131` řádků, z toho převážně `Rodič` bez mapovacího klíče.
  - detail: `docs/09-status/coda-seznam-osob-mapping-2026-04-03.md`.
- Zpracována kompletní mapovací matice všech polí Coda `Seznam osob`:
  - detail: `docs/09-status/coda-seznam-osob-field-mapping-2026-04-03.md`.
