# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server with Turbopack (localhost:3000)
npm run build      # prisma generate + prisma db push + next build
npm run lint       # Run ESLint
npm run coda:columns  # List all Coda table columns (useful for debugging Coda integration)
```

No test suite is configured.

## Architecture

This is a **Next.js (App Router) parent portal** for a sailing school. The Czech UI serves parents who can view their children's progress stored in Coda.

### Data sources

- **Coda API** — the primary source for all school data: children, grades, milestones, evaluations. Accessed via `src/lib/coda.ts`.
- **PostgreSQL (Neon) + Prisma** — stores *only* auth metadata: users, accounts, sessions, verification tokens. Schema in `prisma/schema.prisma`.

These two data sources are kept strictly separate. Never persist school data to Postgres.

### Authentication

Dual providers via Auth.js v5:
1. **Google OAuth** — social login
2. **Email magic link** — Nodemailer (passwordless)

Both providers verify the user's role by looking them up in the Coda "Seznam osob" table at sign-in time. The role (`parent`/`admin`) and Czech name (`jmeno`) are stored in the JWT. Config split:
- `src/lib/auth.config.ts` — edge-compatible callbacks (used by middleware)
- `src/lib/auth.ts` — full config with Prisma adapter and Nodemailer

### Authorization flow

`middleware.ts` protects all routes under `/(dashboard)`. Inside route handlers and server components:
1. Get session → verify role
2. Look up parent in Coda by email to get their `parentId`
3. Verify the requested child belongs to that parent before returning data

Child data is never returned without this ownership check.

### API proxy pattern

Frontend calls Next.js API routes under `/api/coda/child/[childId]/`. These routes:
1. Verify the session
2. Look up the parent in Coda
3. Fetch the child's specific table data from Coda
4. Return filtered JSON

There is an in-memory cache (5-minute TTL) for Coda responses in `src/lib/coda.ts`. Set `AUTH_DEBUG=1` to bypass caching.

### Route groups

- `app/(dashboard)/portal/` — parent-facing views, including `dite/[childId]/` with tabbed child detail pages
- `app/(dashboard)/admin/` — admin panel
- `app/auth/` — sign-in, magic link verification, error pages
- `app/kiosk/` — public kiosk pages (no auth required)
- `app/api/` — API routes

### Key Coda table IDs

Configured via environment variables (see `.env.local`):

| Env var | Content |
|---|---|
| `CODA_TABLE_SEZNAM_OSOB` | Person list — parents and children |
| `CODA_TABLE_LODICKY` | Child's sailboat progress |
| `CODA_TABLE_LODICKY_AFTER` | Sailboat progress per voyage |
| `CODA_TABLE_HODNOCENI_PRED` | Subject grades |
| `CODA_TABLE_HODNOCENI_OBL` | Area evaluations |

### UI

- **Tailwind CSS v4** + **shadcn/ui** (New York style) + **Radix UI** + **Lucide React**
- Brand colors: Blue `#002060`, Red `#DA0100`
- Auto-logout after 30 min inactivity via `components/inactivity-signout.tsx`

### UI conventions (enforce on every new component)

- Tables: always `<Table>` from shadcn/ui — never plain `<table>`
- Tabs: always `<Tabs>` from shadcn/ui
- Cards: `<Card>` with `<CardHeader>` + `<CardContent>`
- Icons: Lucide React only
- Section headings: `text-[#002060] font-semibold`
- Page container: `UI_CLASSES.pageContainer` (globálně `app-page-container`, baseline 1180 px, dynamicky až 1440 px)
- Primary buttons: `bg-[#002060] text-white hover:bg-[#001540]`
- Danger/accent: `text-[#DA0100]` or `bg-[#DA0100]`

### Environments

- `main` branch → production (`app.svetoplavci.cz`), Docker tag `:latest`
- `staging` branch → staging (`test-app.svetoplavci.cz`), Docker tag `:staging`
- Feature development on `feature/xxx` branches, PR into `staging` first
- Full workflow: `docs/development-workflow.md`

### Prototyping

- Prototype pages live in `app/(prototype)/` — excluded from production
- Mock data lives in `src/lib/mock/`
- When asked to prototype, use mock data and follow existing component patterns
