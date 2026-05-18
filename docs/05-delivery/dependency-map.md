# Mapa závislostí

## Primární závislosti

- M01 -> M12, M06
- M02 -> M12, M06
- M03 -> M12, M06, M10
- M04 -> M12, M06, M10
- M05 -> M12, M06, M11
- M07 -> M10, M06, M03, M04
- M08 -> M12 + stabilní API M01-M05
- M09 -> M11, M12, M04

## Poznámka

Při plánování sprintu vždy ověřit, že upstream modul je ve stavu minimálně Amber->Green pro potřebné rozhraní.
