# Admin a provozní správa školy

Tento dokument popisuje cílovou podobu admin sekce a pořadí práce. Admin sekce nemá být jen technická správa tabulek, ale provozní místo pro správu školních dat, přístupů, synchronizací a školního roku.

## Cíl balíku

Admin sekce má umožnit:

- spravovat osoby v aplikaci,
- řešit vazby rodič-dítě,
- spravovat login identity, e-maily a přístupová oprávnění,
- spouštět a kontrolovat synchronizace z Edookitu a CSV importy rodičů,
- spravovat školní roky, smečky, studijní skupiny a členství,
- vést kontrolní frontu datových problémů po každé synchronizaci/importu,
- připravit systém na budoucí oddělení admin rolí.

## Struktura adminu

- `/admin` - přehled stavu systému, poslední sync/import, otevřené problémy a rychlé odkazy.
- `/admin/uzivatele` - správa osob: děti, rodiče, zaměstnanci, průvodci.
- `/admin/vazby` - správa rodinných vazeb rodič-dítě.
- `/admin/pristupy` - login identity, e-maily, schválení přístupu a oprávnění.
- `/admin/synchronizace` - Edookit sync, CSV import rodičů, historie běhů, preview změn a výsledky.
- `/admin/kontrola-dat` - fronta problémů po synchronizaci/importu.
- `/admin/skolni-roky` - školní roky, smečky, studijní skupiny, členství dětí a průvodců.

## Doménové rozdělení

Admin má oddělovat čtyři vrstvy:

- osoba (`AppPerson`),
- rodinná vazba (`AppPersonRelation`),
- login identita a přístup (`AppLoginIdentity`, `AppLoginPersonLink`, role assignmenty),
- školní rok a skupiny (`AppSchoolYear`, `AppGroup`, `AppGroupMembership`).

Toto oddělení je důležité: login e-mail není osoba, osoba není automaticky rodičovská vazba a smečka/studijní skupina je nastavení školního roku.

## Pravidlo login identity

Jedna login identita smí být schválená právě k jedné osobě (`AppPerson`). Přístup k dalším osobám se nesmí řešit druhým schváleným login linkem:

- pokud e-mail patří rodiči a dítěti, schválí se rodič a přístup k dítěti se řeší přes rodinnou vazbu v `AppPersonRelation`,
- pokud e-mail ukazuje na duplicitu stejné osoby, má se vyřešit sloučením nebo opravou osoby, ne schválením obou záznamů,
- pokud by někdy existoval legitimní sdílený nebo zastupující login, musí to být samostatně navržený koncept, ne vedlejší efekt řešení konfliktu.

Toto pravidlo je vynucené ve třech vrstvách:

- admin UI v řešení konfliktu dovolí vybrat pouze jednu osobu,
- backend endpoint pro řešení konfliktů odmítá více schválených osob,
- databáze má částečný unikátní index nad `app_login_person_link(identity_id)` pro `status = 'approved'`.

## Synchronizace a importy

Edookit je autorita pro děti a zaměstnance/průvodce. CSV import rodičů doplňuje rodičovskou vrstvu, kontakty a vazby, ale nesmí přepsat profil dítěte nebo zaměstnance načtený z Edookitu.

## Ruční řešení rodič-dítě vazeb

Chybějící nebo chybné rodinné vazby se řeší v `/admin/vazby`:

- dítě bez rodiče se řeší vyhledáním rodiče a vytvořením aktivní vazby `parent_of`,
- rodič bez dětí se řeší vyhledáním dítěte a vytvořením aktivní vazby `parent_of`,
- ruční resolver pracuje s celou rodinou: v jedné změně lze vybrat více rodičů a více dětí a systém vytvoří všechny chybějící dvojice,
- při výběru osoby resolver doplní její již známé aktivní rodinné vazby, aby administrátor viděl a potvrdil celý rodinný kontext,
- chybně vytvořená vazba se nedeletuje, pouze se deaktivuje přes `isActive = false`,
- každá ruční změna musí mít důvod a auditní stopu (`createdBy`, `updatedBy`, `changeReason`),
- ruční vazby používají zdroj `manual_admin`, aby byly oddělitelné od vazeb ze synchronizace nebo CSV importu.

