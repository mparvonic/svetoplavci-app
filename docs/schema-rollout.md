## Schema Rollout + Data Refresh (mini-playbook)

Cil: zabránit stavu, kdy aplikace bezi proti DB, ktera nema pozadovane sloupce/tabulky.

### Zakladni pravidlo poradi

1. **Schema nejdrive** (migrace / SQL patch).
2. **Data refresh az potom** (kopie/anonymizace dat).
3. **Kontrola po refreshi** (`npm run db:check:schema`).

---

## 1) Zmena schema pri vyvoji

Na feature vetvi:

```bash
git checkout -b feature/...
npm run db:tunnel
```

V druhem terminalu:

```bash
npx prisma migrate dev --name popis_zmeny
```

Pak commitnout:

- `prisma/schema.prisma`
- `prisma/migrations/...`

> Pokud zmena schema vznikne jen editaci `schema.prisma` bez migrace, je to riziko driftu.

---

## 2) Nasazeni schema do prostredi

Pred testovanim / po deployi aplikace:

```bash
npm run db:check:schema
```

Kdyz check neprojde:

- aplikace a DB nejsou ve stejne schema verzi,
- nejdriv aplikovat migrace nebo cileny SQL patch,
- az pak testovat endpointy.

---

## 3) Data refresh (staging/dev)

Data refresh script (`db:refresh:staging`, `db:refresh:dev`) resi primarne data.

Pred spustenim refresh:

```bash
npm run db:check:schema
```

Po refreshi:

```bash
npm run db:check:schema
```

Pokud check po refreshi selze, je potreba nejdriv dorovnat schema.

---

## 4) Emergency patch (kdyz chybi jeden konkretni sloupec)

Pouzit pouze jako docasne reseni:

```sql
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...;
```

Následně:

1. dopsat standardni Prisma migraci,
2. commitnout ji,
3. sjednotit schema ve vsech prostredich.
