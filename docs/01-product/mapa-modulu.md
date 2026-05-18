# Mapa modulů

## Přehled

- `M01` Výsledky vzdělávání
- `M02` Organizace školního roku
- `M03` Ostrovy
- `M04` Půjčovna a rezervace zdrojů
- `M05` Studijní portfolio
- `M06` Uživatelé a role
- `M07` Kiosk
- `M08` AI vrstva
- `M09` Síťový management
- `M10` Dashboard a UX vrstvy
- `M11` Integrace
- `M12` Platform core

## Priority

- `P1`: M01, M12, M06, M10
- `P2`: M02, M03, M04, M11, M07
- `P3`: M05, M09, M08

## Kritické závislosti

- M01 závisí na M12 (audit, konfigurace, API, datový model) a M06 (role).
- M07 závisí na M10 (role-based dashboard), M06 (identity) a M04/M03 (funkce kiosku).
- M08 závisí na stabilních API kontraktech M01/M02/M03/M04 a auditních pravidlech M12.
