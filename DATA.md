# DATA

## Data Roots

Source repository:

```text
/srv/projects/svetoplavci-app
```

GX10 runtime and operational roots:

```text
/data/projects/svetoplavci-app/artifacts
/data/projects/svetoplavci-app/secrets
/data/backups/svetoplavci/postgres
/data/tmp/svetoplavci
```

Production runtime remains on the VPS/Coolify host unless explicitly migrated:

```text
host: vps
postgres container: svetoplavci-app-postgres
production database: svetoplavci
```

## Source Data

- PostgreSQL production database on VPS.
- Historical Coda-derived metadata and snapshots may be kept in PostgreSQL or reports for audit, but the application must not use Coda as a runtime data source.
- Application source and Prisma migrations in Git.

## Backups

Logical production DB backups are staged on GX10:

```text
/data/backups/svetoplavci/postgres
```

Each backup run should create:

- `svetoplavci_<timestamp>.dump`
- `svetoplavci_<timestamp>.dump.list`
- `manifest.json`

Restore drill reports live under:

```text
/data/projects/svetoplavci-app/artifacts/restore-drills
```

## Sensitive Data

- Production and staging database data are sensitive.
- `.env*` files and backup connection details must stay outside Git.
- Do not print secret values into docs, logs or task output.
- Personal lodičky status history is production data and must be protected by backup and restore verification.

## Retention

Initial logical backup retention:

- keep daily backups for 14 days,
- keep weekly backups for 8 weeks,
- keep manually marked milestone backups before risky migrations.

Future PITR phase should evaluate `pgBackRest` or `WAL-G` with base backups and WAL archiving.
