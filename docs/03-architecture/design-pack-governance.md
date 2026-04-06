# Design Pack Governance

## Cíl

Udržet **jednotný a autoritativní** design napříč celou aplikací:

- stejné prvky = stejný vzhled a chování,
- změna pravidla se propíše zpětně do všech stejných prvků,
- nové typy UI se přidávají rozšířením design packu, ne ad-hoc.

## Zdroj pravdy

Primární zdroj design pravidel je v kódu:

- `src/lib/design-pack/ui.ts`

Obsahuje:

- verzi design packu (`DESIGN_PACK_META`),
- pravidla (`DESIGN_RULES`),
- barevné tokeny (`DESIGN_COLORS`),
- základní třídy pro opakované prvky (`UI_CLASSES`),
- podmíněné téma podle smečky (`getSmeckaTheme`, `SMECKA_THEME_PRESETS`).

## Povinný postup

1. Pokud vznikne nový typ UI prvku (např. nový typ tabulky), nejdřív se přidá do design packu.
2. Až potom se prvek používá v modulech (`M01`, `M03`, ...).
3. Změna existujícího pravidla se dělá centrálně v design packu.
4. Po změně se provede zpětné sjednocení existujících obrazovek stejného typu.

## Podmíněný design

- Výchozí podmíněná vrstva je podle `smečka`.
- Systém používá:
  - explicitní mapování pro známé smečky,
  - deterministic fallback pro nové/neznámé smečky.
- Cíl: dynamické barevné odlišení bez rozbití čitelnosti a konzistence.

## Praktické pravidlo pro vývoj

- Nepoužívat ad-hoc barvy a ad-hoc styly pro standardní prvky.
- Pro tlačítka, tabulky, nadpisy a badge preferovat `UI_CLASSES`.
- Pokud `UI_CLASSES` nestačí, rozšířit design pack a teprve pak použít nový vzor.
- Šířka hlavního kontejneru je globální pravidlo pro všechny stránky:
  - baseline `1180 px`,
  - dynamický růst podle viewportu až do `1440 px`,
  - používat pouze `UI_CLASSES.pageContainer` (třída `app-page-container`).

## Kontrola

- UI změny nejdřív ověřit na `ui-redesign` (referenční stránka).
- UI změny paralelně ověřit ve Storybooku (`npm run storybook`).
- Poté promítnout do `proto-shell`.
- Teprve následně do live modulů.

### Automatická pojistka

- CI vždy spouští `npm run design-pack:check-sync`.
- Kontrola vyžaduje, aby:
  - `ui-redesign` importoval design pack přímo ze `src/lib/design-pack/ui.ts`,
  - `ui-redesign` i Storybook reference vykreslovaly `DESIGN_PACK_META.version`,
  - pravidla, barvy a `UI_CLASSES` byly renderované dynamicky (`map`), ne ručně.
- Důsledek: změna tokenu nebo pravidla v design packu se automaticky projeví na obou referenčních plochách.
