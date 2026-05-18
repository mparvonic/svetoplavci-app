# Verzování RVP a lodiček

## Cíl

Umožnit změny RVP a lodiček mezi školními roky bez ztráty historické interpretace hodnocení.

## Základní princip

- Každá verze RVP/lodiček je explicitně označená verzí a platností.
- Historická hodnocení odkazují na verzi, která byla platná v době hodnocení.
- Osobní sada lodiček není výlučně vázaná na školní rok, ale na školní stupeň (`I_STUPEN` / `II_STUPEN`) a aktivní verzi ŠVP.

## Typy změn ŠVP

- `MINOR` změna:
  - textace/metadatové změny,
  - bez nové osobní sady lodiček,
  - bez migrace.
- `MAJOR` změna:
  - strukturální změna lodiček,
  - nová osobní sada lodiček,
  - povinná migrace ze staré verze.

## Pravidla MAJOR změny

- `MAJOR` změna je povolená pouze k `1. 9.`.
- Před aktivací musí být připravené mapování všech nových lodiček.
- Mapování používá typy vazeb `1:1`, `N:1`, `1:N`, `MANUAL`, `NOVA`.
- Po aktivaci je stará osobní sada uzavřená (read-only).

## Migrace a audit

- Převod je auditovaný (`kdo`, `kdy`, `z verze`, `na verzi`, `pravidlo`).
- Historická data se nikdy nepřepisují.
- Musí být dohledatelné stavy před migrací i po migraci.

## Stav

- Model verzování je v DB připravený (`M01SvpVersion`, migrační tabulky).
- Původní migrace z Coda do M01 je historicky dokončená a Coda zůstává jen archivní stopou.
- Plná budoucí změna sady lodiček má vycházet z tohoto modelu, ale nesmí používat Coda jako runtime zdroj.
