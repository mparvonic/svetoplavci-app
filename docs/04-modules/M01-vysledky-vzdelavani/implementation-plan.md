# M01 Implementační plán

## Cíl

- Stabilní a auditovatelná evidence lodiček, osobních lodiček a historie stavů.
- Připravenost na další fáze: výpočty hodnocení, triangly, vysvědčení, verzování ŠVP.

## Fáze 1: Datový základ (hotovo)

- Zavedena datová vrstva RVP + ŠVP + osobní lodičky + eventy.
- Zavedeny vazby:
  - předmět -> podpředmět -> oblast -> lodička,
  - lodička -> garant (M:N),
  - lodička -> OVU (0:N),
  - lodička -> prerekvizita (self-reference).
- Zavedeno kódování lodiček s verzí ŠVP (např. `2025-SP-CJ-5-001`).
- Zavedeno kódování osobních lodiček (`<id_žáka>-<kód_lodičky>`).

Poznámka k rolím: historický název `garant` u M:N vazby `lodička -> garant` dnes odpovídá správci lodičky v katalogovém smyslu. Aktuální role `garant` znamená oprávnění měnit stav osobních lodiček.

## Fáze 2: Bootstrap dat M01 (hotovo v1)

- Import pořadí:
  1. RVP (open data, verze 24. 6. 2025),
  2. ŠVP lodičky (`Lodičky od 1.9.2025.csv`),
  3. osobní lodičky (vazba žák + lodička dle stupně),
  4. historie osobních lodiček jako eventy.
- Pro lodičky bez historického záznamu byl založen baseline event `Nezahájeno` k `2025-09-01`.
- Zavedeny oddělené výstupy pro nevyřešené řádky importu (bez vazby na existující lodičku se nic nezapisuje).

## Fáze 3: Opravy historie a projekce stavu (hotovo)

- Zavedeno audit-safe zneplatnění eventů:
  - `is_invalidated`,
  - `invalidated_at`,
  - `invalidated_reason`,
  - `invalidated_by_event_id`.
- Backdated opravy (pozdější změna se starším `datum_stavu`) řešeny logickým zneplatněním staršího business eventu, bez mazání.
- Projekce aktuálního stavu osobní lodičky počítá pouze z aktivních eventů (`is_invalidated = false`).
- Deterministické řazení projekce:
  - `datum_stavu DESC`,
  - `source_modified_at DESC NULLS LAST`,
  - `created_at DESC`,
  - `id DESC`.
- Uložení projekce do `app_m01_osobni_lodicka`:
  - `current_stupen`,
  - `current_hodnota`,
  - `current_stav_label`,
  - `datum_stavu`,
  - `last_event_id`.

## Fáze 4: API a servisní vrstva (další krok)

- API pro zápis nových eventů osobních lodiček (append-only).
- API pro korekce historie:
  - vytvoření opravného eventu,
  - volitelné zneplatnění původního eventu.
- API pro čtení:
  - aktuální stav,
  - timeline aktivních i zneplatněných eventů,
  - audit detail.
- Servis pro výpočet agregací:
  - lodička -> oblast -> předmět.

## Fáze 5: Verzování ŠVP a migrace osobních lodiček (budoucí změny sady)

- Workflow `MINOR` / `MAJOR` verze ŠVP.
- Aktivace `MAJOR` pouze k `1. 9.`.
- Migrační plán mezi verzemi:
  - auto převod při vazbě stará->nová lodička,
  - ruční doplnění tam, kde vazba chybí.
- Historická sada po migraci přechází do read-only režimu.

## Fáze 6: UI a provoz

- Průvodce: práce se stavy lodiček + auditní timeline.
- Portálová správa lodiček: správa sad ŠVP, vazeb na RVP/OVU, správců lodiček, garantů a validačních reportů.
- Rodič: read-only náhled.
- Monitoring kvality dat:
  - report nevyřešených mapování,
  - report konfliktů historie,
  - kontrola projekce (`projectionMismatch`).

## Rizika a mitigace

- Riziko: rozdílné pořadí „business čas“ vs. „technický čas“.
  - Mitigace: oddělené uložení `datum_stavu` a source/created timestampů + pravidla zneplatnění.
- Riziko: vysoký objem eventů.
  - Mitigace: indexy pro projekce, denormalizovaný current stav v `app_m01_osobni_lodicka`.
- Riziko: nekonzistentní názvosloví v importech.
  - Mitigace: normalizace mapování + unresolved reporty před zápisem.
