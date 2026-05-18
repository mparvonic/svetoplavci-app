# M03 Ostrovy

## Účel modulu

Správa školních akcí (zejména Ostrovy, Expedice, Slavnosti a další) včetně cílení na účastníky, zapisování, docházky a synchronizace do kalendářů.

## Scope

- In-scope:
  - jednotný model akce s časem, místem, popisem a cílovým publikem,
  - opakování akcí (série + výjimky),
  - rozlišení jednorázového ostrova a dlouhodobého ostrova s více dílčími termíny,
  - definice termínů ostrovů a období pro dlouhodobé ostrovy před vytvářením konkrétní nabídky,
  - cílení pravidly (osoby, skupiny, role, výrazy) + snapshot účastníků při publikaci/uzávěrce,
  - zapisování na akce (včetně odhlášení) a výjimky průvodce po uzávěrce,
  - nabídky akcí (např. Ostrovy) pro konkrétní termín s pravidlem „nejvýše jedna volba v daném termínu“,
  - evidence docházky,
  - vazba akce na rozvrh a update existující kalendářové události,
  - šablony akcí,
  - rozšiřitelné napojení dalších modulů (lodičky, portfolio, hodnocení).
- Out-of-scope:
  - výpočty hodnocení (samostatný modul),
  - veřejný web frontend (publikační API je in-scope, veřejná prezentace ne),
  - detailní UX návrh obrazovek (bude řešeno po datovém základu).

## Závislosti

- M02 Organizace školního roku (skupiny, období, plavby),
- M06 Uživatelé a role,
- M11 Integrace (Edookit + Google Calendar),
- M12 Platform core (audit, queue, policy).

## Stav

- Fáze: návrh potvrzen, rozpracování
- Priorita: vysoká
- Owner: TBD

## Klíčová rozhodnutí (potvrzeno)

- Cílení akcí se zadává dynamicky pravidly.
- Při publikaci/uzávěrce se provádí snapshot konkrétních účastníků.
- Dítě vidí dostupné budoucí ostrovy podle členství ve skupinách a podle otevřeného zápisu.
- Pravidlo volby se vyhodnocuje po termínech: v jednom termínu může mít dítě aktivně zapsaný pouze jeden ostrov.
- U dlouhodobého ostrova se dítě zapisuje na celý ostrov, ne na jednotlivé dílčí termíny. Zápis obsadí všechny dílčí termíny daného dlouhodobého ostrova.
- Akce navázaná na rozvrh může přepsat i čas hodiny.
- Přepis času z akce musí být persistovaný (`time_override_lock`), aby další sync rozvrhu akci nepřepsal zpět.

## Navazující dokumenty

- `docs/04-modules/M03-ostrovy/domenovy-model-akci.md`
- `docs/04-modules/M03-ostrovy/implementation-plan.md`
- `docs/05-delivery/implementation-checklist-m03-akce.md`
- `docs/07-operations/runbooks/m03-ostrovy-coda-import-2025-2026-runbook.md`
