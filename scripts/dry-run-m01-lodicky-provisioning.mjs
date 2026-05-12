#!/usr/bin/env node

import { Client } from "pg";

const DEFAULT_LIMIT = 30;

function parseArgs(argv) {
  const args = {
    json: false,
    limit: DEFAULT_LIMIT,
    personIds: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--limit") {
      const next = argv[index + 1];
      index += 1;
      const parsed = Number.parseInt(next ?? "", 10);
      args.limit = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_LIMIT;
      continue;
    }
    if (arg === "--person-id") {
      const next = argv[index + 1]?.trim();
      index += 1;
      if (next) args.personIds.push(next);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function createDbClient() {
  const connectionString = process.env.POSTGRES_PRISMA_URL;
  if (!connectionString) {
    throw new Error("Missing POSTGRES_PRISMA_URL. Source .env.local first or provide the variable.");
  }

  const shouldUseSsl = /sslmode=require/i.test(connectionString);
  return new Client({
    connectionString,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5_000,
  });
}

function personFilterSql(personIds, startIndex) {
  if (personIds.length === 0) return { sql: "", values: [] };
  const placeholders = personIds.map((_, index) => `$${startIndex + index}`).join(", ");
  return {
    sql: `AND p.id IN (${placeholders})`,
    values: personIds,
  };
}

async function getCurrentSvp(client) {
  const result = await client.query(`
    SELECT id, label
    FROM app_m01_svp_version
    WHERE is_current = true
      AND status = 'ACTIVE'
    ORDER BY effective_from DESC NULLS LAST, created_at DESC
    LIMIT 1
  `);
  return result.rows[0] ?? null;
}

async function getPlan(client, currentSvpId, personIds) {
  const filter = personFilterSql(personIds, 2);
  const values = [currentSvpId, ...filter.values];
  const result = await client.query(
    `
    WITH candidates AS (
      SELECT DISTINCT
        p.id AS person_id,
        p.display_name,
        src.source_person_id,
        ss.current_grade_num,
        CASE
          WHEN ss.current_grade_num BETWEEN 1 AND 5 THEN 'I_STUPEN'
          WHEN ss.current_grade_num BETWEEN 6 AND 9 THEN 'II_STUPEN'
          ELSE NULL
        END AS stupen
      FROM app_person p
      JOIN app_role_assignment ra
        ON ra.person_id = p.id
        AND ra.role = 'zak'
        AND ra.is_active = true
      JOIN LATERAL (
        SELECT source_person_id
        FROM app_person_source_record src
        WHERE src.person_id = p.id
          AND src.source_type = 'edookit_student'
          AND src.active_source = true
        ORDER BY src.synced_at DESC, src.source_key ASC
        LIMIT 1
      ) src ON true
      LEFT JOIN LATERAL (
        SELECT s.current_grade_num, s.study_mode_code, s.study_mode_key
        FROM app_student_state s
        WHERE s.person_id = p.id
          AND (s.effective_to IS NULL OR s.effective_to::date >= CURRENT_DATE)
        ORDER BY s.effective_from DESC, s.created_at DESC
        LIMIT 1
      ) ss ON true
      WHERE p.is_active = true
        AND (ss.study_mode_code = '11' OR lower(ss.study_mode_key::text) = 'denni')
        ${filter.sql}
    ),
    expected AS (
      SELECT
        c.person_id,
        c.display_name,
        c.source_person_id,
        c.current_grade_num,
        c.stupen,
        os.id AS existing_set_id,
        l.id AS lodicka_id,
        l.kod AS lodicka_kod,
        ol.id AS existing_personal_id
      FROM candidates c
      JOIN app_m01_lodicka l
        ON l.svp_version_id = $1
        AND l.stupen::text = c.stupen
        AND l.is_deleted = false
      LEFT JOIN app_m01_osobni_sada_lodicek os
        ON os.person_id = c.person_id
        AND os.svp_version_id = $1
        AND os.stupen::text = c.stupen
        AND os.status = 'ACTIVE'
      LEFT JOIN app_m01_osobni_lodicka ol
        ON ol.osobni_sada_id = os.id
        AND ol.lodicka_id = l.id
        AND ol.is_deleted = false
      WHERE c.stupen IS NOT NULL
    )
    SELECT
      person_id,
      display_name,
      source_person_id,
      current_grade_num,
      stupen,
      existing_set_id,
      lodicka_id,
      lodicka_kod
    FROM expected
    WHERE existing_set_id IS NULL
       OR existing_personal_id IS NULL
    ORDER BY display_name ASC, lodicka_kod ASC
    `,
    values,
  );
  return result.rows;
}

async function getCandidateSummary(client, personIds) {
  const filter = personFilterSql(personIds, 1);
  const result = await client.query(
    `
    WITH candidates AS (
      SELECT DISTINCT
        p.id AS person_id,
        p.display_name,
        src.source_person_id,
        ss.current_grade_num,
        CASE
          WHEN ss.current_grade_num BETWEEN 1 AND 5 THEN 'I_STUPEN'
          WHEN ss.current_grade_num BETWEEN 6 AND 9 THEN 'II_STUPEN'
          ELSE NULL
        END AS stupen
      FROM app_person p
      JOIN app_role_assignment ra
        ON ra.person_id = p.id
        AND ra.role = 'zak'
        AND ra.is_active = true
      JOIN LATERAL (
        SELECT source_person_id
        FROM app_person_source_record src
        WHERE src.person_id = p.id
          AND src.source_type = 'edookit_student'
          AND src.active_source = true
        ORDER BY src.synced_at DESC, src.source_key ASC
        LIMIT 1
      ) src ON true
      LEFT JOIN LATERAL (
        SELECT s.current_grade_num, s.study_mode_code, s.study_mode_key
        FROM app_student_state s
        WHERE s.person_id = p.id
          AND (s.effective_to IS NULL OR s.effective_to::date >= CURRENT_DATE)
        ORDER BY s.effective_from DESC, s.created_at DESC
        LIMIT 1
      ) ss ON true
      WHERE p.is_active = true
        AND (ss.study_mode_code = '11' OR lower(ss.study_mode_key::text) = 'denni')
        ${filter.sql}
    )
    SELECT
      count(*)::int AS candidate_students,
      count(*) FILTER (WHERE stupen IS NULL)::int AS skipped_without_stupen
    FROM candidates
    `,
    filter.values,
  );
  return result.rows[0] ?? { candidate_students: 0, skipped_without_stupen: 0 };
}

async function getExistingActiveSetGaps(client, currentSvpId, limit) {
  const result = await client.query(
    `
    WITH set_counts AS (
      SELECT
        os.id AS osobni_sada_id,
        os.person_id,
        p.display_name,
        p.is_active AS person_is_active,
        os.svp_version_id,
        os.stupen::text AS stupen,
        count(ol.id)::int AS personal_count
      FROM app_m01_osobni_sada_lodicek os
      JOIN app_person p ON p.id = os.person_id
      LEFT JOIN app_m01_osobni_lodicka ol
        ON ol.osobni_sada_id = os.id
        AND ol.is_deleted = false
      WHERE os.status = 'ACTIVE'
        AND os.svp_version_id = $1
      GROUP BY os.id, os.person_id, p.display_name, p.is_active, os.svp_version_id, os.stupen::text
    ),
    catalog_counts AS (
      SELECT svp_version_id, stupen::text AS stupen, count(*)::int AS expected_count
      FROM app_m01_lodicka
      WHERE is_deleted = false
        AND svp_version_id = $1
      GROUP BY svp_version_id, stupen::text
    ),
    gaps AS (
      SELECT
        sc.osobni_sada_id,
        sc.person_id,
        sc.display_name,
        sc.person_is_active,
        sc.stupen,
        sc.personal_count,
        cc.expected_count,
        (cc.expected_count - sc.personal_count)::int AS missing_count
      FROM set_counts sc
      JOIN catalog_counts cc
        ON cc.svp_version_id = sc.svp_version_id
        AND cc.stupen = sc.stupen
      WHERE sc.personal_count < cc.expected_count
    )
    SELECT *
    FROM gaps
    ORDER BY missing_count DESC, display_name ASC
    LIMIT $2
    `,
    [currentSvpId, limit],
  );

  const countResult = await client.query(
    `
    WITH set_counts AS (
      SELECT
        os.id AS osobni_sada_id,
        os.svp_version_id,
        os.stupen::text AS stupen,
        count(ol.id)::int AS personal_count
      FROM app_m01_osobni_sada_lodicek os
      LEFT JOIN app_m01_osobni_lodicka ol
        ON ol.osobni_sada_id = os.id
        AND ol.is_deleted = false
      WHERE os.status = 'ACTIVE'
        AND os.svp_version_id = $1
      GROUP BY os.id, os.svp_version_id, os.stupen::text
    ),
    catalog_counts AS (
      SELECT svp_version_id, stupen::text AS stupen, count(*)::int AS expected_count
      FROM app_m01_lodicka
      WHERE is_deleted = false
        AND svp_version_id = $1
      GROUP BY svp_version_id, stupen::text
    )
    SELECT
      count(*)::int AS active_sets_with_gaps,
      COALESCE(sum(cc.expected_count - sc.personal_count), 0)::int AS missing_personal_lodicky
    FROM set_counts sc
    JOIN catalog_counts cc
      ON cc.svp_version_id = sc.svp_version_id
      AND cc.stupen = sc.stupen
    WHERE sc.personal_count < cc.expected_count
    `,
    [currentSvpId],
  );

  return {
    activeSetsWithGaps: countResult.rows[0]?.active_sets_with_gaps ?? 0,
    missingPersonalLodickyInExistingSets: countResult.rows[0]?.missing_personal_lodicky ?? 0,
    sample: result.rows,
  };
}

function summarizePlan(rows, limit) {
  const byPerson = new Map();
  const existingSets = new Set();

  for (const row of rows) {
    const item = byPerson.get(row.person_id) ?? {
      personId: row.person_id,
      displayName: row.display_name,
      sourcePersonId: row.source_person_id,
      currentGradeNum: row.current_grade_num,
      stupen: row.stupen,
      createsSet: row.existing_set_id == null,
      missingLodicky: 0,
    };
    item.missingLodicky += 1;
    byPerson.set(row.person_id, item);

    if (row.existing_set_id) existingSets.add(row.existing_set_id);
  }

  const people = [...byPerson.values()].sort(
    (a, b) => b.missingLodicky - a.missingLodicky || a.displayName.localeCompare(b.displayName, "cs"),
  );

  return {
    setsToCreate: people.filter((item) => item.createsSet).length,
    existingSetsToComplete: existingSets.size,
    personalLodickyToCreate: rows.length,
    initialEventsToCreate: rows.length,
    affectedStudents: people.length,
    sample: people.slice(0, limit),
  };
}

function printHuman(result) {
  console.log("[m01:lodicky:dry-run] Read-only dry run. No writes were made.");
  console.log(`Current SVP: ${result.currentSvpLabel ?? "-"} (${result.currentSvpVersionId ?? "-"})`);
  console.table([
    {
      candidateStudents: result.candidateStudents,
      skippedWithoutStupen: result.skippedWithoutStupen,
      affectedStudents: result.affectedStudents,
      setsToCreate: result.setsToCreate,
      existingSetsToComplete: result.existingSetsToComplete,
      personalLodickyToCreate: result.personalLodickyToCreate,
      initialEventsToCreate: result.initialEventsToCreate,
    },
  ]);

  if (result.sample.length > 0) {
    console.log("\nSample:");
    console.table(result.sample);
  }

  console.log("\nExisting active sets with catalog gaps:");
  console.table([
    {
      activeSetsWithGaps: result.existingActiveSetGaps.activeSetsWithGaps,
      missingPersonalLodicky: result.existingActiveSetGaps.missingPersonalLodickyInExistingSets,
    },
  ]);
  if (result.existingActiveSetGaps.sample.length > 0) {
    console.log("\nExisting set gap sample:");
    console.table(result.existingActiveSetGaps.sample);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = createDbClient();
  await client.connect();

  try {
    const currentSvp = await getCurrentSvp(client);
    if (!currentSvp) {
      throw new Error("No active current app_m01_svp_version found.");
    }

    const candidateSummary = await getCandidateSummary(client, args.personIds);
    const planRows = await getPlan(client, currentSvp.id, args.personIds);
    const existingActiveSetGaps = await getExistingActiveSetGaps(client, currentSvp.id, args.limit);
    const planSummary = summarizePlan(planRows, args.limit);
    const result = {
      dryRun: true,
      currentSvpVersionId: currentSvp.id,
      currentSvpLabel: currentSvp.label,
      candidateStudents: candidateSummary.candidate_students,
      skippedWithoutStupen: candidateSummary.skipped_without_stupen,
      ...planSummary,
      existingActiveSetGaps,
    };

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printHuman(result);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[m01:lodicky:dry-run] Failed:", error);
  process.exit(1);
});
