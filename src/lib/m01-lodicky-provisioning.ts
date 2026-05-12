import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";

const SOURCE = "edookit_sync_lodicky_provisioning_v1";
const INITIAL_STATUS = 0;
const INITIAL_STATUS_LABEL = "Nezahájeno";

type M01Stupen = "I_STUPEN" | "II_STUPEN";

type CurrentSvpRow = {
  id: string;
  label: string;
};

type ProvisionPlanRow = {
  person_id: string;
  display_name: string;
  source_person_id: string | null;
  current_grade_num: number | null;
  stupen: M01Stupen;
  existing_set_id: string | null;
  lodicka_id: string;
  lodicka_kod: string;
};

type SkippedStudentRow = {
  person_id: string;
  display_name: string;
  source_person_id: string | null;
  current_grade_num: number | null;
};

type ExistingSetSummaryRow = {
  osobni_sada_id: string;
  person_id: string;
  display_name: string;
  current_count: number;
  expected_count: number;
};

export interface ProvisionM01LodickyOptions {
  personIds?: string[];
  dryRun?: boolean;
  sampleLimit?: number;
}

export interface ProvisionM01LodickyResult {
  dryRun: boolean;
  currentSvpVersionId: string | null;
  currentSvpLabel: string | null;
  candidateStudents: number;
  skippedWithoutStupen: number;
  setsToCreate: number;
  existingSetsToComplete: number;
  personalLodickyToCreate: number;
  initialEventsToCreate: number;
  createdSets: number;
  createdPersonalLodicky: number;
  createdInitialEvents: number;
  sample: Array<{
    personId: string;
    displayName: string;
    sourcePersonId: string | null;
    stupen: M01Stupen;
    missingLodicky: number;
    createsSet: boolean;
  }>;
  skippedSample: Array<{
    personId: string;
    displayName: string;
    sourcePersonId: string | null;
    currentGradeNum: number | null;
  }>;
}

