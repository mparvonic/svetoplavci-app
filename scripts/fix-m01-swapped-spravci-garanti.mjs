#!/usr/bin/env node

import { Client } from "pg";

const APPLY = process.argv.includes("--apply");
const ROLE_SOURCE = "m01_lodicky_assignment";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run m01:fix-swapped-people -- [--apply]

Without --apply the script runs the full correction in a transaction and rolls it back.
With --apply it commits the correction:
- app_m01_lodicka.garant_person_id -> app_m01_oblast_spravce
- app_m01_lodicka_garant -> app_m01_lodicka_stav_garant
- derived spravce_lodicek/garant roles are recalculated from canonical assignments
`);
  process.exit(0);
}

const connectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[m01:fix-swapped-people] POSTGRES_PRISMA_URL or DATABASE_URL is not set.");
  process.exit(1);
}

function printResult(label, rows) {
  console.log(`[m01:fix-swapped-people] ${label}`);
  for (const row of rows) console.log(JSON.stringify(row));
}

async function countSnapshot(client) {
  const { rows } = await client.query(`
    SELECT
      (SELECT count(*)::int FROM app_m01_lodicka WHERE is_deleted = false) AS active_lodicky,
      (SELECT count(*)::int FROM app_m01_lodicka WHERE is_deleted = false AND garant_person_id IS NOT NULL) AS lodicky_with_legacy_person,
      (SELECT count(*)::int FROM app_m01_lodicka_garant) AS legacy_lodicka_garant_rows,
      (SELECT count(*)::int FROM app_m01_lodicka_stav_garant) AS stav_garant_rows,
      (SELECT count(*)::int FROM app_m01_oblast_spravce) AS oblast_spravce_rows,
      (
        SELECT count(*)::int
        FROM app_role_assignment
        WHERE role = 'garant'
          AND is_active = true
      ) AS active_garant_roles,
      (
        SELECT count(*)::int
        FROM app_role_assignment
        WHERE role = 'spravce_lodicek'
          AND is_active = true
      ) AS active_spravce_lodicek_roles
  `);
  return rows;
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('m01_fix_swapped_spravci_garanti'))");

    printResult("before", await countSnapshot(client));

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_m01_lodicka_garant_person_swap_backup (
        lodicka_id TEXT PRIMARY KEY REFERENCES app_m01_lodicka(id) ON DELETE CASCADE,
        person_id TEXT NOT NULL REFERENCES app_person(id) ON DELETE RESTRICT,
        captured_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      INSERT INTO app_m01_lodicka_garant_person_swap_backup (lodicka_id, person_id)
      SELECT id, garant_person_id
      FROM app_m01_lodicka
      WHERE garant_person_id IS NOT NULL
      ON CONFLICT (lodicka_id) DO NOTHING
    `);

    await client.query("DELETE FROM app_m01_oblast_spravce");
    await client.query(`
      WITH manager_candidates AS (
        SELECT
          l.oblast_id,
          backup.person_id,
          count(*)::int AS lodicky_count,
          min(l.kod) AS first_lodicka_code
        FROM app_m01_lodicka_garant_person_swap_backup backup
        JOIN app_m01_lodicka l ON l.id = backup.lodicka_id
        JOIN app_m01_oblast o ON o.id = l.oblast_id AND o.is_active = true
        WHERE l.is_deleted = false
        GROUP BY l.oblast_id, backup.person_id
      ),
      ranked AS (
        SELECT
          oblast_id,
          person_id,
          row_number() OVER (
            PARTITION BY oblast_id
            ORDER BY lodicky_count DESC, first_lodicka_code ASC, person_id ASC
          ) AS rn
        FROM manager_candidates
      )
      INSERT INTO app_m01_oblast_spravce (id, oblast_id, person_id, is_primary, created_at)
      SELECT
        'm01-oblast-spravce-fix-' || md5(oblast_id || ':' || person_id),
        oblast_id,
        person_id,
        false,
        now()
      FROM ranked
      ON CONFLICT (oblast_id, person_id) DO UPDATE
      SET is_primary = false
    `);

    await client.query("DELETE FROM app_m01_lodicka_stav_garant");
    await client.query(`
      INSERT INTO app_m01_lodicka_stav_garant (id, lodicka_id, person_id, is_primary, created_at)
      SELECT
        'm01-lodicka-stav-garant-fix-' || md5(lg.lodicka_id || ':' || lg.person_id),
        lg.lodicka_id,
        lg.person_id,
        false,
        now()
      FROM app_m01_lodicka_garant lg
      JOIN app_m01_lodicka l ON l.id = lg.lodicka_id
      WHERE l.is_deleted = false
      ON CONFLICT (lodicka_id, person_id) DO UPDATE
      SET is_primary = false
    `);

    await client.query(`
      UPDATE app_m01_lodicka_stav_garant
      SET is_primary = false
    `);

    await client.query(
      `
      UPDATE app_role_assignment
      SET
        is_active = false,
        valid_to = now(),
        updated_at = now()
      WHERE role IN ('spravce_lodicek', 'garant')
        AND is_active = true
    `,
    );

    await client.query(
      `
      WITH desired AS (
        SELECT DISTINCT os.person_id
        FROM app_m01_oblast_spravce os
        JOIN app_person p ON p.id = os.person_id AND p.is_active = true
        WHERE EXISTS (
          SELECT 1
          FROM app_role_assignment pruvodce_role
          WHERE pruvodce_role.person_id = os.person_id
            AND pruvodce_role.role = 'pruvodce'
            AND pruvodce_role.is_active = true
        )
      )
      INSERT INTO app_role_assignment (
        id, person_id, role, source, is_active, valid_from, valid_to, created_at, updated_at
      )
      SELECT
        'role-m01-spravce-lodicek-' || md5(person_id),
        person_id,
        'spravce_lodicek',
        $1,
        true,
        now(),
        NULL,
        now(),
        now()
      FROM desired
      ON CONFLICT (person_id, role, source) DO UPDATE
      SET
        is_active = true,
        valid_from = now(),
        valid_to = NULL,
        updated_at = now()
    `,
      [ROLE_SOURCE],
    );

    await client.query(
      `
      WITH desired AS (
        SELECT DISTINCT sg.person_id
        FROM app_m01_lodicka_stav_garant sg
        JOIN app_m01_lodicka l ON l.id = sg.lodicka_id AND l.is_deleted = false
        JOIN app_person p ON p.id = sg.person_id AND p.is_active = true
        WHERE EXISTS (
          SELECT 1
          FROM app_role_assignment pruvodce_role
          WHERE pruvodce_role.person_id = sg.person_id
            AND pruvodce_role.role = 'pruvodce'
            AND pruvodce_role.is_active = true
        )
      )
      INSERT INTO app_role_assignment (
        id, person_id, role, source, is_active, valid_from, valid_to, created_at, updated_at
      )
      SELECT
        'role-m01-garant-' || md5(person_id),
        person_id,
        'garant',
        $1,
        true,
        now(),
        NULL,
        now(),
        now()
      FROM desired
      ON CONFLICT (person_id, role, source) DO UPDATE
      SET
        is_active = true,
        valid_from = now(),
        valid_to = NULL,
        updated_at = now()
    `,
      [ROLE_SOURCE],
    );

    printResult(APPLY ? "after" : "planned-after", await countSnapshot(client));

    if (APPLY) {
      await client.query("COMMIT");
      console.log("[m01:fix-swapped-people] committed");
    } else {
      await client.query("ROLLBACK");
      console.log("[m01:fix-swapped-people] dry run only; pass --apply to write changes");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[m01:fix-swapped-people] failed");
  console.error(error);
  process.exit(1);
});
