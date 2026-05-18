# Architektura aplikace

## Přehled

- **Framework:** Next.js App Router.
- **Jazyk:** TypeScript.
- **UI knihovna:** shadcn/ui + Tailwind CSS, barvy modrá `#002060` a červená `#DA0100`.
- **Autentizace:** Auth.js / NextAuth, Google OAuth + e-mailový magic link.
- **Datové úložiště aplikace:** PostgreSQL + Prisma.
- **Historický zdroj:** Coda je pouze archivní/migrační stopa. Runtime aplikace nesmí pro rozhodování ani zobrazení číst z Coda API.

## Zdroje pravdy

PostgreSQL je zdroj pravdy pro provozní data aplikace:

- osoby, login identity, rodinné vazby, role a školní členství,
- M01 RVP/ŠVP/lodičky, osobní sady lodiček a historie stavů,
- M03 Ostrovy a návazné školní události,
- auditní a provozní metadata.

Coda metadata se mohou uchovávat pouze kvůli zpětnému ověření migrace, například jako `source_coda_row_id`, `source_ref`, raw snapshot nebo importní report. Nový aplikační tok nesmí být navržený tak, že se obrací na Coda jako na živý zdroj.

## Vrstevnaté členění

1. **Frontend**
   - `/portal/lodicky` - osobní lodičky a role-dependent pohledy.
   - `/portal/lodicky/sprava` - správa sad/katalogu lodiček podle role.
   - `/portal/dite/[childId]` - starší detail dítěte, postupně nahrazovaný M01/M03 pohledy.
   - `/admin/*` - systémová a provozní správa, nikoli běžná správa lodiček.

2. **API vrstva**
   - `/api/m01/*` - lodičky, osobní sady, zápis stavů a role-dependent čtení.
   - `/api/ostrovy/*` - Ostrovy a přihlášky.
   - `/api/admin/*` - systémová správa osob, vazeb, synců a provozních akcí.
   - `/api/coda/*` je relikt staršího portálu; nové funkcionality ho nesmí používat.

3. **Datová vrstva**
   - Prisma schema v `prisma/schema.prisma`.
   - Doménové helpery a servisní funkce v `src/lib`.
   - M01 model odděluje katalogové lodičky (`app_m01_lodicka`) od osobních lodiček žáků (`app_m01_osobni_lodicka`) a append-only historie (`app_m01_osobni_lodicka_event`).

4. **Auth vrstva**
   - Auth.js providers jsou v `src/lib/auth.ts` a `src/lib/auth.config.ts`.
   - Oprávnění se odvozují z interního user directory modelu (`AppLoginIdentity`, `AppLoginPersonLink`, `AppRoleAssignment`).
   - Ověření přes Coda se nepoužívá.

## M01 Lodičky

Sada lodiček je modelovaná jako `M01SvpVersion`. Určuje:

- verzi a stav sady (`DRAFT`, `APPROVED`, `ACTIVE`, `ARCHIVED`),
- platnost (`effective_from`, `effective_to`),
- vazbu na RVP (`based_on_rvp_version_id`),
- vazbu na předchozí sadu (`parent_svp_version_id`).

Jednotlivé lodičky patří do konkrétní sady přes `svp_version_id`. Vazby na RVP/OVU jsou uloženy přes `app_m01_lodicka_ovu_link`.

## Role v M01

- `garant` - osoba oprávněná měnit stav osobních lodiček.
- `spravce_lodicek` - spravuje přidělené katalogové lodičky, včetně názvu, popisu, ročníku a vazby na OVU/RVP.
- `spravce_flotily` - spravuje celou sadu lodiček, platnost sady, vazbu na RVP a správce lodiček.

Správa lodiček je portálový workflow, ne administrace v `/admin`.
