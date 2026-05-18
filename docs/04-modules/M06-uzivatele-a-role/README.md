# M06 Uživatelé a role

## Účel modulu

Zajistit jednotný model uživatelů pro celou aplikaci (děti, zaměstnanci, rodiče, ruční záznamy), role-based přístup a bezpečné přihlášení bez hesel.

## Scope

- In-scope:
  - centrální tabulka osob + zdrojové záznamy z více systémů,
  - role assignment (`Žák`, `Zaměstnanec`, `Rodič`, `admin`, `tester`, `proto`),
  - mapování login identity (email) na osoby s ručním schválením konfliktů,
  - synchronizace uživatelů z Edookit API + CSV import rodičů,
  - omezení přístupu podle prostředí (`test-app`, `proto-app`).
- Out-of-scope:
  - UI průvodce importem CSV,
  - plná správa vazeb rodič–dítě v administraci,
  - historická migrace funkčních dat z Coda do interní DB (řeší samostatné moduly).

Aktuální autentizace a role běží výhradně přes interní DB. Coda lookup pro auth je relikt a nesmí se používat.

## Závislosti

- M11 Integrace (Edookit API),
- M12 Platform core (Auth.js, middleware, Prisma),
- provozní konfigurace prostředí v Coolify (domény, secrets, cron).

## Stav

- Fáze: implementace (lokální vývoj)
- Priorita: vysoká
- Owner: Světoplavci core tým
- Poznámka:
  - Datový model a sync pipeline jsou implementované v kódu.
  - Zbývá nasadit migraci + env do `test/prod` a zapnout pravidelný běh syncu.
