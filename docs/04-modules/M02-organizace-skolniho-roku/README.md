# M02 Organizace školního roku

## Účel modulu

Správa konfigurovatelného školního roku, vzdělávacích období (plavby), skupin a navazujících pravidel organizace výuky.

## Scope

- In-scope:
  - školní rok (`app_school_year`),
  - vzdělávací období (`app_school_period`),
  - skupiny a členství (smečka, posádka, ročník, studijní skupina),
  - validační pravidla členství.
- Out-of-scope:
  - plán akcí (bude řešen v samostatném modulu),
  - synchronizace rozvrhu z Edookit API (následující krok).

## Závislosti

- M06 Uživatelé a role (osoby, role, aktivita),
- M11 Integrace (Edookit API),
- M12 Platform core (audit, auth, API vrstvy).

## Stav

- Fáze: implementace datového základu
- Priorita: vysoká
- Owner: TBD
- Poznámka:
  - K datu 2026-04-05 je na `svetoplavci_test` zavedena tabulka `app_school_period` a naplněn školní rok `2025/2026` na 5 plaveb.
