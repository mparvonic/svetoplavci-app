# ADR-0003 Fázovaná strategie občerstvování test DB (v1 -> v2/v3)

## Status

Accepted

## Kontext

Pro `test-app` potřebujeme pravidelné občerstvování dat z produkce, ale zároveň zachovat možnost vytvářet a držet testovací data.

Byla zvažována robustní varianta s explicitním značením původu dat (`data_origin = prod_sync|test_manual`) napříč tabulkami. Tato varianta je vhodná dlouhodobě, ale znamená výrazně větší zásah do schématu, migrační logiky a provozních pravidel.

V aktuální fázi projektu je priorita:

- mít stabilní a rychle provozovatelný mechanismus občerstvování,
- nezvyšovat riziko velkým schématovým zásahem,
- neblokovat implementaci dalších částí aplikace.

## Rozhodnutí

Aktuálně zůstáváme na **v1** modelu refresh:

- refresh běží jako `INSERT ... ON CONFLICT ... DO UPDATE`,
- refresh **nemaže** záznamy v test DB (`no delete`),
- test-only záznamy tedy zůstávají zachované.

Přechod na **v2/v3** je odložen na pozdější fázi a bude řešen samostatným implementačním balíčkem.

## Důsledky

- Pozitivní:
  - rychlé a stabilní nasazení bez rozsáhlých schématových změn,
  - nízké provozní riziko v aktuální fázi,
  - zachování test-only záznamů.
- Negativní:
  - ruční testovací úpravy řádků, které sdílí klíč s produkcí, mohou být při refreshi přepsány,
  - chybí jemnější politika řízení původu dat na úrovni řádku.
- Otevřené body:
  - definovat trigger podmínky pro přechod na v2/v3,
  - připravit seznam tabulek prioritních pro robustní ochranu (`data_origin` režim).

## Návratový bod

K tématu se vrátit při splnění alespoň jedné podmínky:

- časté konflikty mezi test ručními úpravami a refresh přepisem,
- zvýšení počtu modulů, které do test DB zapisují ručně,
- požadavek na auditovatelnou ochranu test dat na úrovni řádku.

## Alternativy

- Varianta A: okamžitě přejít na v2/v3 pro všechny tabulky.
- Varianta B: ponechat v1 dlouhodobě bez plánovaného návratu.
