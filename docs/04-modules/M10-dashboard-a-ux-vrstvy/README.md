# M10 Dashboard a UX vrstvy

## Účel modulu

Definovat a průběžně řídit UX vrstvu aplikace napříč rolemi (`rodič`, `dítě`, `průvodce`, `správce aplikace`, `správce sítě`) tak, aby:

- aplikace měla jednotný shell (layout, navigace, dashboard),
- moduly (M01, M03, M04...) měly konzistentní interakční vzory,
- šel provozovat proto-first workflow: klikací návrh na `proto-app` -> implementace -> nasazení na `test-app`.

## Scope

- In-scope:
  - role-based navigace, dashboardy a domovské obrazovky,
  - design pravidla pro obsah modulů (tabulky, detail, formuláře, stavy),
  - prototypové obrazovky v `app/(prototype)/` s mock daty,
  - přenos schváleného UX do implementace na `staging`/`main`.
- Out-of-scope:
  - business logika modulů (hodnocení, registrace, výpočty),
  - detailní API kontrakty jednotlivých backend modulů,
  - grafický branding mimo aplikační rozhraní (web školy, marketing).

## Závislosti

- M06 Uživatelé a role (řízení viditelnosti podle rolí),
- M01 Výsledky vzdělávání (lodičky jako referenční UX modul),
- M03 Ostrovy (akce, registrace, docházka),
- M11 Integrace (kalendáře, rozvrh, notifikace).

## Stav

- Fáze: realizace Fáze A (proto shell spuštěn)
- Priorita: vysoká
- Owner: vývoj + produkt (průběžné schvalování obrazovek)
