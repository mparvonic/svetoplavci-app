# Implementační checklist: M01 bootstrap dat (RVP + historická Coda migrace)

## Cíl

Naplnit M01 startovacími daty tak, aby:

- RVP bylo načtené z oficiálních open dat,
- lodičky a osobní lodičky byly přenesené z Coda,
- historie stavů byla zachovaná,
- další provoz M01 běžel bez závislosti na Coda.

## Vstupní zdroje

- RVP open data (full_mp, 24. 6. 2025).
- Coda:
  - `grid-tKkiEMWXEO` (Lodičky),
  - `grid-3m-_XP8oMp` (Osobní lodičky),
  - `grid-nYzDRw4zl3` (Historie osobních lodiček).

## Fáze A: RVP import

- [x] A1: Implementovat downloader RVP JSON/CSV se záznamem zdroje a hashe.
- [x] A2: Implementovat parser pro struktury `OVU`, `uzlové body`, větve kurikula.
- [x] A3: Uložit import jako explicitní verzi RVP (`read-only`).
- [x] A4: Přidat validační report (`počet OVU`, chybějící pole, duplicitní kódy).

## Fáze B: Coda export (raw)

- [x] B1: Implementovat jednorázový export všech 3 tabulek do raw snapshotu.
- [x] B2: Uložit metriky exportu (`row_count`, `exported_at`, `table_id`).
- [x] B3: Ověřit úplnost exportu vůči Coda (počty řádků).

## Fáze C: Transformace lodiček

- [x] C1: Namapovat lodičky z Coda na interní strukturu ŠVP.
- [x] C2: Namapovat vazby lodiček na OVU.
- [x] C3: Ošetřit prerekvizity a rozsah ročníků (`ročník od/do`).
- [x] C4: Ověřit vazbu garanta na existující osobu/roli.

## Fáze D: Transformace osobních lodiček

- [ ] D1: Namapovat osobní lodičky na žáka + lodičku + aktuální stav.
- [ ] D2: Přenést `Datum stavu`, `Poznámka`, `Úspěch` a auditní metadata.
- [ ] D3: Zajistit deduplikaci podle `Kód osobní lodičky`.
- [ ] D4: Ověřit, že všechny osobní lodičky odkazují na existující lodičku i žáka.

## Fáze E: Transformace historie osobních lodiček

- [ ] E1: Přenést všechny historické události jako append-only záznamy.
- [ ] E2: Seřadit historii podle data a času změny.
- [ ] E3: Ověřit konzistenci: poslední historický stav odpovídá aktuálnímu stavu osobní lodičky.

## Fáze F: Validace po importu

- [ ] F1: Kontrola pokrytí žáků: aktivní žáci mají osobní lodičky podle stupně.
- [ ] F2: Kontrola pokrytí lodiček: každá aktivní lodička má jasnou vazbu na oblast/předmět.
- [ ] F3: Kontrola historie: každý importovaný stav je dohledatelný na časové ose.
- [ ] F4: Vygenerovat validační report pro schválení.

## Fáze G: Přechod do provozu bez Coda

- [x] G1: Vypnout závislost M01 na Coda API.
- [x] G2: Nastavit M01 zápisy pouze do interní DB.
- [x] G3: Zafixovat Coda jako archivní zdroj pro případ auditu.

## Schválení

- [ ] Schválení produktu: data M01 jsou kompletní a věcně správná.
- [x] Schválení provozu: M01 běží bez čtení z Coda.

Poznámka: checklist je ponechaný jako historická stopa migrace. Nový runtime kód nesmí zavádět čtení z Coda.
