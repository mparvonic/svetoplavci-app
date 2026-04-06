# Vývojový proces — světoplavci-app

Tento dokument popisuje kompletní vývojový proces: od nápadu po nasazení do produkce.

---

## Přehled prostředí

| Prostředí | URL | Git větev | Kdy |
|---|---|---|---|
| **Lokál – vývoj** | `localhost:3000` | `feature/xxx` | Denní vývoj a úpravy |
| **Lokál – prototyp** | `localhost:3000/prototype/...` | `feature/xxx` | Návrh UI před kódováním |
| **Proto** | `proto-app.svetoplavci.cz` | `proto` | Sdílené UX prototypy nad mock daty |
| **Test (staging)** | `test-app.svetoplavci.cz` | `staging` | Integrační testování nad test daty |
| **Produkce** | `app.svetoplavci.cz` | `main` | Ostrý provoz |

Povinný standard přenosů je popsán v:

- `docs/05-delivery/environment-promotion-policy.md`

Každý přechod mezi prostředími musí mít promotion záznam v `docs/09-status/promotions/`.

---

## Git strategie větví

```
main          ────●────────────────────●──────────── (produkce, auto-deploy)
                  ↑                    ↑
staging       ────●──●──●──────────────●──────────── (testování, auto-deploy)
                     ↑  ↑
feature/xxx          ●──●  (lokální vývoj, PR do staging)
```

### Pravidla:
- **`main`** — jen přes merge z `staging`, jen ověřený kód. Každý push spustí build a deploy do produkce.
- **`staging`** — sem mergujeme dokončené featury k testování. Každý push spustí build a deploy na staging.
- **`feature/xxx`** — pracovní větve pro každou novou funkcionalitu nebo opravu. Pojmenování: `feature/lodicky-pruvodce`, `fix/auth-redirect`, apod.
- **Nikdy nepushujeme přímo do `main`** (vyjma kritických hotfixů).

---

## Typický vývojový cyklus

### 1. Nový nápad / featura

```bash
# Vytvoř novou větev z aktuálního staging
git checkout staging
git pull
git checkout -b feature/nazev-featury
```

### 2. Prototypování (volitelné)

Pokud chceš nejprve vizuálně ověřit návrh **bez reálných dat**:

1. Spusť lokální server: `npm run dev`
2. Otevři `localhost:3000/prototype/nazev-prototypu`
3. Prototypové stránky jsou v `app/(prototype)/` — používají mock data z `src/lib/mock/`
4. Prototypuj s Claude Code: "Navrh mi stránku X podle vzoru Y z existující aplikace"
5. Jakmile jsi spokojený s designem, přejdi do fáze vývoje

> Složka `app/(prototype)/` je automaticky vyloučena z produkčního buildu (viz `next.config.ts`).

### 3. Vývoj

1. Uprav kód, přidej komponenty, napoj na reálné API
2. Testuj lokálně na `localhost:3000`
3. Průběžně commituj:

```bash
git add src/components/nova-komponenta.tsx
git commit -m "feat: přidána tabulka lodičky pro průvodce"
```

### 4. Otestuj na staging

```bash
git push origin feature/nazev-featury
# Na GitHubu: otevři Pull Request feature/nazev-featury → staging
# Po merge se automaticky buildí a deployuje na test-app.svetoplavci.cz
```

Před mergem do main:
- Otestuj přihlášení (Google + magic link)
- Prověř, že se data zobrazují správně
- Zkontroluj responzivitu na mobilu

### 5. Nasazení do produkce

```bash
# Na GitHubu: otevři Pull Request staging → main
# Po merge se automaticky buildí a deployuje na app.svetoplavci.cz
```

---

## Prostředí a konfigurace

### Lokál

Soubor `.env.local` (není v gitu) obsahuje:
```
POSTGRES_PRISMA_URL=...       # osobní DEV branch (nikdy prod)
CODA_API_KEY=...
AUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# ...ostatní proměnné
```

> Na lokále lze používat produkční Coda API jen pro čtení. Postgres musí být osobní DEV branch, ne produkce.

Lokální start je chráněn guardem:

```bash
npm run dev
```

Pokud by `POSTGRES_PRISMA_URL` ukazovala na produkční DB, start se zablokuje.

### Staging (test-app.svetoplavci.cz)

Staging běží na stejném VPS v Coolify jako produkce, ale jako oddělená aplikace:
- Používá Docker image tag `:staging` z ghcr.io
- Má vlastní sadu environment variables v Coolify
- Připojena na **Neon staging branch** (kopie produkčních dat)

### Produkce (app.svetoplavci.cz)

- Docker image tag `:latest`
- Produkční Neon database
- Produkční Coda tabulky

---

## Správa dat pro DEV a staging

Auth data (uživatelé, sessions) jsou v **Neon PostgreSQL**. Coda data jsou read-only.

### Neon database branching

Neon podporuje větvení databáze. Doporučený model:

- `dev-template` branch: pravidelně obnovovaný snapshot z prod.
- `dev-<developer>-<feature>` branch: osobní vývojová větev založená z `dev-template`.
- `staging` branch: sdílená test větev.

Založení a údržba DEV branch:

```bash
# refresh dev-template z prod parent
npm run db:dev-template:refresh -- --yes

# vytvoření osobní DEV větve
npm run db:dev-branch:create -- --developer <name> --feature <slug>

# reset osobní DEV větve
npm run db:dev-branch:reset -- --developer <name> --feature <slug> --yes
```

