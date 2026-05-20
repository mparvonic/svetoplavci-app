# AGENTS.md

This file provides guidance to Codex when working with this repository.

## Commands

```bash
npm run dev        # Start development server with Turbopack (localhost:3000)
npm run dev:up     # Preferred Codex local startup: env + deps + DB tunnel + Next dev
npm run dev:down   # Stop the background Next dev server started by dev:up
npm run ops:doctor # Diagnose mount, env, SSH, DB tunnel, Next dev, and git state
npm run release:test -- --message "fix: summary" # Commit/push toward staging/test
npm run release:prod                             # Open/reuse staging -> main production PR
npm run prod:db:doctor                           # Verify production DB read-only access via GX10/VPS
npm run prod:db:sql -- "select count(*) from app_person" # One-off read-only production SQL
npm run prod:db:node -- --input-type=module      # One-off read-only production Node script from stdin
npm run build      # prisma generate + next build
npm run lint       # Run ESLint
npm run db:check:schema
npm run m01:lodicky:dry-run
```

No test suite is configured.

## Architecture

This is a **Next.js App Router portal** for Světoplavci.

### Data sources

- **PostgreSQL + Prisma** is the runtime source of truth for application data.
- **Coda is historical only.** The application must not call Coda as a runtime source for auth, UI data, authorization, or writes.
- Historical Coda ids/snapshots/reports may be retained only for audit and migration verification.

Never introduce a new runtime dependency on Coda.

### Authentication

Dual providers via Auth.js:

1. Google OAuth
2. Email magic link via Nodemailer

Both providers resolve access through the internal user directory model:

- `AppLoginIdentity`
- `AppLoginPersonLink`
- `AppRoleAssignment`
- `AppPerson`

Legacy Coda-based auth lookup is obsolete and must not be reintroduced.

### Authorization flow

Protected routes use session roles from the internal DB-backed login profile. Child access is verified through internal person relations and role context, not through Coda.

### M01 lodičky

M01 runs on internal PostgreSQL tables:

- `M01RvpVersion`
- `M01SvpVersion`
- `M01Lodicka`
- `M01LodickaOvuLink`
- `M01OsobniSadaLodicek`
- `M01OsobniLodicka`
- `M01OsobniLodickaEvent`

`M01SvpVersion` is the lodičky set/catalog version. It stores validity, status, and the RVP binding.

Current role meanings:

- `garant`: can change personal lodička status.
- `spravce_lodicek`: manages assigned catalog lodičky, including title, description, grades, and OVU/RVP binding.
- `spravce_flotily`: manages the whole lodičky set/fleet, validity, RVP binding, and lodička managers.

Správa lodiček is a portal workflow under `/portal/lodicky/sprava`, not an admin panel.

### Route groups

- `app/(dashboard)/portal/` - user-facing portal views.
- `app/(dashboard)/portal/lodicky/` - M01 lodičky views.
- `app/(dashboard)/portal/lodicky/sprava/` - lodičky management by role.
- `app/(dashboard)/admin/` - system/admin workflows.
- `app/auth/` - sign-in and Auth.js pages.
- `app/kiosk/` - public kiosk pages.
- `app/api/` - API routes.

### UI conventions

- Tables: use shadcn/ui `<Table>`.
- Tabs: use shadcn/ui `<Tabs>`.
- Cards: use `<Card>` with `<CardHeader>` and `<CardContent>`.
- Icons: Lucide React only.
- Section headings: `text-[#002060] font-semibold`.
- Page container: `max-w-screen-xl mx-auto px-4`.
- Primary buttons: `bg-[#002060] text-white hover:bg-[#001540]`.
- Danger/accent: `text-[#DA0100]` or `bg-[#DA0100]`.

### Environments

- Codex normally runs on Miroslav's Mac against the GX10 NFS mount at `/Users/miroslav/Projects/gx10/srv/projects/svetoplavci-app`; the canonical GX10 path is `/srv/projects/svetoplavci-app`.
- Do not rediscover local startup manually. First run `npm run ops:doctor`; start local work with `npm run dev:up`.
- GX10 runtime env file lives outside the repo at `/data/projects/svetoplavci-app/secrets/env.local`. From the Mac mount the same secret path is `/Users/miroslav/Projects/gx10/data/projects/svetoplavci-app/secrets/env.local`. Source it for DB-backed commands when repo `.env.local` is absent; never print or commit its contents.
- Release/deploy automation is scripted. Use `npm run release:test -- --message "..."` for test/staging and `npm run release:prod` for production promotion. Do not hand-roll branch pushes unless the scripts are broken.
- Production DB read-only access is scripted. Use `npm run prod:db:doctor`, `npm run prod:db:sql`, or `npm run prod:db:node`; do not source `/data/projects/svetoplavci-app/secrets/env.local` for production reads because that file may point at `svetoplavci_dev`.
- `main` branch -> production (`app.svetoplavci.cz`)
- `staging` branch -> staging/test (`test-app.svetoplavci.cz`)
- Feature development on feature branches, PR into `staging` first.

Full workflow: `docs/development-workflow.md`.
Local Codex automation: `docs/07-operations/runbooks/local-codex-automation.md`.
