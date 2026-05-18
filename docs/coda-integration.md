# Coda jako archivní zdroj

## Aktuální pravidlo

Coda není runtime zdroj aplikace. Aplikace s ní při běžném provozu žádným způsobem nesmí pracovat:

- nesmí přes Coda ověřovat uživatele,
- nesmí z Coda číst data pro UI,
- nesmí do Coda zapisovat změny,
- nesmí rozhodovat oprávnění podle Coda tabulek.

PostgreSQL je zdroj pravdy pro provozní data aplikace.

## Proč zůstávají Coda údaje

Historická Coda metadata se uchovávají jen kvůli zpětnému ověření migrace a auditu. Typicky jde o:

- původní Coda row id,
- název nebo id původní tabulky,
- importní batch,
- raw snapshot exportu,
- mapovací a validační reporty.

Tato metadata smějí sloužit pouze k dohledání původu záznamu. Nesmí se používat jako autorita pro aktuální stav.

## Archivní tabulky

Starší dokumentace a status reporty mohou zmiňovat Coda tabulky pro:

- osoby,
- lodičky,
- osobní lodičky,
- historii osobních lodiček,
- Ostrovy.

Tyto zmínky jsou historický kontext migrace. Nový kód se podle nich nemá implementovat.

## Povolené použití

Povolené je pouze:

- číst uložený raw snapshot nebo importní report při auditu,
- dohledat původ záznamu přes uložené `source_*` sloupce,
- porovnat historický import se stavem v PostgreSQL při ručním incident review.

Nepovolené je přidat nový runtime call do Coda API nebo navrhnout novou funkcionalitu závislou na živé Coda tabulce.
