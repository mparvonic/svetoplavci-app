# Svetoplavci DB Backup Runbook

Status: initial-logical-backup
Owner: miroslav

## Current Strategy

Use GX10 as the backup host and the VPS/Coolify PostgreSQL container as the source.

Initial phase:

- nightly logical `pg_dump --format=custom`,
- local validation with `pg_restore -l`,
- regular restore drill into a temporary Postgres container,
- backup manifests and restore reports under `/data`.

Future phase:

- evaluate `pgBackRest` or `WAL-G`,
- add base backups and WAL archiving,
- support point-in-time recovery.

## Future PITR Plan

This section records the planned target state. It is not implemented yet.

Target:

- GX10 remains the backup server.
- Production PostgreSQL on VPS/Coolify remains the backup source.
- Backup tooling is migrated from the current custom `pg_dump` script to either `pgBackRest` or `WAL-G`.
- Base backups run daily or weekly, depending on final storage and restore-time tradeoffs.
- WAL archiving runs continuously or every few minutes.
- Retention keeps the equivalent of 14 daily and 8 weekly recovery points.
- Restore drills continue to restore into a temporary isolated DB/container on GX10.

Implementation gates:

- Pick `pgBackRest` or `WAL-G` after checking Coolify container access, PostgreSQL configuration control, credentials, and GX10 restore workflow.
- Configure WAL archiving from production to GX10 without storing secrets in `/srv/projects`.
- Add automated retention cleanup.
- Run a manual point-in-time restore rehearsal before declaring PITR operational.
- Update this runbook with the final restore command sequence.

Current non-goals:

- Do not restore directly into production during drills.
- Do not store backup payloads, WAL archives, generated reports, or secrets in `/srv/projects`.
- Do not mark PITR as operational until timestamp recovery has been tested.

## Paths

```text
Source checkout:        /srv/projects/svetoplavci-app
Backup root:            /data/backups/svetoplavci/postgres
Restore drill reports:  /data/projects/svetoplavci-app/artifacts/restore-drills
Temporary restore root: /data/tmp/svetoplavci
Secrets root:           /data/projects/svetoplavci-app/secrets
```

## Commands

Create a backup:

```bash
/srv/projects/svetoplavci-app/ops/scripts/backup_postgres_gx10.sh
```

Run restore drill:

```bash
/srv/projects/svetoplavci-app/ops/scripts/restore_drill_postgres_gx10.sh
```

Check timers:

```bash
systemctl --user list-timers --all 'svetoplavci-*'
```

## Acceptance Criteria

- Backup file exists and is non-empty.
- `pg_restore -l` succeeds and writes a `.dump.list`.
- Manifest records source, timestamp, size and validation status.
- Restore drill can restore the latest backup into an isolated container.
- Restore drill verifies the restored DB contains M01 personal lodičky tables.

## Restore Safety

Never restore directly over production as the first step. Restore into an isolated database/container, verify, then promote only after explicit human approval.
