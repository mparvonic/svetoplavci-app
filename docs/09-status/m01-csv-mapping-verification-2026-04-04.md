# M01 ověření mapování z CSV (2026-04-04)

## Vstupní soubory

- `/Users/miroslav/Downloads/Lodičky od 1.9.2025.csv`
- `/Users/miroslav/Downloads/Osobní lodičky.csv`
- `/Users/miroslav/Downloads/Historie lodiček.csv`

## Ověřená mapovací logika

1. `Osobní lodičky` -> žák:
- primární klíč: `Kód osobní lodičky`
- identita žáka: `ID žáka`
- kontrola konzistence: prefix `Kód osobní lodičky` odpovídá `ID žáka`

2. `Historie lodiček` -> osobní lodička -> žák:
- klíč vazby: `Osobní lodička` (hodnota stejná jako `Kód osobní lodičky`)
- fallback identita žáka: prefix kódu před prvním `-`

## Výsledek ověření

### Osobní lodičky

- `total`: 24 692
- `missing_id`: 0
- `missing_code`: 0
- `duplicate_code`: 0
- `prefix_mismatch` (`ID žáka` vs prefix kódu): 0

### Historie lodiček

- `total`: 14 175
- `missing_code`: 0
- `unparseable_prefix`: 0
- `mapped` (přímá vazba na osobní lodičku): 14 141
- `code_not_found`: 34
- `id_mismatch` při nalezené vazbě: 0

## Interpretace 34 výjimek

- V 34 případech je kód v historii, který už není v aktuální tabulce osobních lodiček.
- Ve všech 34 případech ale prefix kódu odpovídá existujícímu `ID žáka` v osobních lodičkách.
- Prakticky: mapování na konkrétního žáka je stále možné; chybí jen aktuální osobní lodička se stejným kódem.

## Závěr

Mapování je pro migraci použitelné a spolehlivé:

- `Osobní lodičky` lze jednoznačně napárovat na žáka.
- `Historii lodiček` lze napárovat na osobní lodičku a/nebo přímo na žáka přes prefix kódu.
