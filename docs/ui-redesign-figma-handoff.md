# UI redesign handoff pro Světoplavce

## Co je dnes v UI patrné

- Aplikace už má rozumný základ ve `shadcn/ui`, ale jednotlivé obrazovky si často definují vlastní vizuální pravidla.
- Primární barvy `#002060` a `#DA0100` jsou použité správně brandově, ale ne systémově. Červená často přebírá roli hlavního aktivního stavu i tam, kde by stačila sekundární akcentace.
- Rámečky a kontejnery nejsou hierarchizované. Některé moduly mají modrý border, jiné červený, jiné neutrální, ale význam té volby není stabilní.
- Přihlášení už má nejsilnější vizuální charakter. Dashboard, detail dítěte a admin jsou proti tomu výrazně utilitárnější.
- Datové obrazovky fungují, ale chybí jim silnější orientace: sticky souhrn, výraznější sekce, konzistentní filtrační vrstva a jasné rozlišení mezi souhrnem a tabulkou.

## Navržený směr

- Vizuální metafora: klidná paluba. Tmavě modrý navigační a hero systém, světlé datové panely, červená jen pro důležité upozornění nebo aktivní akci.
- Rodičovská část má být přívětivá a informativní, ne „administrativní tabulka s daty“.
- Admin má dostat vlastní provozní dashboard, ne jen stejný vizuální jazyk bez odlišení účelu.
- Kiosk má být navržen jako prezentační plocha z dálky: velká typografie, minimum drobných detailů.

## Doporučené tokeny

| Token | Barva | Použití |
|---|---|---|
| Ink | `#05204A` | hlavní text, top bar, důležité titulky |
| Ocean | `#0A4DA6` | primární CTA, aktivní tab, odkazy |
| Sail | `#F4F8FC` | sekundární plochy, filtry, pozadí panelů |
| Mist | `#D9E4F2` | border, dělící čáry, neaktivní stavy |
| Signal | `#D63A2F` | chyby, varování, zvýrazněné upozornění |
| Sun | `#F6B94C` | informativní badge, jemný akcent |

## Komponentová pravidla

- `Page shell`: horní pruh s názvem produktu, kontextem sekce a uživatelským avatarem.
- `Hero panel`: jen pro vstupní nebo přehledové stránky, ne pro každou tabulku.
- `Info card`: bílá karta, radius 24-28 px, border `Mist`, jemný stín.
- `Data module`: bílý panel s horním titulkem a interním table wrapperem.
- `Filter rail`: samostatný levý nebo horní panel, nesmí splývat s tabulkou.
- `Tabs`: aktivní stav primárně modrý, červená jen pro výjimečné emphasis.
- `Alerts`: červené nebo jantarové pozadí jen v menší informační vrstvě, ne jako hlavní layoutový motiv.

## Obrazovky k překreslení ve Figmě

1. `Sign in`
   - Hero vlevo, login card vpravo
   - Důvěra, kontakt, GDPR, podpora
   - CTA hierarchy: Google primary, email secondary

2. `Parent dashboard`
   - Hero s krátkým vysvětlením a aktivním dítětem
   - Karty dětí
   - Rychlé metriky: lodičky, vysvědčení, tempo růstu
   - Postranní panel účtu a upozornění

3. `Child detail`
   - Horní sticky souhrn dítěte
   - Taby jako přepínač modulů
   - Filtrační panel oddělený od tabulky
   - Datový modul jako hlavní pracovní plocha

4. `Admin overview`
   - Levá provozní navigace
   - Hlavní dashboard se sync akcí
   - Metriky, události, systémový stav

5. `Kiosk`
   - Velké bloky informací
   - Kontrastní pozadí
   - Minimum drobného textu

## Frame doporučení pro Figmu

- Desktop app shell: `1440 x 1200`
- Sign-in landing: `1440 x 1024`
- Child detail data page: `1440 x 1280`
- Admin dashboard: `1440 x 1100`
- Kiosk display: `1920 x 1080`
- Mobilní parent dashboard doplnit ve druhé vlně: `390 x 844`

## Co je připravené v repu

- Prototypová stránka s náhledy: `/ui-redesign`
- Tento handoff dokument: [docs/ui-redesign-figma-handoff.md](/Users/miroslav/Projects/svetoplavci-app/docs/ui-redesign-figma-handoff.md)

## Doporučený postup do Figmy

1. Překreslit pět základních frame podle prototypu `/ui-redesign`.
2. Založit lokální design tokens podle tabulky výše.
3. Vytvořit komponenty `TopBar`, `HeroPanel`, `MetricCard`, `FilterRail`, `DataModule`, `Alert`.
4. Teprve potom navázat detailní responsive varianty a edge stavy.
