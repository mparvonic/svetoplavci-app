# Implementační checklist M10: Frontend proto-first

## Fáze A – Skeleton na proto-app

- [x] Připravit role-based shell (header, boční navigace, obsah).
- [x] Připravit dashboard placeholdery pro všechny role.
- [x] Založit a naplnit mock data pro dashboard a lodičky.
- [x] Přidat klikací stavové akce (bez API, pouze mock interakce).
- [ ] Schválit navigaci a základní layout.

## Fáze B – Referenční modul Lodičky (mock)

- [x] Připravit klikací seznam lodiček.
- [x] Připravit detail lodičky a historii změn.
- [x] Pokrýt stavy: prázdno, načítání, chyba, read-only.
- [ ] Schválit UX flow „Lodičky“ pro implementaci.

## Fáze C – Referenční modul Akce/Ostrovy (mock)

- [ ] Připravit klikací seznam akcí a detail.
- [ ] Připravit zápis/odhlášení a kapacitu v mock režimu.
- [ ] Ověřit vazbu na školní rok/plavbu v navigaci.
- [ ] Schválit UX flow „Akce“ pro implementaci.

## Fáze D – Implementace live verze

- [ ] Přepnout datový adapter `mock` -> `live` pro schválené flow.
- [ ] Napojit API pro Lodičky.
- [ ] Napojit API pro Akce/Ostrovy.
- [ ] Nasadit na `test-app` (`staging`).

## Fáze E – UAT a release

- [ ] UAT na `test-app` nad reálnými daty.
- [ ] Uzavřít UX buglist.
- [ ] Nasadit na produkci (`main` -> `app.svetoplavci.cz`).
