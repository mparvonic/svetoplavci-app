# M10: Implementation plan (proto-first frontend)

## Cíl

Zavést stabilní frontend workflow:

1. návrh a validace UX na `proto-app` s mock daty,
2. implementace stejného UI proti živým datům lokálně,
3. nasazení a testování na `test-app`,
4. následně produkční release.

## Postup

### Fáze A: Skeleton aplikace na proto

- jednotný shell aplikace (header, boční navigace, obsah),
- role-based dashboardy (rodič, dítě, průvodce, správce aplikace, správce sítě),
- základní komponentové vzory (karty, tabulky, záložky, filtry, CTA),
- čistě mock data, bez API volání.

Výstup:

- klikací kostra aplikace na `proto-app`,
- schválené pravidlo navigace mezi rolemi.

### Fáze B: Referenční modul Lodičky

- seznam, detail, historie a změna stavu (mock flow),
- pokrytí stavů: prázdno / načítání / chyba / read-only,
- role-specific pohledy (rodič vs průvodce vs správce).

Výstup:

- schválený UX pattern pro datově náročný modul.

### Fáze C: Referenční modul Akce (Ostrovy)

- seznam akcí, detail, zápis/odhlášení, kapacita,
- vazba na školní rok a plavbu v UX,
- role-specific tlačítka a viditelnost.

Výstup:

- schválený UX pattern pro registrační modul.

### Fáze D: Implementace live verze

- implementace na Macu na feature větvích,
- stejný UI kód, rozdíl pouze v datovém adapteru (`mock` -> `live`),
- průběžné PR do `staging`.

Výstup:

- funkční moduly na `test-app`.

### Fáze E: UAT a release

- UAT na `test-app` proti reálným datům,
- opravy UX + edge case scénářů,
- release na `app.svetoplavci.cz`.

## Principy

- Bez schválení proto flow se nezačíná backend napojení modulu.
- Každý modul musí mít vlastní „schváleno pro implementaci“ checkpoint.
- Mock data zůstávají udržovaná i po implementaci pro rychlé UX iterace.
