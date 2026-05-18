# M03 Doménový model akcí

## Cíl modelu

Univerzální datový model pro všechny typy akcí bez hardcodu v aplikační logice.

## Entity

- `SchoolEventType` (číselník chování typu akce)
- `SchoolEventTemplate` (šablony akcí)
- `SchoolEventSeries` (opakování)
- `SchoolEvent` (konkrétní instance)
- `SchoolEventAudienceRule` (dynamické cílení)
- `SchoolEventAudienceSnapshotBatch` + `SchoolEventAudienceSnapshotItem` (zamrazení účastníků)
- `SchoolEventOfferGroup` (sada alternativních akcí ve stejném slotu)
- `SchoolEventRegistrationPolicy` (okna a pravidla zápisu)
- `SchoolEventRegistration` (aktuální stav zápisu osoby)
- `SchoolEventAttendance` (docházka)
- `SchoolEventModuleLink` (napojení dalších modulů)

## Základní koncepty

### 1) Akce vs. typ akce

- `SchoolEventType` určuje pravidla chování:
  - vazba na kalendář,
  - vazba na rozvrh,
  - povinnost vazby na rozvrh,
  - cílový kalendář (`student/group/both`).
- `SchoolEvent` drží konkrétní data události.

### 2) Cílení pravidly + snapshot

- V návrhu se nastavuje `SchoolEventAudienceRule` (dynamické cílení).
- Při publikaci nebo uzávěrce se vytvoří snapshot:
  - `SchoolEventAudienceSnapshotBatch`
  - `SchoolEventAudienceSnapshotItem`.
- Historické účastnictví se od té chvíle neodvozuje z aktuálního stavu skupin, ale ze snapshotu.

### 3) Opakování

- Série je reprezentovaná `SchoolEventSeries` (RRULE + timezone).
- Jednotlivé výskyty jsou `SchoolEvent`.
- Výjimky se řeší editací konkrétní instance.

### 4) Nabídky akcí (Ostrovy)

- Termín ostrovů je časový slot, ve kterém si dítě vybírá z dostupné nabídky.
- `SchoolEventOfferGroup` seskupuje alternativní ostrovy v jednom termínu.
- Dítě může vybírat ze všech budoucích ostrovů, které jsou dostupné pro skupiny, jejichž je členem.
- Pravidlo volby (`AT_MOST_ONE` / `EXACTLY_ONE`) se vyhodnocuje nad konkrétním termínem.
- V jednom termínu může mít dítě aktivně zapsaný pouze jeden ostrov.

### 4a) Jednorázové a dlouhodobé ostrovy

- Jednorázový ostrov má jeden termín a zápis platí pouze pro tento termín.
- Dlouhodobý ostrov má období nebo sadu dílčích termínů.
- U dlouhodobého ostrova se dítě zapisuje na celý ostrov, ne na jednotlivé dílčí termíny.
- Aktivní zápis na dlouhodobý ostrov blokuje zápis na jiné ostrovy ve všech jeho dílčích termínech.
- Dílčí termíny dlouhodobého ostrova slouží pro rozvrh, kalendář a docházku; nejsou samostatnými volbami dítěte.
- Kapacita dlouhodobého ostrova se počítá nad celým ostrovem, dítě se započítá jednou.

### 5) Zápisy a výjimky průvodce

- `SchoolEventRegistrationPolicy` určuje okna zápisu/odhlášení.
- `SchoolEventRegistration` drží aktuální stav osoby.
- Při zápisu se kontrolují všechny dotčené termíny:
  - jednorázový ostrov kontroluje svůj jeden termín,
  - dlouhodobý ostrov kontroluje všechny dílčí termíny.
- Po uzávěrce je změna možná jen jako výjimka průvodce (`is_exception=true`, audit).

### 6) Vazba na rozvrh a kalendář

- Akce může být svázaná s konkrétní hodinou.
- Při `update_linked_lesson` se aktualizuje existující kalendářová událost hodiny.
- Pokud akce přepíše čas, nastaví se `time_override_lock`.
- Další synchronizace rozvrhu nesmí čas přepsat, dokud je lock aktivní.

### 7) Rozšiřitelnost

- `SchoolEventModuleLink` umožní navázat další moduly:
  - lodičky,
  - portfolio,
  - hodnocení,
  - další budoucí moduly.

## Invarianty

- Každá akce má validní časový rozsah.
- U typu akce s `schedule_link_policy=required` musí existovat vazba na hodinu.
- Pokud existuje snapshot batch, operace s účastníky se primárně řídí snapshotem.
- V jednom termínu ostrovů nesmí mít osoba více než jednu aktivní registraci.
- U dlouhodobého ostrova platí jedna registrace pro celý ostrov a rezervuje všechny jeho dílčí termíny.
- Dítě se nesmí zapisovat na samostatný dílčí termín dlouhodobého ostrova.
- `time_override_lock=true` blokuje přepis času z běžného syncu rozvrhu.
