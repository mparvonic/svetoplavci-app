# Vývojový proces — světoplavci-app

Tento dokument popisuje kompletní vývojový proces: od nápadu po nasazení do produkce.

---

## Přehled prostředí

| Prostředí | URL | Git větev | Kdy |
|---|---|---|---|
| **Lokál – vývoj** | `localhost:3000` | `feature/xxx` | Denní vývoj a úpravy |
| **Lokál – prototyp** | `localhost:3000/prototype/...` | `feature/xxx` | Návrh UI před kódováním |
| **Staging** | `app-test.svetoplavci.cz` | `staging` | Testování před nasazením |
| **Produkce** | `app.svetoplavci.cz` | `main` | Ostrý provoz |

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

### Dlouhodobý governance model (závazné)

- **Jediný povolený tok změn:** `feature/fix -> staging -> main`.
- **`staging` je integrační a testovací větev** (nejaktuálnější funkční stav před produkcí).
- **`main` je pouze release větev** (obsahuje jen změny ověřené na staging).
- **Do `main` se nikdy nemerguje přímo feature větev.**
- **`main` se nikdy nepoužívá jako zdroj pro vývoj nové feature.**

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
# Po merge se automaticky buildí a deployuje na app-test.svetoplavci.cz
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
POSTGRES_PRISMA_URL=...       # Neon production DB (nebo staging branch)
CODA_API_KEY=...
AUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# ...ostatní proměnné
```

> Na lokále lze bezpečně používat produkční Coda API (jen čtení). Pro Postgres doporučuji Neon staging branch (viz níže).

### Staging (app-test.svetoplavci.cz)

Staging běží na stejném VPS v Coolify jako produkce, ale jako oddělená aplikace:
- Používá Docker image tag `:staging` z ghcr.io
- Má vlastní sadu environment variables v Coolify
- Připojena na **Neon staging branch** (kopie produkčních dat)

### Produkce (app.svetoplavci.cz)

- Docker image tag `:latest`
- Produkční Neon database
- Produkční Coda tabulky

### Produkční user sync z Edookit (závazné)

User sync běží přes endpoint:

- `POST /api/sync/users`
- autorizace: `Authorization: Bearer ${USER_SYNC_SECRET}`

Standardní provozní režim:

- **2x denně** v produkci (`app.svetoplavci.cz`)
- plánované časy: **11:00** a **23:00** (`Europe/Prague`)
- payload:
  - `{"mode":"daily"}`

Kontrola posledních běhů:

- `GET /api/sync/users` se stejnou bearer autorizací
- výsledky se ukládají do tabulky `app_user_sync_run`

Aktuální produkční cron job (server `vps`, root crontab):

```cron
# Edookit -> PROD users sync (2x denne, Europe/Prague)
0 11,23 * * * /opt/prod/jobs/svetoplavci/sync_users_edookit_prod.sh >> /var/log/prod-sync/user-sync-edookit.log 2>&1 # svetoplavci-user-sync-edookit
```

Skript `/opt/prod/jobs/svetoplavci/sync_users_edookit_prod.sh`:

- najde běžící produkční kontejner image `ghcr.io/mparvonic/svetoplavci-app:latest`,
- použije `USER_SYNC_SECRET` z prostředí kontejneru,
- zavolá `POST http://127.0.0.1:3000/api/sync/users` s payloadem `{"mode":"daily"}`.

Doporučené guardrails:

- `USER_SYNC_SECRET` jen v secrets (nikdy v repozitáři)
- při non-2xx odpovědi job failne a pošle alert
- 1x denně ověřit, že poslední úspěšný běh není starší než 18 hodin

### Databázové prostředí (závazné)

- **`svetoplavci`** = produkční DB (ostrý provoz).
- **`svetoplavci_test`** = test/staging DB (věrná kopie produkce, bez anonymizace; stejné bezpečnostní zacházení jako produkce).
- **`svetoplavci_dev`** = vývojová DB (kopie produkce po anonymizační transformaci).

