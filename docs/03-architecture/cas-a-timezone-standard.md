# Čas a Timezone Standard

## Cíl

Mít konzistentní pravidla pro časové údaje v DB i aplikaci tak, aby:

- systémové časy byly jednoznačné a auditovatelné,
- business logika fungovala správně pro CET/CEST (Europe/Prague),
- nedocházelo k posunům data/času při importu, API a UI zobrazení.

## DB standard (PostgreSQL)

### 1. Výchozí timezone serveru/DB/role

- Default timezone je `UTC`.
- UTC je systémový standard pro ukládání a výpočty.

### 2. Typy sloupců

- Všechny sloupce typu `DateTime` ukládat jako `timestamptz(3)`.
- Nepoužívat `timestamp without time zone`.
- Pro čistě kalendářní údaj bez času (např. školní rok od-do, plavba od-do) používat `date`.

### 3. Nové tabulky (doporučený pattern)

```sql
created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
```

Prisma:

```prisma
createdAt DateTime @db.Timestamptz(3) @default(now()) @map("created_at")
updatedAt DateTime @db.Timestamptz(3) @updatedAt @map("updated_at")
```

### 4. Intervaly a constraints

- Pro časové intervaly používat `tstzrange(...)`.
- Exclusion constraints nad intervaly stavět nad `tstzrange`, ne `tsrange`.

## Import a zápis dat

### 1. Zdroj obsahuje timezone/offset

- Uložit přímo jako instant (`timestamptz`), offset zachovává význam času.

### 2. Zdroj je lokální čas bez timezone (školní provoz)

- Při zápisu interpretovat jako `Europe/Prague` a převést na instant.
- SQL vzor:

```sql
-- local Prague wall-time -> timestamptz instant
SELECT ('2026-04-05 08:30:00'::timestamp AT TIME ZONE 'Europe/Prague');
```

### 3. Datum bez času

- Ukládat jako `date`, nepřevádět na půlnoc v `datetime`, pokud to není nutné.

## Aplikační vrstva (API/UI)

### 1. API kontrakt

- API vrací/posílá čas v ISO 8601 (`.toISOString()`), tj. UTC instant.
- API nevrací „naivní“ lokální timestamp bez timezone.

### 2. Zobrazení v UI

- Pro uživatele zobrazovat v `Europe/Prague`.
- Včetně automatického přechodu CET/CEST.

JS příklad:

```ts
const fmt = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: "Europe/Prague",
  dateStyle: "short",
  timeStyle: "short",
});
fmt.format(new Date(isoString));
```

### 3. Filtrování podle dne v Europe/Prague

- Hranice dne počítat v `Europe/Prague`, ne podle UTC půlnoci.
- DB dotaz potom dělat nad UTC instant intervalem.

## Migrace starých schémat

- Při převodu z `timestamp without time zone` na `timestamptz` používat explicitní interpretaci:

```sql
ALTER TABLE ...
  ALTER COLUMN some_ts
  TYPE TIMESTAMPTZ(3)
  USING some_ts AT TIME ZONE 'UTC';
```

- Pokud původní data reprezentují lokální čas Europe/Prague, použít místo `UTC` explicitně `Europe/Prague`.
- Po migraci ověřit:
  - nulový počet `timestamp without time zone` sloupců,
  - funkčnost constraintů/funkcí s intervaly,
  - doménové projekce (např. M01 `projectionMismatch = 0`).

## Kontrolní SQL

```sql
SHOW timezone;
```

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'timestamp without time zone';
```
