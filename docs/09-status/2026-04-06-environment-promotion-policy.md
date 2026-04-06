# 2026-04-06 Environment promotion policy

## Co bylo zavedeno

- Technický standard pro agenty: `docs/05-delivery/environment-promotion-policy.md`.
- Povinná šablona promotion záznamu: `docs/10-templates/promotion-record-template.md`.
- Složka pro promotion evidenci: `docs/09-status/promotions/`.
- CI enforcement workflow: `.github/workflows/policy-guard.yml`.
- Enforce skript: `scripts/policy/enforce-promotion-policy.mjs`.
- Agent contract doplněn v `AGENTS.md`.
- DEV DB runbook: `docs/07-operations/runbooks/dev-db-branching-runbook.md`.
- DEV DB guard skript: `scripts/db/assert-safe-local-db.mjs`.
- Neon DEV branch skript: `scripts/db/neon-dev-branches.mjs`.
- CI workflow pro DEV DB guard: `.github/workflows/dev-db-safety.yml`.

## Co je nyní vynucováno

1. PR do `proto`, `staging`, `main` musí obsahovat update v `docs/09-status/`.
2. PR do `staging` a `main` musí obsahovat nový promotion record.
3. PR do `staging` a `main` nesmí měnit `app/(prototype)` ani `src/lib/mock`.
4. Mimo prototypové složky se blokují nové environment-based identifikátory v app/runtime kódu.
5. Blokuje se reference prototype route group z runtime souborů.
6. `npm run dev` je chráněn proti připojení na produkční DB URL.
7. CI ověřuje, že DB guard odmítá prod URL a propouští test URL.

## Další krok

Po schválení pravidel provést řízený přenos konkrétní obrazovky z `proto` do `staging` dle nové šablony promotion recordu.
