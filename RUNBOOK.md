# RUNBOOK

## Project Location

Canonical GX10 source checkout:

```bash
cd /srv/projects/svetoplavci-app
```

Runtime data, secrets and backups stay outside the source tree:

```text
/data/projects/svetoplavci-app
/data/backups/svetoplavci/postgres
```

Runtime env file for DB-backed commands on GX10:

```text
/data/projects/svetoplavci-app/secrets/env.local
```

Do not print or commit this file. Source it only when a command needs database/runtime variables. Project DB npm scripts use `scripts/with-runtime-env.sh`, which loads repo `.env.local` first and falls back to this GX10 path.

## Local Verification

```bash
npm ci
npx prisma validate
npm run build
```

DB-backed checks require access to the target database environment:

```bash
set -a; . /data/projects/svetoplavci-app/secrets/env.local; set +a
npm run db:check:schema
npx prisma migrate status
```

## Production DB Backup

Manual backup from GX10:

```bash
/srv/projects/svetoplavci-app/ops/scripts/backup_postgres_gx10.sh
```

Default source:

```text
vps -> docker container svetoplavci-app-postgres -> database svetoplavci
```

Backup output:

```text
/data/backups/svetoplavci/postgres/<timestamp>/
```

## Restore Drill

Manual restore drill from GX10:

```bash
/srv/projects/svetoplavci-app/ops/scripts/restore_drill_postgres_gx10.sh
```

The drill restores the latest dump into a temporary local Postgres container on GX10, runs basic verification queries, writes a report, and removes the temporary container.

## Timers

GX10 user systemd units:

```bash
systemctl --user status svetoplavci-db-backup-gx10.timer
systemctl --user status svetoplavci-db-restore-drill-gx10.timer
systemctl --user list-timers --all 'svetoplavci-*'
```

## Common Failures

- SSH to `vps` fails from GX10: check GX10 SSH config and WireGuard/VPN reachability.
- `docker exec svetoplavci-app-postgres` fails on VPS: check production Postgres container name.
- Restore drill cannot start container: check GX10 Docker availability and free disk under `/data/tmp`.
- Backup exists but `.dump.list` is missing: treat the backup as incomplete until `pg_restore -l` succeeds.

## Recovery Outline

1. Select a verified backup directory.
2. Restore into an isolated PostgreSQL container or database first.
3. Run verification queries and application smoke checks.
4. Only after human approval, promote the restored DB to a runtime target.