Staging větev je okamžitá kopie produkčních dat:

1. Přihlas se na [neon.tech](https://neon.tech)
2. Vyber projekt → záložka **Branches**
3. Klikni **New Branch** → pojmenuj `staging` → vyberte source branch `main`
4. Zkopíruj connection string pro staging větev
5. Nastav ho jako `POSTGRES_PRISMA_URL` v Coolify staging aplikaci

**Jednosměrná aktualizace staging dat:**
Kdykoli chceš mít na staging čerstvá produkční data (např. před větším testem):
1. V Neon konzoli smaž staging větev
2. Vytvoř novou `staging` větev ze `main` — získáš čerstvou kopii
3. Connection string zůstane stejný (stačí přepsat existující větev)

---

## Nastavení staging v Coolify

1. Coolify → **New Resource** → **Docker Image**
2. Image: `ghcr.io/mparvonic/svetoplavci-app:staging`
3. Domain: `test-app.svetoplavci.cz`
4. Environment variables: stejné jako produkce, jen s jiným `POSTGRES_PRISMA_URL` (Neon staging branch)
5. Nastav **Webhook** pro automatický redeploy při novém `:staging` tagu

---

## Prototypování s mock daty

Cílem je mít možnost navrhnout novou stránku nebo komponentu bez toho, aby bylo třeba napojovat reálné API.

### Struktura

```
src/lib/mock/
  children.ts       # mock data pro seznam dětí
  child-detail.ts   # mock data pro detail dítěte
  lodicky.ts        # mock data pro lodičky
  ...

app/(prototype)/
  layout.tsx        # layout s viditelným bannerem "PROTOTYP"
  [feature]/
    page.tsx        # prototypová stránka
```

### Jak prototypovat s Claude Code

Řekni Claude Code:
> "Navrhi mi prototypovou stránku pro správu lodičky průvodce. Použi mock data, stejný layout jako `app/(dashboard)/portal/dite/[childId]/page.tsx`, stejné komponenty (shadcn/ui, Tailwind), stejné barvy (#002060, #DA0100)."

Claude bude znát:
- Existující komponenty a jejich API
- Design systém (barvy, typography, spacing)
- Datový model (struktury z `src/types/coda.ts`)
- Existující vzory (tabulky, tabledety, karty)

---

## Design konzistence — pravidla

Aby celá aplikace vypadala jednotně, všechny nové stránky a komponenty musí dodržovat:

### Barvy
- Primární modrá: `#002060` (třídy: `text-[#002060]`, `bg-[#002060]`, `border-[#002060]`)
- Akcent červená: `#DA0100`
- Pozadí: bílá / `slate-50`

### Komponenty
- Vždy používej **shadcn/ui** komponenty (Button, Table, Card, Badge, Tabs…)
- Ikony výhradně z **Lucide React**
- Tabulky: vždy `<Table>` ze shadcn, ne plain `<table>`
- Záložky: `<Tabs>` ze shadcn

### Layout
- Dashboard stránky: `max-w-screen-xl mx-auto px-4`
- Nadpisy sekcí: `text-[#002060] font-semibold`
- Karty: `<Card>` se standardním `<CardHeader>` + `<CardContent>`

### Konvence pojmenování souborů
- Komponenty: `kebab-case.tsx` (např. `child-detail-tabs.tsx`)
- Typy: `src/types/coda.ts`, `src/types/auth.ts`
- API helpery: `src/lib/coda.ts`, `src/lib/auth.ts`

---

## Práce s Claude Code — doporučené postupy

### Před zahájením práce
Claude Code automaticky načte `CLAUDE.md` a tuto dokumentaci. Pro lepší výsledky:
- Řekni, co chceš udělat v kontextu: "Chci přidat stránku pro průvodce, podobnou stránce pro rodiče."
- Odkazuj na existující soubory: "Podobně jako `child-detail-tabs.tsx`."
- Uveď rozsah změny: "Jen frontend, bez nového API."

### Commit messages
Používej konvenci:
- `feat: popis nové funkce`
- `fix: popis opravy`
- `refactor: popis refaktoringu`
- `docs: aktualizace dokumentace`
- `chore: pomocné změny (závislosti, config)`

### Co nepushnout do gitu
- `.env.local` (obsahuje secrets)
- `.next/` (build output)
- `node_modules/`

---

## Checklist před nasazením do produkce

- [ ] Featura otestována na staging (`test-app.svetoplavci.cz`)
- [ ] Přihlášení funguje (Google + magic link)
- [ ] Data se načítají správně
- [ ] Mobil: responzivita OK
- [ ] Žádné console errory v prohlížeči
- [ ] PR `staging → main` vytvořen a zkontrolován

---

## Schéma celého procesu

```
Nápad
  │
  ▼
Prototyp (localhost/prototype, mock data)
  │  "Vypadá to dobře?"
  ▼
Vývoj (localhost:3000, feature větev)
  │
  ▼
PR: feature → staging
  │
  ▼
Testování (test-app.svetoplavci.cz, kopie prod dat)
  │  "Vše funguje?"
  ▼
PR: staging → main
  │
  ▼
Produkce (app.svetoplavci.cz) ✓
```
