# Promotion Record Template

Datum: `YYYY-MM-DD`
Autor: `jmeno`
Zdroj větev/prostředí: `<feature/*|staging|main> / <local|proto|test>`
Cílová větev/prostředí: `<proto|staging|main> / <proto|test|prod>`

## 1. Scope

- Moduly/stránky:
- Uživatelské role:
- Dotčené API/data toky:

## 2. Commity

- `<sha> <message>`
- `<sha> <message>`

## 3. Parity check (1:1)

- UI parity proti předchozímu prostředí: `ANO/NE`
- Funkční parity proti předchozímu prostředí: `ANO/NE`
- Poznámky (odchylky):

## 4. Data mode

- Zdroj dat: `mock | test | prod`
- Co se změnilo oproti předchozímu prostředí:

## 5. Kontroly

- [ ] lint/build
- [ ] smoke testy kritických toků
- [ ] role-based access ověření
- [ ] bez neočekávaných regresí

## 6. Rollback

- Postup návratu:
- Trigger podmínky rollbacku:

## 7. Odkazy

- PR:
- Workflow run:
- Screenshoty / důkazy parity:
- ADR (pokud je výjimka):
