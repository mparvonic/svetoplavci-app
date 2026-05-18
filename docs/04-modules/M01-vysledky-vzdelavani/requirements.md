# M01 Požadavky

## Funkční požadavky

1. Systém umožní portálovou správu sad ŠVP lodiček včetně vazeb na OVU/RVP, ročníky, správce lodiček, garanty a prerekvizity.
2. Systém bude evidovat osobní lodičku jako vazbu `žák + lodička` v rámci příslušného školního stupně.
3. Systém bude evidovat historii osobní lodičky jako `append-only` eventy.
4. Event osobní lodičky bude obsahovat:
   - stav (`0..4`),
   - číselnou hodnotu (`hodnota`),
   - `datum_stavu` (business datum),
   - technická metadata zdroje (`source_created_at`, `source_modified_at`, uživatel).
5. Systém nebude fyzicky mazat historické eventy; korekce budou řešeny logickým zneplatněním (`is_invalidated`).
6. Systém bude umět zneplatnit historický event s vazbou na event, který opravu provedl (`invalidated_by_event_id`).
7. Projekce aktuálního stavu osobní lodičky bude počítána pouze z aktivních eventů (`is_invalidated = false`).
8. Při konfliktech backdated oprav (pozdější změna se starším `datum_stavu`) musí být možné provést audit-safe opravu bez ztráty historie.
9. Pro lodičky bez historického záznamu musí systém umožnit baseline stav `Nezahájeno` k určenému datu (pro bootstrap M01 `2025-09-01`).
10. Systém musí držet odděleně:
    - aktuální denormalizovaný stav na osobní lodičce,
    - úplnou eventovou historii.
11. Systém umožní verzování ŠVP/lodiček jako `MINOR` a `MAJOR`.
12. Při budoucí `MAJOR` změně systém vygeneruje novou osobní sadu lodiček a provede převod stavů podle schválených vazeb.
13. Aktivace budoucí `MAJOR` verze bude povolena pouze k datu `1. 9.`.
14. Systém před aktivací budoucí `MAJOR` verze zkontroluje pokrytí převodu pro všechny cílové lodičky.
15. Coda nesmí být runtime zdrojem pro M01; povolená jsou pouze archivní metadata k původu importovaných záznamů.

## Pravidla konzistence dat

1. Stav osobní lodičky musí odpovídat poslednímu aktivnímu eventu podle deterministického řazení:
   - `datum_stavu DESC`,
   - `source_modified_at DESC NULLS LAST`,
   - `created_at DESC`,
   - `id DESC`.
2. `current_hodnota` musí být vždy numerická a konzistentní se stavem (pokud není explicitně stanoveno jinak).
3. `last_event_id` musí ukazovat na event, ze kterého je odvozen aktuální stav.
4. Pokud osobní lodička nemá žádný aktivní event, `last_event_id` je `NULL`.
5. Datum se ukládá ve standardizovaném formátu (UTC) tak, aby nedocházelo k posunu o den při importu/čtení.

## Akceptační kritéria

1. Po importu historie je `projectionMismatch = 0`.
2. Po běhu oprav backdated konfliktů je `candidatesTotal = 0` a `projectionMismatch = 0`.
3. Žádný event není při opravě fyzicky smazán, pouze zneplatněn.
4. Každé zneplatnění obsahuje důvod (`invalidated_reason`) a referenci na opravný event (`invalidated_by_event_id`), pokud existuje.
5. Opakovaný výpočet projekce nad stejnými daty vrací stejný výsledek.
6. Při pokusu o aktivaci budoucí `MAJOR` verze mimo `1. 9.` systém vrací validační chybu.
7. Po aktivaci budoucí `MAJOR` verze je původní osobní sada read-only a nová sada aktivní.

## Ne-funkční požadavky

- Auditovatelnost všech změn včetně oprav historie.
- Výkonnostně udržitelná práce s vysokým počtem eventů (indexace + denormalizovaný current stav).
- Čitelnost a exportovatelnost dat pro reporting.
- Připravenost na AI vrstvu (strukturované entity + možnost projekce do vektorové DB).
