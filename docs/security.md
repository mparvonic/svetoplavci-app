# Bezpečnostní model

## Ověření identity

Přihlášení je možné přes:

- Google OAuth,
- e-mailový magic link.

Po ověření e-mailu aplikace dohledá interní login identitu v PostgreSQL. Přístup je povolen pouze pokud existuje aktivní `AppLoginIdentity` a právě jedna schválená vazba `AppLoginPersonLink` na aktivní osobu.

Ověření přes Coda se nepoužívá.

## Role a oprávnění

Role se čtou z interních `AppRoleAssignment` záznamů. Route guardy používají centrální role matrix v aplikaci.

Základní pravidla:

- jedna login identita může mít nejvýše jednu schválenou osobu,
- přístup k dítěti se řeší přes rodinné nebo školní vazby v DB, ne přes duplicitní login link,
- změny oprávnění a citlivé ruční zásahy musí být dohledatelné.

## Přístup k dětem a M01

API pracující s dítětem vždy ověřuje session a kontext přístupu v interní DB:

- rodič vidí děti přes aktivní rodinnou vazbu,
- žák vidí vlastní data,
- průvodce/garant/správci vidí data podle role a kontextu,
- `spravce_lodicek` a `spravce_flotily` mají rozšířený katalogový přístup podle pravidel M01.

## Magic linky a session

Magic link je reprezentovaný `VerificationToken` v DB. Po použití se token smaže a odkaz nejde použít znovu.

Session je JWT cookie podepsaná `AUTH_SECRET` / `NEXTAUTH_SECRET`. Automatické odhlášení po 30 minutách nečinnosti zajišťuje `InactivitySignOut`.

## Coda

Coda je pouze archivní stopa. Aplikace nesmí pro bezpečnostní rozhodnutí, autorizaci ani zobrazení dat volat Coda API.