## Sloučení duplicitních osob

Duplicitní osoby se řeší v detailu osoby přes nástroj `Sloučit osoby`:

- administrátor vybere více osob a určí jednu primární osobu,
- zdrojové záznamy, role, login identity, rodinné vazby, školní členství a další navázaná data se přesunou na primární osobu,
- osoby sloučené do primární osoby se nemažou, pouze se zneaktivní a uloží se `mergedIntoPersonId`, `mergedAt`, `mergedBy` a `mergeReason`,
- merge je určený pro případy typu jedna fyzická osoba ze dvou zdrojů, například Edookit zaměstnanec a CSV rodič,
- merge nenahrazuje řešení login konfliktu ani rodinných vazeb; ty řeší jiné admin workflow.

### Edookit sync

Workflow:

1. Načíst děti.
2. Načíst zaměstnance/průvodce.
3. Připravit preview změn:
   - nové osoby,
   - aktualizované osoby,
   - osoby, které už nejsou aktivní,
   - změny ročníku nebo typu studia,
   - chybějící údaje.
4. Spustit synchronizaci.
5. Vytvořit kontrolní report.

### CSV import rodičů

Workflow:

1. Nahrát CSV.
2. Namapovat sloupce.
3. Připravit preview:
   - noví rodiče,
   - aktualizované kontakty,
   - nové login e-maily,
   - možné duplicity,
   - rodiče bez dětí,
   - děti z CSV nenalezené v Edookitu.
4. Spustit import.
5. Vytvořit kontrolní report.

## Kontrolní fronta

Po každé synchronizaci/importu má vzniknout sada problémů k vyřešení. Typické položky:

- dítě nemá smečku,
- dítě nemá studijní skupinu,
- dítě nemá rodiče,
- rodič není napojený na žádné dítě,
- rodičovský e-mail koliduje s jinou osobou,
- login e-mail odpovídá více osobám,
- zaměstnanec nemá roli,
- průvodce není přiřazený ke smečce/skupině,
- členství porušuje pravidla školního roku.

Stavy položek:

- `open` - otevřeno,
- `resolved` - vyřešeno,
- `ignored` - ignorováno,
- `waiting_for_next_import` - čeká na další import.

## Školní rok, smečky a skupiny

Smečky a studijní skupiny patří do nastavení školního roku, ne do obecné správy uživatelů.

Oblast `/admin/skolni-roky` má postupně řešit:

- seznam školních roků,
- aktivní školní rok,
- vytvoření a úpravu smeček,
- vytvoření a úpravu studijních skupin,
- přiřazení dětí do smeček,
- přiřazení dětí do studijních skupin,
- přiřazení průvodců ke smečkám/skupinám,
- validaci členství,
- historii změn.

## Budoucí role

První verze může být chráněná pouze rolí `admin`, ale UI i API se mají navrhovat tak, aby šla oprávnění později rozdělit.

Plánované role:

- `admin` - plný systémový přístup,
- `spravce_uzivatelu` - osoby a rodič-dítě vazby,
- `spravce_pristupu` - login identity, e-maily, oprávnění,
- `spravce_synchronizace` - sync/import a importní kontroly,
- `spravce_skolniho_roku` - školní roky, smečky, skupiny, členství.

## Technické principy

- Ruční změny musí mít auditní stopu.
- Datové konflikty se neřeší potichu, ale přes kontrolní frontu.
- Žádné hard delete u rodinných vazeb; používat deaktivaci a historii.
- Admin se nemá přihlašovat za cizí uživatele.
- Nové chráněné route se přidávají do centrální role matrix.
- Admin API se má dělit podle doménových oblastí, ne do jedné obří route.

## Doporučené pořadí práce

1. Admin shell a navigace.
2. Read-only `/admin/uzivatele`.
3. Read-only detail osoby.
4. `/admin/pristupy` s existujícími login konflikty.
5. `/admin/vazby` pro rodič-dítě vazby.
6. Základ `/admin/synchronizace` s historií/importními výsledky.
7. Kontrolní fronta problémů.
8. `/admin/skolni-roky` se smečkami a skupinami.
9. Editační akce a audit.
10. Jemnější role místo samotného `admin`.
