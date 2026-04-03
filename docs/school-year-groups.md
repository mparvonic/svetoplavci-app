## Školní rok, skupiny a změnová historie

Tento dokument popisuje datový základ pro:

- školní rok,
- skupiny a členství,
- změnovou historii stavu dítěte (ročník + typ studia),
- dynamická validační pravidla členství.

### Zásady

- Neprovádí se žádné automatické převody ročníků.
- Za pravdivý zdroj aktuálního ročníku a typu studia se považuje Edookit.
- Změny se ukládají jako časové intervaly (`valid_from` / `valid_to`, `effective_from` / `effective_to`).
- Nepoužívají se plné snapshoty všech dat, pouze detekce změny oproti poslednímu uloženému stavu.

### Typ studia

- Zdroj: `UIV_ZPUSOB` v datech žáka z Edookit.
- Mapování je přes `app_study_mode_map`.
- Potvrzené mapování: `11` = `denni`.
- Ostatní kódy jsou dočasně vedené jako `unknown`, dokud nebude potvrzené mapování.

### Skupiny

Tabulky:

- `app_school_year`
- `app_group`
- `app_group_link`
- `app_group_membership`
- `app_group_membership_event`

Podporované druhy skupin:

- `stupen`
- `rocnik`
- `smecka`
- `posadka`
- `studijni_skupina`

`ClassName` z Edookit se v této fázi nepoužívá jako zdroj pro skupiny.

### Dynamická pravidla členství

Tabulky:

- `app_membership_policy`
- `app_membership_policy_rule`
- `app_membership_violation`

Pravidla nejsou natvrdo v kódu, ale v datech (policy model).  
V1 seed obsahuje pravidla pro `denni`/`individualni`/`zahranici`/`unknown` a roli `host`.

Validace je implementována databázově:

- deferred constraint triggery na `app_group_membership`, `app_student_state`, `app_role_assignment`,
- porušení se zapisuje do `app_membership_violation`,
- režim validace:
  - `monitor` pro změny ze sync zdrojů (`edookit*`, `auto`, `system`, `policy_change`),
  - `strict` pro ostatní (typicky ruční změny), kde se při porušení vyhazuje DB chyba.

### Změnová historie stavu dítěte

Tabulka: `app_student_state`

Sledují se změny:

- `current_grade_num`
- `initial_grade_num`
- `study_mode_code`
- `study_mode_key`

Mechanismus:

1. Sync načte aktuální data z Edookit.
2. Pro každé dítě porovná hash sledovaných polí s otevřeným stavem.
3. Pokud se stav nezměnil, interval zůstává otevřený.
4. Pokud se stav změnil, uzavře se starý interval a otevře nový.

Tím vzniká průběžná časová historie bez ukládání plných denních snapshotů.