Detaily postupu refresh/anonymizace jsou v:

- `docs/dev-database-refresh.md`
- `docs/schema-rollout.md`

---

## Branch Protection (GitHub)

Nastavení pro budoucí konzistenci:

### `main`

- Zakázat direct push.
- Povolit pouze merge přes Pull Request.
- Vyžadovat úspěšné CI checky před merge.
- Vyžadovat aktuální větev (`Require branches to be up to date`).
- Doporučeno: minimálně 1 review před merge.
- V `Require status checks` vybrat check **`PR checks / build`**.

### `staging`

- Zakázat direct push (výjimky jen pro vlastníka repozitáře, pokud jsou potřeba).
- Povolit merge pouze přes Pull Request z `feature/*` / `fix/*`.
- Vyžadovat úspěšné CI checky.
- V `Require status checks` vybrat check **`PR checks / build`**.

### Správa větví

- Pravidelně mazat merge-nuté feature/fix větve.
- Udržovat `staging` jako jediný zdroj pro release do `main`.
- Pokud vznikne divergence mezi `main` a `staging`, řešit ji standardně přes PR `staging -> main`.

---

## Správa dat pro staging

Auth data (uživatelé, sessions) jsou v **Neon PostgreSQL**. Coda data jsou read-only.

### Neon database branching

Neon podporuje větvení databáze — staging větev je okamžitá kopie produkčních dat:

