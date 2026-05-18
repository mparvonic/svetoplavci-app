# M03 Implementační plán

## Cíl

Zavést dynamický modul akcí bez hardcodu typů v kódu, napojený na rozvrh a kalendáře.

## Fáze 1: Plán a datový návrh (hotovo)

- Potvrzený business koncept akcí.
- Potvrzen model cílení:
  - dynamické cílení pravidly,
  - snapshot účastníků při publikaci/uzávěrce.
- Potvrzeno chování vazby na rozvrh:
  - akce může přepsat i čas,
  - `time_override_lock` blokuje zpětné přepsání časů rozvrhem.

## Fáze 2: Datový základ M03 (další krok)

- Rozšířit DB schéma o:
  - šablony akcí,
  - série opakování,
  - termíny ostrovů a období dlouhodobých ostrovů,
  - pravidla cílení,
  - snapshot účastníků,
  - nabídky akcí,
  - policy zápisu,
  - registrace,
  - docházku,
  - module links.
- Zavést validační constrainty (čas, required vazby, konzistence cílení).

## Fáze 3: Aplikační pravidla a workflow (další krok)

- Stavový model akce: draft -> published -> registration_closed -> completed/canceled.
- Snapshot engine:
  - vytvoření snapshotu při publikaci,
  - volitelně nový snapshot při uzávěrce.
- Zápisy:
  - kontrola registračního okna,
  - odhlášení ve stejném okně,
  - kontrola kolizí v dotčených termínech,
  - u dlouhodobých ostrovů jeden zápis na celý ostrov, ne na dílčí termíny,
  - výjimka průvodce po uzávěrce s auditem.
- Nabídky akcí:
  - vyhodnocení `AT_MOST_ONE` / `EXACTLY_ONE` po termínech.

## Fáze 4: Integrace s rozvrhem a kalendáři (další krok)

- Resolver vazby akce -> hodina (aktuální rozvrh se zohledněním změnového).
- Merge pravidla do kalendáře:
  - `separate_event`,
  - `update_linked_lesson`.
- Persistenční locky (`time_override_lock`, další locky dle potřeby).

## Fáze 5: API a UI (další krok)

- Admin UI: číselník typů akcí, šablony, nabídky.
- Průvodce UI: vytvoření akce, publikace, snapshot, správa zápisů a docházky.
- Rodič/žák UI: přihlášení/odhlášení, náhled účasti, rozlišení jednorázového a dlouhodobého ostrova.

## Fáze 6: Rozšíření a moduly (další krok)

- Napojení lodiček, portfolia a hodnocení přes `module_link`.
- Export veřejných akcí na veřejný web.
- Rozšíření o další typy akcí bez změny jádra.

## Rizika a mitigace

- Riziko: nekonzistentní účastníci po změně skupin.
  - Mitigace: snapshot batch + audit.
- Riziko: přepis akcí rozvrhem.
  - Mitigace: override locky a merge precedence.
- Riziko: konflikt registrací v nabídce akcí.
  - Mitigace: validační pravidla nad offer group.
- Riziko: růst komplexity.
  - Mitigace: modulární datový model, bez hardcodu typů.
