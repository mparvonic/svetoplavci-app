# Runbook: M03 import Ostrovů z Coda (školní rok 2025/2026)

Tento runbook je historický migrační dokument. Coda po migraci slouží pouze jako archivní stopa a aplikace z ní nesmí číst v runtime.

## Účel

Bezpečně převést historické a aktuální akce typu Ostrov z Coda do interního datového modelu M03 pouze pro školní rok `2025/2026` (od `2025-09-01` včetně).

## Rozsah (v1)

- Zdroj: Coda dokument `Qt8oQFVMSJ`.
- Tabulky:
  - `grid-RPOzBx6_z5` (Ostrovy),
  - `grid-uxFgm5-EmQ` (Zápisy),
  - `grid-2joE22w348` (Termíny).
- Časový filtr: `Termíny.Datum >= 2025-09-01 AND Termíny.Datum <= 2026-08-31`.
- Cíl:
  - `app_school_event_offer_group`,
  - `app_school_event`,
  - `app_school_event_registration_policy`,
  - `app_school_event_registration`.

Poznámka: v1 neimportuje docházku ani vazby na další moduly.

## Aktuální datová baseline (analýza 2026-04-05)

- Ostrovy v Coda celkem: `384`.
- Ostrovy po filtru školního roku 2025/2026: `139`.
- Unikátní jména v zápisech po filtru: `100`.
- Při mapování účastníků na test DB:
  - mapováno na aktivní roli `žák`: `89`,
  - mapováno na neaktivního `žák`: `1` (`Lada Elsterová`),
  - mapováno mimo roli `žák`: `1` (`Anežka Dvořáková`, neaktivní),
  - nenalezeno v DB: `7`,
  - nevyřešené Coda reference (`#r...`): `2`.

## Mapování polí

### Ostrovy -> app_school_event

- `Název` -> `title`
- `Popisek` -> `description`
- `Místo` -> `location`
- `Termíny.Datum` -> `starts_at`, `ends_at`, `all_day=true`
  - `starts_at`: `YYYY-MM-DD 00:00:00 Europe/Prague`
  - `ends_at`: `YYYY-MM-DD + 1 den 00:00:00 Europe/Prague` (exkluzivní konec celodenní události)
- `Typ` (Coda) -> pro v1 pouze metadata; typ události v aplikaci je pevně `OSTROVY`
- `Max dětí` -> `app_school_event_registration_policy.capacity`
- `source='coda'`
- `source_ref='Qt8oQFVMSJ:grid-RPOzBx6_z5:<coda_row_id>'`
- `school_year_id` -> `app_school_year.code='2025/2026'`
- `Obrázek` (Coda `ImageObject[]`) -> soubory uložit na vlastní storage na VPS + metadata do `app_school_event.metadata.images`
  - v Coda je obrázek dostupný jako `name`, `url`, `width`, `height`, `status`,
  - pro každou akci stáhnout obrázky z `url` a uložit pod stabilní cestu, např.:
    - `/data/svetoplavci/media/school-events/2025-2026/<event_source_ref>/<filename>`,
  - v DB držet pouze metadata (`original_url`, `stored_path`, `mime`, `size`, `width`, `height`, `sha256`),
  - po migraci UI čte pouze `stored_path`/`public_url`, nikdy přímo Coda URL.

### Termíny -> app_school_event_offer_group

- Jeden termín = jedna nabídka (`offer group`) pro daný den.
- `selection_mode='AT_MOST_ONE'`, `max_selections_per_person=1`, `allow_no_selection=true`.
- `code` doporučeně: `ostrovy-YYYY-MM-DD`.

### Zápisy -> app_school_event_registration

- Každý řádek v Coda `Zápisy` = registrace na konkrétní Ostrov.
- `status='REGISTERED'`.
- `changed_at`:
  - primárně z Coda `Created on`,
  - fallback `NOW()`.
- Duplicitní zápisy stejného dítěte na stejný Ostrov:
  - zachovat poslední podle `Created on`, starší ignorovat.

## Mapování osob (žáci/průvodci)

### Doporučené pořadí pro žáky

1. Přímá reference z Coda (`Zak` row reference), pokud je mapovatelná.
2. `Jméno + Příjmení` (normalizace diakritiky a mezer) + preference aktivní role `žák`.
3. Ruční override tabulka (`coda_name -> app_person.id`) pro sporné případy.

### Pravidla kvality mapování

- Aktivní `žák`: import bez varování.
- Neaktivní `žák`: importovat pouze při explicitním potvrzení.
- Osoba bez role `žák`: neimportovat automaticky.
- Nenalezené jméno / `#r...`: neimportovat; uložit do reportu.

## Postup

