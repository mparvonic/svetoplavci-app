# STATUS

As of: 2026-05-14
Status: migration-to-gx10

## Summary

The project is being migrated from the Mac workspace to GX10 as a managed source repository under `/srv/projects/svetoplavci-app`, with operational PostgreSQL backups stored under `/data/backups/svetoplavci/postgres`.

## Done

- GX10 project and data-root conventions identified.
- Prisma schema and migration history aligned with the dev database.
- Initial GX10 project manifest, data document and runbook added.
- Logical DB backup and restore drill scripts prepared.

## In Progress

- Operate GX10 as the canonical project location after Mac workspace removal.
- Keep the current nightly logical DB backup and weekly restore drill running while the PITR backup phase is planned.

## Planned

### Production DB PITR Backups

Goal: evolve the current GX10 backup setup from nightly logical `pg_dump` backups into a point-in-time recovery setup for the production PostgreSQL database.

Target plan:

- GX10 remains the backup server.
- The production PostgreSQL database on VPS/Coolify remains the source.
- Choose either `pgBackRest` or `WAL-G` after validating fit with the current Coolify/Postgres container setup.
- Add base backups on a daily or weekly schedule.
- Add WAL archiving continuously or every few minutes.
- Enforce retention equivalent to 14 daily and 8 weekly recovery points.
- Keep regular restore drills into a temporary DB/container on GX10.

Acceptance criteria before marking this complete:

- Base backup is created and verified on GX10.
- WAL archive is continuous enough to support point-in-time recovery.
- Retention is automated and documented.
- Restore drill proves the backup can be restored into an isolated DB.
- A timestamp-based recovery rehearsal succeeds without touching production.

## Risks

- The current Mac worktree contains uncommitted changes and untracked files; the transfer must preserve them before local deletion.
- Production DB backup protects data, but PITR/WAL archiving is still a later phase.
- Existing tracked `env copy.local` may contain sensitive values and should be reviewed separately.
