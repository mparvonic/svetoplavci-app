#!/usr/bin/env node

import pg from "pg";

const { Client } = pg;

const args = new Set(process.argv.slice(2));
const futureOnly = args.has("--future-only");
const json = args.has("--json");

const connectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing POSTGRES_PRISMA_URL or DATABASE_URL.");
  process.exit(1);
}

const client = new Client({ connectionString });

async function main() {
  await client.connect();
  const database = await client.query("SELECT current_database() AS database, current_user AS user");
  const whereFuture = futureOnly ? "AND e.starts_at >= NOW()" : "";
  const { rows } = await client.query(`
    WITH latest_state AS (
      SELECT DISTINCT ON (s.person_id)
        s.person_id,
        s.study_mode_code,
        s.study_mode_key,
        s.current_grade_num
      FROM app_student_state s
      WHERE (s.effective_to IS NULL OR s.effective_to::date >= CURRENT_DATE)
      ORDER BY s.person_id, s.effective_from DESC, s.created_at DESC
    )
    SELECT
      r.id AS registration_id,
      r.person_id,
      p.display_name,
      p.nickname,
      ls.study_mode_code,
      ls.study_mode_key,
      ls.current_grade_num,
      r.status,
      r.changed_at,
      e.id AS event_id,
      e.title,
      e.starts_at,
      e.offer_group_id
    FROM app_school_event_registration r
    JOIN app_school_event e ON e.id = r.school_event_id
    JOIN app_school_event_type et ON et.id = e.event_type_id
    JOIN app_person p ON p.id = r.person_id
    LEFT JOIN latest_state ls ON ls.person_id = p.id
    WHERE et.code = 'OSTROVY'
      AND e.is_active = TRUE
      AND r.status IN ('REGISTERED', 'WAITLIST')
      ${whereFuture}
      AND COALESCE((ls.study_mode_code = '11' OR lower(ls.study_mode_key::text) = 'denni'), FALSE) = FALSE
    ORDER BY e.starts_at ASC, p.display_name ASC
  `);

  if (json) {
    console.log(JSON.stringify({ database: database.rows[0], futureOnly, count: rows.length, rows }, null, 2));
    return;
  }

  console.log(`Database: ${database.rows[0].database} as ${database.rows[0].user}`);
  console.log(`Future only: ${futureOnly ? "yes" : "no"}`);
  console.log(`Active Ostrovy registrations outside daily study: ${rows.length}`);
  for (const row of rows) {
    const name = row.nickname || row.display_name || row.person_id;
    console.log(
      [
        `- ${name}`,
        `person=${row.person_id}`,
        `mode=${row.study_mode_code ?? "-"}:${row.study_mode_key ?? "-"}`,
        `event="${row.title}"`,
        `starts=${row.starts_at?.toISOString?.() ?? row.starts_at}`,
        `registration=${row.registration_id}`,
      ].join(" | "),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
