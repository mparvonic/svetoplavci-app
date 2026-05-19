# Production DB Read-Only Access

Agents must not rediscover the production database path manually.

Use these commands:

```bash
npm run prod:db:doctor
npm run prod:db:sql -- "select current_database()"
npm run prod:db:node -- --input-type=module <<'NODE'
import { Client } from "pg";
const client = new Client({ connectionString: process.env.PROD_DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query("select current_database() as db");
  console.log(rows);
} finally {
  await client.end();
}
NODE
```

When run from the Mac GX10 mount, `prod-db-readonly.sh` re-executes on GX10 in `/srv/projects/svetoplavci-app`.

The script deliberately does not use `/data/projects/svetoplavci-app/secrets/env.local` as proof of production. That file can point at `svetoplavci_dev`. Instead it:

1. finds the running production app container on `vps` from image `ghcr.io/mparvonic/svetoplavci-app:latest`,
2. reads the production DB URL from that container without printing it,
3. refuses to continue unless the database name is exactly `svetoplavci`,
4. opens a separate local tunnel on GX10, default `127.0.0.1:5544`,
5. injects `default_transaction_read_only=on`, timeouts, and `application_name=codex_prod_readonly`,
6. exposes the read-only URL to child Node scripts as `PROD_DATABASE_URL`, `POSTGRES_PRISMA_URL`, and `DATABASE_URL`.

`prod:db:sql` rejects obvious write/admin SQL keywords before connecting. `prod:db:node` is for one-off scripts that need repo assets or generated output files, for example writing PDFs under `tmp/generated-maps/prod/`.

Do not print connection strings. Do not commit generated production outputs unless explicitly requested.
