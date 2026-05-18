# Coda Seznam osob – přehled polí a mapování

## Datum

2026-04-03

## Konvence

- Tabulka: `grid-PIwfgW7bQU` (`Seznam osob`).
- Všechna pole se vždy ukládají do mirroru: `mirror_seznam_osob.data['<column_id>']`.
- Níže je stav mapování do doménového modelu (`app_person*`, `app_role_assignment`, `app_person_relation`) pro V1.

## Mapovací matice

| Coda pole | Column ID | Formát | Mapuje se do doménového modelu (V1) | Cílové pole | Jak se mapuje / pravidlo |
|---|---|---|---|---|---|
| ID | `c-4zBzeJEcjZ` | number | Ano (plán) | `app_person_source_record.source_record_id` | Uložit jako zdrojové ID z Coda. |
| Křestní | `c-hJKW60xeO1` | text | Ano (plán) | `app_person.first_name` | Přímý přenos textu, trim. |
| Příjmení | `c-GMLYzGw8ke` | text | Ano (plán) | `app_person.last_name` | Přímý přenos textu, trim. |
| Věk | `c-J0KIy-fNmk` | number | Ne | - | Není identitní údaj pro login/role, zůstává v payload. |
| Zapsán od | `c-znIkzbIRk9` | date | Ne (V1) | - | Pro V1 bez mapování, případně později do historie studia. |
| Vyřazen od | `c-UlMt8uwnDI` | date | Ne (V1) | - | Ve V1 neautorizovat stav osoby z Coda. |
| Identifikátor | `c-5nG1glNg-o` | text | Ano | `app_person.identifier`, `app_person.dedup_key` | Primární mapovací klíč (normalizace: lowercase + bez mezer). |
| Primární e-mail | `c-dYUboRJFlY` | text | Ano (podmíněně) | `app_login_identity`, `app_login_person_link` | Pouze při jednoznačném mapování osoby; normalizace na lowercase. |
| Třída | `c-hHZjjYF1CJ` | select | Ne | - | V tomto modelu nepoužíváme (škola pracuje se smečkami). |
| Kód vzdělvání | `c-XCYyjAf-ma` | text | Ne (V1) | - | Později možné mapovat na typ studia (`app_study_mode_map`). |
| Počáteční ročník | `c-Fd7lTBzEmr` | number | Ne (V1) | - | Ve V1 ne, ročníky bereme z Edookit. |
| Aktuální ročník | `c-zqfeZZPsqm` | select | Ne (V1) | - | Ve V1 ne, ročníky bereme z Edookit. |
| Aktivní | `c-uLx5khljlC` | checkbox | Ne jako autorita | - | Používá se jen pomocně; autorita aktivního stavu je Edookit. |
| Jméno | `c-MzlgfRju0X` | text (calculated) | Ano (fallback) | `app_person.display_name` | Pokud není lepší zdroj, použije se pro display name. |
| Docházka | `c-cxXNqOz_kN` | select (calculated) | Ne (V1) | - | Pro V1 bez mapování. |
| Přezdívka | `c--RSuRrZPWK` | text | Ne (V1) | - | Zatím bez cílového pole v `app_person`; zůstává v payload. |
| Čip UID | `c-vK7cxXAbsd` | text | Ne (V1) | - | Budoucí modul půjčovna/kiosk/síťový management. |
| Čip HID | `c-oR1sYBHd2C` | text | Ne (V1) | - | Budoucí modul půjčovna/kiosk/síťový management. |
| User | `c-rgD7fymETS` | person | Ne (V1) | - | Zatím bez mapování do auth modelu. |
| Organizace | `c-BgE__HgFyE` | text | Ne (V1) | - | V Coda je textový název; ve V1 bez mapování. |
| UUID | `c-9c3m0yh-dm` | text | Ne | - | Není Plus4U ID (ve vzorku je `ID-Organizace`), nepoužívat jako identitu. |
| Role | `c-aI2b_O-scX` | lookup | Ano | `app_role_assignment` | Tokenizace dle čárky + mapování na interní role (`rodic`, `zak`, `zamestnanec`, `pruvodce`, `patron`, `garant`, `admin`, ...). |
| Přezdívka TTS | `c-UfOIh9PNQb` | text | Ne (V1) | - | UX/TTS metadata, pro V1 bez mapování. |
| Oslovení TTS | `c-uVW9sfYm2R` | text | Ne (V1) | - | UX/TTS metadata, pro V1 bez mapování. |
| Smečka | `c-HuunarLxmI` | lookup | Ne (V1) | - | Později mapovat do `app_group` + `app_group_membership`. |
| Fotka | `c-prBoPVwTlA` | image | Ne (V1) | - | Ve V1 bez mapování. |
| Ročník | `c-htPmrPqL_r` | lookup (calculated) | Ne (V1) | - | Později mapovat do group členství / student state historie. |
| Kontaktní maily | `c-G9HEPv7cRM` | select | Ne (V1) | - | Pro auth se používá v legacy čtení; do identity modelu ve V1 nepřenášet hromadně (kolize e-mailů). |
| Děti | `c-9SFUzViDLO` | lookup | Ano (po mapování osob) | `app_person_relation` | `parent_of` vazby z row reference (`valueFormat=rich`, `rowId`). |
| Rodiče | `c-myPyzcpQgD` | lookup (calculated) | Ano (kontrola/backup) | `app_person_relation` | Reverse kontrola konzistence; primární zdroj je `Děti`. |

## Poznámky k aktuálnímu stavu

- Pro mapování osob je klíčové `Identifikátor`; u `Rodič` v Coda často chybí.
- Dočasný fallback pro rodiče: `Křestní + Příjmení` (ověřeno jako unikátní v aktuálních datech).
- Vazby `Rodič - Dítě` jsou v Coda dostupné jako validní row reference.