1. Přihlas se na [neon.tech](https://neon.tech)
2. Vyber projekt → záložka **Branches**
3. Klikni **New Branch** → pojmenuj `staging` → vyberte source branch `main`
4. Zkopíruj connection string pro staging větev
5. Nastav ho jako `POSTGRES_PRISMA_URL` v Coolify staging aplikaci

**Jednosměrná aktualizace dat:**
Kdykoli chceš mít na staging čerstvá produkční data (např. před větším testem):
1. V Neon konzoli smaž staging větev
2. Vytvoř novou `staging` větev ze `main` — získáš čerstvou kopii
3. Connection string zůstane stejný (stačí přepsat existující větev)

---

## Nastavení staging v Coolify

1. Coolify → **New Resource** → **Docker Image**
2. Image: `ghcr.io/mparvonic/svetoplavci-app:staging`
3. Domain: `app-test.svetoplavci.cz`
4. Environment variables: stejné jako produkce, jen s jiným `POSTGRES_PRISMA_URL` (Neon staging branch)
5. Nastav **Webhook** pro automatický redeploy při novém `:staging` tagu

---

## Přístupová pravidla podle prostředí

### Produkce (`app.svetoplavci.cz`)

- Žádný auth bypass.
- Přístup pouze přes standardní přihlášení.
- Žádné testovací zkratky ani přepínače uživatele.

### Staging (`app-test.svetoplavci.cz`)

- Žádný auth bypass.
- Přístup jen pro role `tester` nebo `admin`.
- Volitelně lze přidat e-mail whitelist přes env proměnnou:
  - `STAGING_ALLOWED_EMAILS=email1@domena.cz,email2@domena.cz`
- Whitelist slouží jen jako výjimka pro vstup na staging (např. externí tester bez role).

### Lokální vývoj (`localhost`, `127.0.0.1`)

- Auth bypass je povolen pouze lokálně.
- Bypass se řídí:
  - `AUTH_BYPASS=1` => vždy zapnuto
  - `AUTH_BYPASS=0` => vždy vypnuto
  - bez hodnoty => zapnuto jen při `NODE_ENV=development`
- Lokální přepínač uživatele je určen pouze pro dev scénáře a simulaci rolí.

### Důležité bezpečnostní pravidlo

- I když je `AUTH_BYPASS=1`, bypass se nikdy nepovolí na produkční ani staging doméně.
- Rozhoduje host aplikace; bypass je technicky omezen na lokální hosty.
- Pokusy o obcházení (bypass mimo local, zamítnutý vstup na staging) se logují jako security eventy.

### Admin role a osobní data (závazné)

- Role `admin` je určena pro správu systému (uživatelé/role/konfigurace), ne pro automatické čtení osobních dat žáků a zaměstnanců.
- Přístupy k osobním datům jsou vynucené přes role matrix; `admin` není v běžných osobních data guardech.
- Podpora se řeší primárně přes metadata a logy, ne přes „nahlížení do cizího účtu“.
- Přihlašování pod cizím účtem není povoleno.

### Support workflow

- Uživatel hlásí problém přes `POST /api/support/tickets`.
- Endpoint ukládá auditní metadata do security logu:
  - kdo hlásil,
  - kde problém vznikl,
  - identifikátor ticketu,
  - hash popisu (bez ukládání citlivého obsahu do logu).
- Administrátor řeší incident primárně podle ticket ID, request ID a systémových logů.

### Break-glass workflow

- Endpoint `POST /api/internal/support/break-glass-request` slouží pro auditní záznam žádosti o mimořádný přístup.
- Každá žádost musí obsahovat explicitní důvod a cíl.
- Stav žádosti je `pending_manual_dual_approval` (schválení dvěma osobami mimo aplikaci).
- Každý požadavek je logovaný jako security event.

### Interní security health endpoint

- Endpoint: `GET /api/internal/security-health`
- Přístup:
  - přihlášený uživatel s rolí `admin`, nebo
  - `Authorization: Bearer <INTERNAL_SECURITY_HEALTH_TOKEN>`
- Doporučení: token nastavovat jen v interním monitoringu, ne v klientské aplikaci.

### Centrální role matrix

- Oprávnění pro route jsou centralizovaná v `src/lib/access-matrix.ts`.
- Nové chráněné route přidávat do role matrix (ne přes ad-hoc podmínky v jednotlivých souborech).
- `middleware.ts` používá role matrix pro app i API route.
- API route, které používají `getApiSessionContext(req)`, navíc aplikují host-based guard (staging gate + fail-closed při nebezpečné bypass konfiguraci).

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
- Dashboard stránky: `app-page-container` (globální kontejner v `app/globals.css`, základ 1180 px a dynamicky až 1440 px)
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

- [ ] Featura otestována na staging (`app-test.svetoplavci.cz`)
- [ ] Přihlášení funguje (Google + magic link)
- [ ] Data se načítají správně
- [ ] Mobil: responzivita OK
- [ ] Žádné console errory v prohlížeči
- [ ] `npm run ci:security` prochází
- [ ] Staging gate aktivní (přístup jen tester/admin + případný whitelist)
- [ ] Produkční/staging bypass deaktivovaný (ověřeno přes `/api/internal/security-health`)
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
Testování (app-test.svetoplavci.cz, kopie prod dat)
  │  "Vše funguje?"
  ▼
PR: staging → main
  │
  ▼
Produkce (app.svetoplavci.cz) ✓
```

---

## Odložený plán: Admin/Support bezpečnost

Následující body jsou odsouhlasené jako další etapa a mají se realizovat později:

- [ ] **Support ticket provozní workflow**
  - definovat ownera, SLA, nástroj (Jira/Linear/Notion) a mapování `ticketId`.
- [ ] **Centralizace bezpečnostních logů**
  - napojit `support_ticket_created` a `break_glass_requested` na centrální log storage + alerting.
- [ ] **Schvalovací vrstva pro break-glass**
  - zavést 2-person approval, expiraci, read-only scope a možnost revokace.
- [ ] **Support impersonation session (bez loginu cizím účtem)**
  - read-only režim, maskování citlivých polí, krátká expirace, plný audit.
- [ ] **Repo governance bez bypassu**
  - v GitHub branch protection odebrat bypass pro `staging` a `main`.
- [ ] **Role regression smoke test**
  - ověřit přístupové scénáře pro role `admin`, `tester`, `rodic`, `zak`, `pruvodce`.
- [ ] **Produkční rollout**
  - po release `staging -> main` ověřit `/api/internal/security-health` na produkci.
