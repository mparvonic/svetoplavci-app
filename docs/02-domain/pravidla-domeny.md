# Doménová pravidla

## Lodičky

- Lodička může mít 0 až N vazeb na OVU.
- Lodička má definovaný rozsah ročníků, ve kterých ji lze plnit.
- Lodička může mít prerekvizity (předchozí lodičky).
- Stav plnění lodičky je omezený na hodnoty `0..4`.
- Osobní sada lodiček žáka je navázaná na školní stupeň (`I_STUPEN` / `II_STUPEN`) a verzi ŠVP (ne výlučně na školní rok).
- Zásadní změna verze ŠVP/lodiček (`MAJOR`) je povolená pouze k `1. 9.`.

## Hodnocení

- Hodnocení v průběhu plaveb i pololetí vychází z bodového modelu.
- Výsledné hodnocení porovnává skutečný stav proti očekávané křivce.
- Agregace probíhá minimálně na úrovni lodička -> oblast -> předmět.

## Archivace

- Podklady pro vysvědčení musí být neměnné po uzavření období.
- Musí být dohledatelné, z jakých dat a pravidel vysvědčení vzniklo.

## Oprávnění

- Přístup k datům dítěte je podmíněný rolí a vazbou na konkrétní dítě/skupinu.
- Každá změna hodnocení se zapisuje do auditní stopy.