1. Export raw snapshotu
- Exportovat všechny 3 zdrojové tabulky do jedné složky snapshotu.
- Snapshot uložit jako auditní podklad (neměnit).

2. Vygenerovat mapovací report
- Po aplikaci filtru školního roku vytvořit report:
  - počty akcí, registrací, kapacit,
  - seznam nenamapovaných účastníků,
  - seznam neaktivních/sporných osob,
  - seznam `#r...` referencí.

3. Doplnit ruční override mapování
- Vytvořit/aktualizovat mapovací soubor s výjimkami.
- Bez uzavřeného override neprovádět ostrý import.

4. Dry-run na test DB
- Import pouze do `svetoplavci_test`.
- Zapsat import batch do `metadata` každé vytvořené/aktualizované entity.

5. Validace po dry-run
- Porovnat počty Coda vs DB.
- Ověřit konzistenci registrací a kapacit.
- Ručně zkontrolovat vzorek min. 10 akcí.
- Ověřit, že obrázky jsou fyzicky uložené na VPS storage a metadata v DB odkazují na lokální copy.

6. Ostrý běh na produkci
- Spustit stejný import se stejným snapshotem + override mapou.
- Po běhu uložit validační report do `docs/09-status/`.

### Implementační příkaz (skript)

```bash
# dry-run (nic nezapisuje)
npm run m03:import:ostrovy:2025-2026 -- --report-out /tmp/m03-ostrovy-dryrun.json

# apply (zapisuje do DB + stahuje obrazky)
npm run m03:import:ostrovy:2025-2026 -- \
  --apply \
  --media-root /data/svetoplavci/media/school-events \
  --report-out /tmp/m03-ostrovy-apply.json
```

Volitelné stabilizační přepínače pro horší síť:

```bash
--request-timeout-ms 120000   # timeout na Coda API request
--image-timeout-ms 8000       # timeout na download jednoho obrázku
```

Poznámka k běhu přímo na VPS hostu:

- Pokud `POSTGRES_PRISMA_URL` obsahuje interní Docker hostname (např. `svetoplavci-auth-db-proxy`), může být mimo síť kontejneru nedostupný.
- V takovém případě přepiš host na IP DB kontejneru (např. `172.20.0.2`) a URL předej přes `--db-url`.

## Kontroly po importu (SQL)

```sql
-- 1) Počet importovaných akcí Ostrovy pro školní rok 2025/2026
SELECT COUNT(*) AS events_count
FROM app_school_event e
JOIN app_school_event_type t ON t.id = e.event_type_id
WHERE t.code = 'OSTROVY'
  AND e.source = 'coda'
  AND e.starts_at >= TIMESTAMPTZ '2025-09-01 00:00:00+02'
  AND e.starts_at <  TIMESTAMPTZ '2026-09-01 00:00:00+02';

-- 2) Počet registrací na importované akce
SELECT COUNT(*) AS registrations_count
FROM app_school_event_registration r
JOIN app_school_event e ON e.id = r.school_event_id
JOIN app_school_event_type t ON t.id = e.event_type_id
WHERE t.code = 'OSTROVY'
  AND e.source = 'coda'
  AND e.starts_at >= TIMESTAMPTZ '2025-09-01 00:00:00+02'
  AND e.starts_at <  TIMESTAMPTZ '2026-09-01 00:00:00+02';

-- 3) Registrace bez platného žáka (nesmí být)
SELECT r.id, r.school_event_id, r.person_id
FROM app_school_event_registration r
LEFT JOIN app_role_assignment ra
  ON ra.person_id = r.person_id
 AND ra.role = 'zak'
 AND ra.is_active = true
WHERE ra.id IS NULL;

-- 4) Akce bez registration policy (nesmí být)
SELECT e.id, e.title
FROM app_school_event e
JOIN app_school_event_type t ON t.id = e.event_type_id
LEFT JOIN app_school_event_registration_policy p ON p.school_event_id = e.id
WHERE t.code = 'OSTROVY'
  AND e.source = 'coda'
  AND p.id IS NULL;
```

## Rollback (v1)

- Import je veden jako idempotentní update podle `source_ref`.
- Pro rollback jedné dávky:
  - vyhledat importované záznamy podle `source='coda'` a `metadata.import_batch`,
  - nejdřív zneaktivnit registrace,
  - potom zneaktivnit akce (`is_active=false`),
  - nemazat auditní data.

## Otevřené body před implementací import skriptu

- Potvrdit finální pravidlo pro neaktivní žáky (importovat/neimportovat).
- Potvrdit, zda i v1 zakládat `app_school_event_target` ze sloupce `Skupiny`, nebo ho zatím držet jen v `metadata`.
- Potvrdit, zda u historických událostí rovnou nastavit `lifecycle_status='COMPLETED'`.
