#!/usr/bin/env node

import { Client } from "pg";

const APPLY = process.argv.includes("--apply");
const databaseArg = process.argv.find((arg) => arg.startsWith("--database="));
const databaseName = databaseArg ? databaseArg.slice("--database=".length).trim() : "";
const stupenArg = process.argv.find((arg) => arg.startsWith("--stupen="));
const requestedStupen = (stupenArg ? stupenArg.slice("--stupen=".length).trim() : "II_STUPEN").toUpperCase();
const allowedStupne = new Set(["I_STUPEN", "II_STUPEN", "ALL"]);
const ROLE_SOURCE = "m01_lodicky_assignment";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run m01:fix-ii-stupen-people -- [--database=svetoplavci] [--stupen=I_STUPEN|II_STUPEN|ALL] [--apply]

Without --apply the script runs the correction in a transaction and rolls it back.
With --apply it commits the correction for the selected stupeň:
- app_m01_lodicka_garant remains the lodička manager assignment (old import "Garant")
- app_m01_lodicka_stav_garant is rebuilt from the current area people set
- app_m01_lodicka.garant_person_id is reset to the primary lodička manager
- derived spravce_lodicek/garant roles are recalculated from canonical assignments

Default --stupen is II_STUPEN for backward compatibility with the original repair.
`);
  process.exit(0);
}

if (!allowedStupne.has(requestedStupen)) {
  console.error("[m01:fix-stupen-people] --stupen must be I_STUPEN, II_STUPEN, or ALL.");
  process.exit(1);
}

const baseConnectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;
if (!baseConnectionString) {
  console.error("[m01:fix-stupen-people] POSTGRES_PRISMA_URL or DATABASE_URL is not set.");
  process.exit(1);
}

const targetLabel = requestedStupen === "ALL" ? "all-stupne" : requestedStupen.toLowerCase();
const logPrefix = `[m01:fix-stupen-people:${targetLabel}]`;

function connectionString() {
  if (!databaseName) return baseConnectionString;
  const url = new URL(baseConnectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function stupenWhere(alias = "l") {
  return requestedStupen === "ALL" ? "" : `AND ${alias}.stupen = '${requestedStupen}'`;
}

function printResult(label, rows) {
  console.log(`${logPrefix} ${label}`);
  for (const row of rows) console.log(JSON.stringify(row));
}

async function snapshot(client) {
  const { rows } = await client.query(`
    WITH target_lodicky AS (
      SELECT id, oblast_id, stupen
      FROM app_m01_lodicka l
      WHERE is_deleted = false
        ${stupenWhere("l")}
    ),
    desired_stav AS (
      SELECT DISTINCT l.id AS lodicka_id, os.person_id
      FROM target_lodicky l
      JOIN app_m01_oblast_spravce os ON os.oblast_id = l.oblast_id
    ),
    current_stav AS (
      SELECT sg.lodicka_id, sg.person_id
      FROM app_m01_lodicka_stav_garant sg
      JOIN target_lodicky l ON l.id = sg.lodicka_id
    ),
    current_spravci AS (
      SELECT lg.lodicka_id, lg.person_id
      FROM app_m01_lodicka_garant lg
      JOIN target_lodicky l ON l.id = lg.lodicka_id
    )
    SELECT
      l.stupen::text AS stupen,
      count(DISTINCT l.id)::int AS lodicky,
      count(DISTINCT (cs.lodicka_id, cs.person_id))::int AS spravce_rows,
      count(DISTINCT (current_stav.lodicka_id, current_stav.person_id))::int AS stav_garant_rows,
      count(DISTINCT (desired_stav.lodicka_id, desired_stav.person_id))::int AS desired_stav_garant_rows,
      (
        SELECT count(*)::int
        FROM (
          (
            SELECT desired.lodicka_id, desired.person_id
            FROM desired_stav desired
            JOIN target_lodicky scoped ON scoped.id = desired.lodicka_id
            WHERE scoped.stupen = l.stupen
            EXCEPT
            SELECT current.lodicka_id, current.person_id
            FROM current_stav current
            JOIN target_lodicky scoped ON scoped.id = current.lodicka_id
            WHERE scoped.stupen = l.stupen
          )
          UNION ALL
          (
            SELECT current.lodicka_id, current.person_id
            FROM current_stav current
            JOIN target_lodicky scoped ON scoped.id = current.lodicka_id
            WHERE scoped.stupen = l.stupen
            EXCEPT
            SELECT desired.lodicka_id, desired.person_id
            FROM desired_stav desired
            JOIN target_lodicky scoped ON scoped.id = desired.lodicka_id
            WHERE scoped.stupen = l.stupen
          )
        ) diff
      ) AS stav_garant_diff_rows,
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
    FROM target_lodicky l
    LEFT JOIN current_spravci cs ON cs.lodicka_id = l.id
    LEFT JOIN current_stav ON current_stav.lodicka_id = l.id
    LEFT JOIN desired_stav ON desired_stav.lodicka_id = l.id
    GROUP BY l.stupen
    ORDER BY l.stupen
  `);
  return rows;
}

async function recomputeDerivedRoles(client) {
  await client.query(`
    UPDATE app_role_assignment
    SET
      is_active = false,
      valid_to = now(),
      updated_at = now()
    WHERE role IN ('spravce_lodicek', 'garant')
      AND is_active = true
  `);

  await client.query(
    `
    WITH desired AS (
      SELECT DISTINCT person_id
      FROM (
        SELECT os.person_id
        FROM app_m01_oblast_spravce os
        JOIN app_m01_oblast o ON o.id = os.oblast_id AND o.is_active = true
        UNION
        SELECT lg.person_id
        FROM app_m01_lodicka_garant lg
        JOIN app_m01_lodicka l ON l.id = lg.lodicka_id AND l.is_deleted = false
      ) people
      JOIN app_person p ON p.id = people.person_id AND p.is_active = true
      WHERE EXISTS (
        SELECT 1
        FROM app_role_assignment pruvodce_role
        WHERE pruvodce_role.person_id = people.person_id
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
}

async function main() {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('m01_fix_stupen_people'))");

    printResult("before", await snapshot(client));

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_m01_stupen_stav_garant_fix_backup (
        lodicka_id TEXT NOT NULL REFERENCES app_m01_lodicka(id) ON DELETE CASCADE,
        person_id TEXT NOT NULL REFERENCES app_person(id) ON DELETE RESTRICT,
        is_primary BOOLEAN NOT NULL DEFAULT false,
        captured_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
        PRIMARY KEY (lodicka_id, person_id)
      )
    `);

    await client.query(`
      INSERT INTO app_m01_stupen_stav_garant_fix_backup (lodicka_id, person_id, is_primary)
      SELECT sg.lodicka_id, sg.person_id, sg.is_primary
      FROM app_m01_lodicka_stav_garant sg
      JOIN app_m01_lodicka l ON l.id = sg.lodicka_id
      WHERE l.is_deleted = false
        ${stupenWhere("l")}
      ON CONFLICT (lodicka_id, person_id) DO NOTHING
    `);

    await client.query(`
      DELETE FROM app_m01_lodicka_stav_garant sg
      USING app_m01_lodicka l
      WHERE l.id = sg.lodicka_id
        AND l.is_deleted = false
        ${stupenWhere("l")}
    `);

    await client.query(`
      INSERT INTO app_m01_lodicka_stav_garant (id, lodicka_id, person_id, is_primary, created_at)
      SELECT
        'm01-stupen-stav-garant-fix-' || md5(l.id || ':' || os.person_id),
        l.id,
        os.person_id,
        os.person_id = l.garant_person_id,
        now()
      FROM app_m01_lodicka l
      JOIN app_m01_oblast_spravce os ON os.oblast_id = l.oblast_id
      WHERE l.is_deleted = false
        ${stupenWhere("l")}
      ON CONFLICT (lodicka_id, person_id) DO UPDATE
      SET is_primary = EXCLUDED.is_primary
    `);

    await client.query(`
      WITH without_primary AS (
        SELECT sg.lodicka_id
        FROM app_m01_lodicka_stav_garant sg
        JOIN app_m01_lodicka l ON l.id = sg.lodicka_id
        WHERE l.is_deleted = false
          ${stupenWhere("l")}
        GROUP BY sg.lodicka_id
        HAVING bool_or(sg.is_primary) = false
      ),
      ranked AS (
        SELECT
          sg.id,
          row_number() OVER (PARTITION BY sg.lodicka_id ORDER BY sg.created_at ASC, sg.person_id ASC) AS rn
        FROM app_m01_lodicka_stav_garant sg
        JOIN without_primary missing ON missing.lodicka_id = sg.lodicka_id
      )
      UPDATE app_m01_lodicka_stav_garant sg
      SET is_primary = ranked.rn = 1
      FROM ranked
      WHERE ranked.id = sg.id
    `);

    await client.query(`
      UPDATE app_m01_lodicka l
      SET
        garant_person_id = (
          SELECT lg.person_id
          FROM app_m01_lodicka_garant lg
          WHERE lg.lodicka_id = l.id
          ORDER BY lg.is_primary DESC, lg.created_at ASC, lg.person_id ASC
          LIMIT 1
        ),
        updated_at = now()
      WHERE l.is_deleted = false
        ${stupenWhere("l")}
    `);

    await recomputeDerivedRoles(client);

    printResult(APPLY ? "after" : "planned-after", await snapshot(client));

    if (APPLY) {
      await client.query("COMMIT");
      console.log(`${logPrefix} committed`);
    } else {
      await client.query("ROLLBACK");
      console.log(`${logPrefix} dry run only; pass --apply to write changes`);
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`${logPrefix} failed`);
  console.error(error);
  process.exit(1);
});
