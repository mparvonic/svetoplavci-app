# M01 Verzování ŠVP a migrace osobních lodiček

## Cíl

Zajistit řízené změny ŠVP/lodiček tak, aby:

- byla zachována historie hodnocení,
- bylo jasné, která verze je aktivní,
- při zásadní změně proběhl kontrolovaný převod osobních lodiček žáků.

## Závazná pravidla

1. Osobní sada lodiček žáka není vázaná výlučně na školní rok.
2. Žák pracuje se stejnou osobní sadou po celý školní stupeň (`I_STUPEN` nebo `II_STUPEN`).
3. Stav plnění má vždy 5 hodnot: `0..4`.
4. Zásadní změna ŠVP je povolená pouze k `1. 9.` nového školního roku.

## Typy verzí ŠVP

### MINOR verze (`2.0 -> 2.1`)

- Nezásadní změny (typicky textace, popisy, metadata).
- Nevzniká nová osobní sada lodiček.
- Neprovádí se migrace osobních lodiček.

### MAJOR verze (`2.1 -> 3.0`)

- Zásadní změna struktury lodiček.
- Vzniká nová osobní sada lodiček.
- Proběhne převod ze staré sady do nové.
- Stará sada se uzavře jako historická (read-only).

## Workflow budoucí MAJOR změny

1. Správce založí novou verzi ŠVP jako kopii aktuální verze.
2. Systém založí návrh vazeb mezi lodičkami (`stará -> nová`).
3. U každé nové lodičky se nastaví typ převodu:
- `AUTO_1_1`
- `AUTO_N_1`
- `AUTO_1_N` (pouze pokud je definované pravidlo)
- `MANUAL`
- `NOVA` (bez zdrojové lodičky)
4. Systém vyžaduje kompletní pokrytí převodu před schválením:
- žádná nová lodička nesmí zůstat bez rozhodnutí o převodu.
5. Po schválení se verze naplánuje na aktivaci k `1. 9.`.
6. K aktivaci:
- stará osobní sada přejde do historického režimu,
- nová osobní sada se stane aktivní,
- proběhne automatický převod tam, kde je definovaný,
- pro `MANUAL` vzniknou úkoly pro garanty, tedy osoby oprávněné měnit stav lodiček.

## Pravidla převodu stavu lodiček

- Převod nikdy nesmí přepsat historická data staré sady.
- Převod vytváří nové záznamy v nové sadě.
- Každý převod je auditovaný (`kdo`, `kdy`, `z jaké verze`, `na jakou verzi`, `jakým pravidlem`).
- U manuálních položek musí být evidováno dokončení a odpovědný garant.

## Audit a dohledatelnost

Musí být dohledatelné:

- jaká verze ŠVP byla aktivní v konkrétním datu,
- jaká vazba převodu byla použitá pro každou lodičku,
- stav osobních lodiček před aktivací nové verze i po aktivaci.

## Omezení v1

- V1 předpokládá, že `AUTO_1_N` a složité transformace budou použity výjimečně.
- Pokud chybí jednoznačné pravidlo, položka musí být označena jako `MANUAL`.

## Aktuální poznámka

Původní migrace M01 z historických dat je brána jako dokončená. Tento dokument popisuje princip pro budoucí změny sady lodiček, ne návrat k Coda migraci. Coda zůstává pouze archivní stopou pro zpětné ověření.