function id(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function toStudentExternalId(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function buildKodOsobniLodicky(input: {
  sourcePersonId: string | null;
  personId: string;
  svpLabel: string;
  lodickaKod: string;
}): string {
  const studentPart = input.sourcePersonId?.trim() || input.personId.slice(-10);
  return `${studentPart}-${input.svpLabel}-${input.lodickaKod}`;
}

function personFilter(personIds: string[]): Prisma.Sql {
  if (personIds.length === 0) return Prisma.empty;
  return Prisma.sql`AND p.id IN (${Prisma.join(personIds)})`;
}

async function getCurrentSvp(): Promise<CurrentSvpRow | null> {
  const rows = await prisma.$queryRaw<CurrentSvpRow[]>(Prisma.sql`
    SELECT id, label
    FROM app_m01_svp_version
    WHERE is_current = true
      AND status = 'ACTIVE'
    ORDER BY effective_from DESC NULLS LAST, created_at DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function getCandidateCount(personIds: string[]): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT count(DISTINCT p.id)::int AS count
    FROM app_person p
    JOIN app_role_assignment ra
      ON ra.person_id = p.id
      AND ra.role = 'zak'
      AND ra.is_active = true
    JOIN app_person_source_record src
      ON src.person_id = p.id
      AND src.source_type = 'edookit_student'
      AND src.active_source = true
    LEFT JOIN LATERAL (
      SELECT s.study_mode_code, s.study_mode_key
      FROM app_student_state s
      WHERE s.person_id = p.id
        AND (s.effective_to IS NULL OR s.effective_to::date >= CURRENT_DATE)
      ORDER BY s.effective_from DESC, s.created_at DESC
      LIMIT 1
    ) ss ON true
    WHERE p.is_active = true
      AND (ss.study_mode_code = '11' OR lower(ss.study_mode_key::text) = 'denni')
      ${personFilter(personIds)}
  `);
  return rows[0]?.count ?? 0;
}

async function getSkippedStudentsWithoutStupen(personIds: string[]): Promise<SkippedStudentRow[]> {
  return prisma.$queryRaw<SkippedStudentRow[]>(Prisma.sql`
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
        ${personFilter(personIds)}
    )
    SELECT person_id, display_name, source_person_id, current_grade_num
    FROM candidates
    WHERE stupen IS NULL
    ORDER BY display_name ASC
  `);
}

async function getProvisionPlan(currentSvpId: string, personIds: string[]): Promise<ProvisionPlanRow[]> {
  return prisma.$queryRaw<ProvisionPlanRow[]>(Prisma.sql`
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
        ${personFilter(personIds)}
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
        ON l.svp_version_id = ${currentSvpId}
        AND l.stupen::text = c.stupen
        AND l.is_deleted = false
      LEFT JOIN app_m01_osobni_sada_lodicek os
        ON os.person_id = c.person_id
        AND os.svp_version_id = ${currentSvpId}
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
      stupen::text AS stupen,
      existing_set_id,
      lodicka_id,
      lodicka_kod
    FROM expected
    WHERE existing_set_id IS NULL
       OR existing_personal_id IS NULL
    ORDER BY display_name ASC, lodicka_kod ASC
  `);
}

function summarizePlan(rows: ProvisionPlanRow[], sampleLimit: number): {
  setsToCreate: number;
  existingSetsToComplete: number;
  sample: ProvisionM01LodickyResult["sample"];
} {
  const byPerson = new Map<string, ProvisionM01LodickyResult["sample"][number]>();
  const existingSetIds = new Set<string>();

  for (const row of rows) {
    const existing = byPerson.get(row.person_id);
    if (existing) {
      existing.missingLodicky += 1;
    } else {
      byPerson.set(row.person_id, {
        personId: row.person_id,
        displayName: row.display_name,
        sourcePersonId: row.source_person_id,
        stupen: row.stupen,
        missingLodicky: 1,
        createsSet: row.existing_set_id === null,
      });
    }

    if (row.existing_set_id) existingSetIds.add(row.existing_set_id);
  }

  const items = [...byPerson.values()];
  return {
    setsToCreate: items.filter((item) => item.createsSet).length,
    existingSetsToComplete: existingSetIds.size,
    sample: items
      .sort((a, b) => b.missingLodicky - a.missingLodicky || a.displayName.localeCompare(b.displayName, "cs"))
      .slice(0, sampleLimit),
  };
}

async function getExistingSetSummaries(setIds: string[]): Promise<Map<string, ExistingSetSummaryRow>> {
  if (setIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<ExistingSetSummaryRow[]>(Prisma.sql`
    WITH expected AS (
      SELECT os.id AS osobni_sada_id, count(l.id)::int AS expected_count
      FROM app_m01_osobni_sada_lodicek os
      JOIN app_m01_lodicka l
        ON l.svp_version_id = os.svp_version_id
        AND l.stupen = os.stupen
        AND l.is_deleted = false
      WHERE os.id IN (${Prisma.join(setIds)})
      GROUP BY os.id
    ),
    current AS (
      SELECT os.id AS osobni_sada_id, count(ol.id)::int AS current_count
      FROM app_m01_osobni_sada_lodicek os
      LEFT JOIN app_m01_osobni_lodicka ol
        ON ol.osobni_sada_id = os.id
        AND ol.is_deleted = false
      WHERE os.id IN (${Prisma.join(setIds)})
      GROUP BY os.id
    )
    SELECT
      os.id AS osobni_sada_id,
      os.person_id,
      p.display_name,
      current.current_count,
      expected.expected_count
    FROM app_m01_osobni_sada_lodicek os
    JOIN app_person p ON p.id = os.person_id
    JOIN current ON current.osobni_sada_id = os.id
    JOIN expected ON expected.osobni_sada_id = os.id
  `);

  return new Map(rows.map((row) => [row.osobni_sada_id, row]));
}

export async function provisionM01LodickyForSyncedStudents(
  options: ProvisionM01LodickyOptions = {},
): Promise<ProvisionM01LodickyResult> {
  const dryRun = options.dryRun !== false;
  const sampleLimit = options.sampleLimit ?? 20;
  const personIds = [...new Set((options.personIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const currentSvp = await getCurrentSvp();

  if (!currentSvp) {
    return {
      dryRun,
      currentSvpVersionId: null,
      currentSvpLabel: null,
      candidateStudents: 0,
      skippedWithoutStupen: 0,
      setsToCreate: 0,
      existingSetsToComplete: 0,
      personalLodickyToCreate: 0,
      initialEventsToCreate: 0,
      createdSets: 0,
      createdPersonalLodicky: 0,
      createdInitialEvents: 0,
      sample: [],
      skippedSample: [],
    };
  }

  const [candidateStudents, skippedWithoutStupenRows, planRows] = await Promise.all([
    getCandidateCount(personIds),
    getSkippedStudentsWithoutStupen(personIds),
    getProvisionPlan(currentSvp.id, personIds),
  ]);

  const summary = summarizePlan(planRows, sampleLimit);
  const skippedSample = skippedWithoutStupenRows.slice(0, sampleLimit).map((row) => ({
    personId: row.person_id,
    displayName: row.display_name,
    sourcePersonId: row.source_person_id,
    currentGradeNum: row.current_grade_num,
  }));

  if (dryRun || planRows.length === 0) {
    return {
      dryRun,
      currentSvpVersionId: currentSvp.id,
      currentSvpLabel: currentSvp.label,
      candidateStudents,
      skippedWithoutStupen: skippedWithoutStupenRows.length,
      setsToCreate: summary.setsToCreate,
      existingSetsToComplete: summary.existingSetsToComplete,
      personalLodickyToCreate: planRows.length,
      initialEventsToCreate: planRows.length,
      createdSets: 0,
      createdPersonalLodicky: 0,
      createdInitialEvents: 0,
      sample: summary.sample,
      skippedSample,
    };
  }

  const plannedSetIdByPerson = new Map<string, string>();
  const rowsByPerson = new Map<string, ProvisionPlanRow[]>();
  for (const row of planRows) {
    if (!rowsByPerson.has(row.person_id)) rowsByPerson.set(row.person_id, []);
    rowsByPerson.get(row.person_id)!.push(row);
    if (!row.existing_set_id && !plannedSetIdByPerson.has(row.person_id)) {
      plannedSetIdByPerson.set(row.person_id, id("m01-set"));
    }
  }

  const existingSetIds = [...new Set(planRows.map((row) => row.existing_set_id).filter((value): value is string => !!value))];
  const existingSetSummaries = await getExistingSetSummaries(existingSetIds);
  const now = new Date();
  let createdSets = 0;
  let createdPersonalLodicky = 0;
  let createdInitialEvents = 0;

  await prisma.$transaction(async (tx) => {
    for (const [personId, rows] of rowsByPerson.entries()) {
      const first = rows[0];
      const setId = first.existing_set_id ?? plannedSetIdByPerson.get(personId);
      if (!setId) throw new Error(`Missing planned M01 set id for person ${personId}.`);

      if (!first.existing_set_id) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO app_m01_osobni_sada_lodicek (
            id,
            person_id,
            svp_version_id,
            stupen,
            status,
            activated_at,
            source,
            source_ref,
            created_at,
            updated_at
          ) VALUES (
            ${setId},
            ${personId},
            ${currentSvp.id},
            ${first.stupen}::"M01Stupen",
            'ACTIVE'::"M01OsobniSadaStatus",
            ${now},
            ${SOURCE},
            ${first.source_person_id ? `edookit_student:${first.source_person_id}` : `app_person:${personId}`},
            ${now},
            ${now}
          )
        `);
        createdSets += 1;
      }

      const existingSummary = first.existing_set_id ? existingSetSummaries.get(first.existing_set_id) : null;
      if (first.existing_set_id && !existingSummary) {
        throw new Error(`Missing M01 set summary for ${first.existing_set_id}.`);
      }

      for (const row of rows) {
        const personalId = id("m01-personal");
        const eventId = id("m01-event");
        const sourcePersonId = row.source_person_id;
        const kodOsobniLodicky = buildKodOsobniLodicky({
          sourcePersonId,
          personId,
          svpLabel: currentSvp.label,
          lodickaKod: row.lodicka_kod,
        });

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO app_m01_osobni_lodicka (
            id,
            osobni_sada_id,
            lodicka_id,
            kod_osobni_lodicky,
            student_external_id,
            current_stupen,
            current_stav_label,
            current_hodnota,
            datum_stavu,
            uspech,
            poznamka,
            source_coda_row_id,
            is_deleted,
            created_at,
            updated_at
          ) VALUES (
            ${personalId},
            ${setId},
            ${row.lodicka_id},
            ${kodOsobniLodicky},
            ${toStudentExternalId(sourcePersonId)},
            ${INITIAL_STATUS},
            ${INITIAL_STATUS_LABEL},
            ${INITIAL_STATUS},
            ${now},
            NULL,
            NULL,
            NULL,
            false,
            ${now},
            ${now}
          )
        `);

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO app_m01_osobni_lodicka_event (
            id,
            osobni_lodicka_id,
            stupen,
            stav_label,
            hodnota,
            datum_stavu,
            poznamka,
            uspech,
            changed_by_person_id,
            source,
            source_row_id,
            created_at,
            changed_by_label,
            source_created_by_person_id,
            source_created_by_label,
            source_created_at,
            source_modified_by_person_id,
            source_modified_by_label,
            source_modified_at
          ) VALUES (
            ${eventId},
            ${personalId},
            ${INITIAL_STATUS},
            ${INITIAL_STATUS_LABEL},
            ${INITIAL_STATUS},
            ${now},
            NULL,
            NULL,
            NULL,
            ${SOURCE},
            ${`${SOURCE}:${personalId}`},
            ${now},
            'Edookit sync',
            NULL,
            'Edookit sync',
            ${now},
            NULL,
            'Edookit sync',
            ${now}
          )
        `);

        await tx.$executeRaw(Prisma.sql`
          UPDATE app_m01_osobni_lodicka
          SET last_event_id = ${eventId}
          WHERE id = ${personalId}
        `);

        createdPersonalLodicky += 1;
        createdInitialEvents += 1;
      }
    }
  });

  return {
    dryRun,
    currentSvpVersionId: currentSvp.id,
    currentSvpLabel: currentSvp.label,
    candidateStudents,
    skippedWithoutStupen: skippedWithoutStupenRows.length,
    setsToCreate: summary.setsToCreate,
    existingSetsToComplete: summary.existingSetsToComplete,
    personalLodickyToCreate: planRows.length,
    initialEventsToCreate: planRows.length,
    createdSets,
    createdPersonalLodicky,
    createdInitialEvents,
    sample: summary.sample,
    skippedSample,
  };
}
