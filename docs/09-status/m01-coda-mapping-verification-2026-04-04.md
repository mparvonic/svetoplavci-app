# M01 ověření mapování z Coda API (2026-04-04)

## Zdroj

- Coda doc: `JkxyWdl0hd`
- Tabulky:
  - `grid-3m-_XP8oMp` (Osobní lodičky)
  - `grid-nYzDRw4zl3` (Historie lodiček)
- Ověřovací skript:
  - `scripts/verify-m01-coda-mapping.mjs`
- Report:
  - `/tmp/m01-coda-mapping-report.json`

## Výsledek

### Osobní lodičky

- `total`: 24 876
- `missingCode`: 0
- `missingStudentId`: 0
- `codeStudentIdMismatch`: 0
- `duplicateCode`: 0

### Historie lodiček

- `total`: 14 175
- `missingPersonalCode`: 0
- `unparseableStudentIdFromCode`: 0
- `missingName`: 0
- `linkedToPersonal`: 14 175
- `notFoundInPersonal`: 0
- `linkedStudentIdMismatch`: 0

## Závěr

Mapování je plně průchozí:

- Každá historická položka je napojená na existující osobní lodičku.
- Z kódu osobní lodičky je jednoznačně odvoditelný konkrétní žák (prefix `ID žáka`).
