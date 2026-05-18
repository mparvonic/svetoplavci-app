"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/src/lib/auth";
import { collectSessionRoles, isLocalDevAuthBypass, LOCAL_DEV_ROLES } from "@/src/lib/api/session";
import { getSelectedDevAuthUser } from "@/src/lib/dev-auth";
import { syncM01DerivedRolesForPersons } from "@/src/lib/m01-lodicky-role-sync";
import { prisma } from "@/src/lib/prisma";
import { getApprovedLoginProfileByEmail } from "@/src/lib/user-directory";

import { canManageLodicky, canManageWholeFleet, verifyCanEditLodicka } from "./data";
import { copySvpVersionContent } from "./svp-version-copy";

type ActionAccess = {
  roles: string[];
  personIds: string[];
};

type LodickaSvpContext = {
  lodickaId: string;
  svpVersionId: string;
  rvpVersionId: string;
  stupen: string;
};

type ClassificationInfo = {
  predmetKod: string | null;
  podpredmetKod: string | null;
  oblastKod: string | null;
};

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readStringList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseGrade(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 9 ? parsed : null;
}

function parseStupen(value: string): "I_STUPEN" | "II_STUPEN" | null {
  return value === "I_STUPEN" || value === "II_STUPEN" ? value : null;
}

function gradeRangeMatchesStupen(stupen: "I_STUPEN" | "II_STUPEN", rocnikOd: number, rocnikDo: number): boolean {
  if (stupen === "I_STUPEN") return rocnikOd >= 1 && rocnikDo <= 5;
  return rocnikOd >= 6 && rocnikDo <= 9;
}

function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function appendStatusParam(path: string, key: "saved" | "error", value: string): string {
  const [pathname, rawQuery = ""] = path.split("?");
  const params = new URLSearchParams(rawQuery);
  params.delete("saved");
  params.delete("error");
  params.set(key, value);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function id(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function currentSemesterStart(now = new Date()): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (month >= 2 && month <= 8) {
    return new Date(Date.UTC(year, 1, 1, 0, 0, 0, 0));
  }
  const schoolYearStart = month >= 9 ? year : year - 1;
  return new Date(Date.UTC(schoolYearStart, 8, 1, 0, 0, 0, 0));
}

function nextSchoolYearStart(now = new Date()): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const nextSeptemberYear = month >= 9 ? year + 1 : year;
  return new Date(Date.UTC(nextSeptemberYear, 8, 1, 0, 0, 0, 0));
}

function formatVersionLabel(major: number, minor: number, patch: number): string {
  if (minor === 0 && patch === 0) return String(major);
  if (patch === 0) return `${major}.${String(minor).padStart(2, "0")}`;
  return `${major}.${String(minor).padStart(2, "0")}.${String(patch).padStart(2, "0")}`;
}

async function ensureDraftSvpVersion(svpVersionId: string, returnTo: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; status: string; parentSvpVersionId: string | null }>>(Prisma.sql`
    SELECT id, status::text AS status, parent_svp_version_id AS "parentSvpVersionId"
    FROM app_m01_svp_version
    WHERE id = ${svpVersionId}
    LIMIT 1
  `);
  const svp = rows[0] ?? null;
  if (!svp || svp.status !== "DRAFT" || !svp.parentSvpVersionId) {
    redirect(appendStatusParam(returnTo, "error", "draft-required"));
  }
  return svp;
}

async function cleanupStaleSvpDrafts() {
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM app_m01_svp_version
    WHERE status = 'DRAFT'::"M01SvpVersionStatus"
      AND parent_svp_version_id IS NOT NULL
      AND created_at < now() - interval '24 hours'
  `);
}

async function getActionAccess(): Promise<ActionAccess> {
  const session = await auth();
  const selectedDevUser = isLocalDevAuthBypass() ? await getSelectedDevAuthUser() : null;
  const roles = selectedDevUser?.roles ?? (session ? collectSessionRoles(session) : LOCAL_DEV_ROLES);
  let profile: Awaited<ReturnType<typeof getApprovedLoginProfileByEmail>> = null;
  if (session?.user?.email) {
    try {
      profile = await getApprovedLoginProfileByEmail(session.user.email);
    } catch (error) {
      console.error("[lodicky/sprava/actions] failed to load login profile; continuing without profile scope", error);
    }
  }
  const personIds =
    selectedDevUser?.personId && !selectedDevUser.personId.startsWith("local-dev-")
      ? [selectedDevUser.personId]
      : profile?.personIds ?? [];

  return { roles, personIds };
}

async function getLodickaSvpContext(lodickaId: string): Promise<LodickaSvpContext | null> {
  const rows = await prisma.$queryRaw<LodickaSvpContext[]>(Prisma.sql`
    SELECT
      l.id AS "lodickaId",
      l.svp_version_id AS "svpVersionId",
      svp.based_on_rvp_version_id AS "rvpVersionId",
      l.stupen::text AS stupen
    FROM app_m01_lodicka l
    JOIN app_m01_svp_version svp ON svp.id = l.svp_version_id
    WHERE l.id = ${lodickaId}
      AND l.is_deleted = false
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function startSvpVersionEditAction(formData: FormData) {
  const svpVersionId = readString(formData, "svpVersionId");
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava";
  const access = await getActionAccess();
  if (!svpVersionId || !canManageWholeFleet(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }
  await cleanupStaleSvpDrafts();

  const existingDraftRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM app_m01_svp_version
    WHERE parent_svp_version_id = ${svpVersionId}
      AND status = 'DRAFT'::"M01SvpVersionStatus"
      AND zmena_type <> 'MAJOR'::"M01SvpZmenaType"
    ORDER BY created_at DESC
    LIMIT 1
  `);
  if (existingDraftRows[0]) {
    redirect(appendStatusParam(`/portal/lodicky/sprava?svp=${encodeURIComponent(existingDraftRows[0].id)}&tab=struktura&edit=1`, "saved", "draft-opened"));
  }

  const parentRows = await prisma.$queryRaw<Array<{
    id: string;
    label: string;
    versionLabel: string;
    major: number;
    minor: number;
    patch: number;
    basedOnRvpVersionId: string;
    effectiveFrom: Date;
    notes: string | null;
  }>>(Prisma.sql`
    SELECT
      id,
      label,
      version_label AS "versionLabel",
      major,
      minor,
      patch,
      based_on_rvp_version_id AS "basedOnRvpVersionId",
      effective_from AS "effectiveFrom",
      notes
    FROM app_m01_svp_version
    WHERE id = ${svpVersionId}
      AND status <> 'DRAFT'::"M01SvpVersionStatus"
    LIMIT 1
  `);
  const parent = parentRows[0] ?? null;
  if (!parent) {
    redirect(appendStatusParam(returnTo, "error", "invalid-svp"));
  }

  const maxPatchRows = await prisma.$queryRaw<Array<{ patch: number }>>(Prisma.sql`
    SELECT COALESCE(max(patch), 0)::int AS patch
    FROM app_m01_svp_version
    WHERE major = ${parent.major}
      AND minor = ${parent.minor}
  `);
  const draftId = id("m01-svp");
  const draftPatch = (maxPatchRows[0]?.patch ?? parent.patch) + 1;
  const draftLabel = `${parent.label} - pracovní verze ${new Date().toISOString().slice(0, 10)} ${draftId.slice(-6)}`;

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw(Prisma.sql`
      INSERT INTO app_m01_svp_version (
        id,
        label,
        version_label,
        major,
        minor,
        patch,
        zmena_type,
        status,
        based_on_rvp_version_id,
        parent_svp_version_id,
        effective_from,
        effective_to,
        approved_at,
        approved_by_person_id,
        is_current,
        notes,
        created_at,
        updated_at
      )
      VALUES (
        ${draftId},
        ${draftLabel},
        ${`${parent.versionLabel || formatVersionLabel(parent.major, parent.minor, parent.patch)} draft`},
        ${parent.major},
        ${parent.minor},
        ${draftPatch},
        'PATCH'::"M01SvpZmenaType",
        'DRAFT'::"M01SvpVersionStatus",
        ${parent.basedOnRvpVersionId},
        ${parent.id},
        ${currentSemesterStart()},
        NULL,
        NULL,
        NULL,
        false,
        ${parent.notes},
        now(),
        now()
      )
    `);
      await copySvpVersionContent(tx, { fromSvpVersionId: parent.id, toSvpVersionId: draftId });
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  revalidatePath("/portal/lodicky/sprava");
  redirect(appendStatusParam(`/portal/lodicky/sprava?svp=${encodeURIComponent(draftId)}&tab=struktura&edit=1`, "saved", "draft"));
}

export async function startNextSchoolYearSvpVersionAction(formData: FormData) {
  const svpVersionId = readString(formData, "svpVersionId");
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava";
  const access = await getActionAccess();
  if (!svpVersionId || !canManageWholeFleet(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }
  await cleanupStaleSvpDrafts();

  const existingDraftRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM app_m01_svp_version
    WHERE parent_svp_version_id = ${svpVersionId}
      AND status = 'DRAFT'::"M01SvpVersionStatus"
      AND zmena_type = 'MAJOR'::"M01SvpZmenaType"
    ORDER BY created_at DESC
    LIMIT 1
  `);
  if (existingDraftRows[0]) {
    redirect(appendStatusParam(`/portal/lodicky/sprava?svp=${encodeURIComponent(existingDraftRows[0].id)}&tab=struktura&edit=1`, "saved", "draft-opened"));
  }

  const parentRows = await prisma.$queryRaw<Array<{
    id: string;
    label: string;
    basedOnRvpVersionId: string;
    notes: string | null;
  }>>(Prisma.sql`
    SELECT id, label, based_on_rvp_version_id AS "basedOnRvpVersionId", notes
    FROM app_m01_svp_version
    WHERE id = ${svpVersionId}
      AND status <> 'DRAFT'::"M01SvpVersionStatus"
    LIMIT 1
  `);
  const parent = parentRows[0] ?? null;
  if (!parent) {
    redirect(appendStatusParam(returnTo, "error", "invalid-svp"));
  }

  const maxMajorRows = await prisma.$queryRaw<Array<{ major: number }>>(Prisma.sql`
    SELECT COALESCE(max(major), 0)::int AS major
    FROM app_m01_svp_version
  `);
  const nextMajor = (maxMajorRows[0]?.major ?? 0) + 1;
  const draftId = id("m01-svp");
  const versionLabel = formatVersionLabel(nextMajor, 0, 0);
  const effectiveFrom = nextSchoolYearStart();
  const draftLabel = `${parent.label} - verze ${versionLabel}`;

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw(Prisma.sql`
      INSERT INTO app_m01_svp_version (
        id,
        label,
        version_label,
        major,
        minor,
        patch,
        zmena_type,
        status,
        based_on_rvp_version_id,
        parent_svp_version_id,
        effective_from,
        effective_to,
        approved_at,
        approved_by_person_id,
        is_current,
        notes,
        created_at,
        updated_at
      )
      VALUES (
        ${draftId},
        ${draftLabel},
        ${versionLabel},
        ${nextMajor},
        0,
        0,
        'MAJOR'::"M01SvpZmenaType",
        'DRAFT'::"M01SvpVersionStatus",
        ${parent.basedOnRvpVersionId},
        ${parent.id},
        ${effectiveFrom},
        NULL,
        NULL,
        NULL,
        false,
        ${parent.notes},
        now(),
        now()
      )
    `);
      await copySvpVersionContent(tx, { fromSvpVersionId: parent.id, toSvpVersionId: draftId });
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  revalidatePath("/portal/lodicky/sprava");
  redirect(appendStatusParam(`/portal/lodicky/sprava?svp=${encodeURIComponent(draftId)}&tab=struktura&edit=1`, "saved", "major-draft"));
}

export async function discardSvpVersionDraftAction(formData: FormData) {
  const svpVersionId = readString(formData, "svpVersionId");
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava";
  const access = await getActionAccess();
  if (!svpVersionId || !canManageWholeFleet(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }

  const rows = await prisma.$queryRaw<Array<{ parentSvpVersionId: string | null }>>(Prisma.sql`
    SELECT parent_svp_version_id AS "parentSvpVersionId"
    FROM app_m01_svp_version
    WHERE id = ${svpVersionId}
      AND status = 'DRAFT'::"M01SvpVersionStatus"
    LIMIT 1
  `);
  const parentSvpVersionId = rows[0]?.parentSvpVersionId ?? null;
  if (!parentSvpVersionId) {
    redirect(appendStatusParam(returnTo, "error", "invalid-svp"));
  }

  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM app_m01_svp_version
    WHERE id = ${svpVersionId}
      AND status = 'DRAFT'::"M01SvpVersionStatus"
  `);

  revalidatePath("/portal/lodicky/sprava");
  redirect(appendStatusParam(`/portal/lodicky/sprava?svp=${encodeURIComponent(parentSvpVersionId)}&tab=struktura`, "saved", "draft-discarded"));
}

export async function publishSvpVersionDraftAction(formData: FormData) {
  const svpVersionId = readString(formData, "svpVersionId");
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava";
  const confirmed = readString(formData, "confirmVersionChange") === "1";
  const access = await getActionAccess();
  if (!svpVersionId || !canManageWholeFleet(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }
  if (!confirmed) {
    redirect(appendStatusParam(returnTo, "error", "confirm-required"));
  }

  const draftRows = await prisma.$queryRaw<Array<{
    id: string;
    parentSvpVersionId: string | null;
    major: number;
    minor: number;
    patch: number;
    zmenaType: string;
    effectiveFrom: Date;
  }>>(Prisma.sql`
    SELECT
      id,
      parent_svp_version_id AS "parentSvpVersionId",
      major,
      minor,
      patch,
      zmena_type::text AS "zmenaType",
      effective_from AS "effectiveFrom"
    FROM app_m01_svp_version
    WHERE id = ${svpVersionId}
      AND status = 'DRAFT'::"M01SvpVersionStatus"
    LIMIT 1
  `);
  const draft = draftRows[0] ?? null;
  if (!draft?.parentSvpVersionId) {
    redirect(appendStatusParam(returnTo, "error", "invalid-svp"));
  }

  const isMajorVersion = draft.zmenaType === "MAJOR";
  const subjectChanges = isMajorVersion ? [] : await prisma.$queryRaw<Array<{
    subjectKey: string;
    subjectName: string;
    beforeCount: number;
    afterCount: number;
  }>>(Prisma.sql`
    WITH parent_counts AS (
      SELECT COALESCE(p.kod, p.nazev) AS subject_key, p.nazev AS subject_name, count(l.id)::int AS before_count
      FROM app_m01_predmet p
      LEFT JOIN app_m01_lodicka l ON l.predmet_id = p.id AND l.is_deleted = false
      WHERE p.svp_version_id = ${draft.parentSvpVersionId}
        AND p.is_active = true
      GROUP BY COALESCE(p.kod, p.nazev), p.nazev
    ),
    draft_counts AS (
      SELECT COALESCE(p.kod, p.nazev) AS subject_key, p.nazev AS subject_name, count(l.id)::int AS after_count
      FROM app_m01_predmet p
      LEFT JOIN app_m01_lodicka l ON l.predmet_id = p.id AND l.is_deleted = false
      WHERE p.svp_version_id = ${draft.id}
        AND p.is_active = true
      GROUP BY COALESCE(p.kod, p.nazev), p.nazev
    )
    SELECT
      COALESCE(d.subject_key, p.subject_key) AS "subjectKey",
      COALESCE(d.subject_name, p.subject_name) AS "subjectName",
      COALESCE(p.before_count, 0)::int AS "beforeCount",
      COALESCE(d.after_count, 0)::int AS "afterCount"
    FROM parent_counts p
    FULL JOIN draft_counts d ON d.subject_key = p.subject_key
    WHERE COALESCE(p.before_count, 0) <> COALESCE(d.after_count, 0)
    ORDER BY COALESCE(d.subject_name, p.subject_name) ASC
  `);
  const isMinorVersion = !isMajorVersion && subjectChanges.length > 0;
  const existingRows = await prisma.$queryRaw<Array<{ minor: number; patch: number }>>(Prisma.sql`
    SELECT minor, patch
    FROM app_m01_svp_version
    WHERE major = ${draft.major}
      AND id <> ${draft.id}
    ORDER BY minor DESC, patch DESC
  `);
  const nextMinor = isMajorVersion
    ? 0
    : isMinorVersion
    ? Math.max(0, ...existingRows.map((row) => row.minor)) + 1
    : draft.minor;
  const nextPatch = isMajorVersion || isMinorVersion
    ? 0
    : Math.max(0, ...existingRows.filter((row) => row.minor === draft.minor).map((row) => row.patch)) + 1;
  const versionLabel = formatVersionLabel(draft.major, nextMinor, nextPatch);
  const effectiveFrom = isMajorVersion ? draft.effectiveFrom : currentSemesterStart();
  const summary = {
    majorVersion: isMajorVersion,
    subjectCountChange: isMinorVersion,
    subjectChanges,
    ignoredPersonChanges: true,
  };
  const finalChangeType = isMajorVersion ? "MAJOR" : isMinorVersion ? "MINOR" : "PATCH";
  const changedByPersonId = access.personIds[0] ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      UPDATE app_m01_svp_version
      SET is_current = false, updated_at = now()
      WHERE is_current = true
        AND id <> ${draft.id}
    `);
    await tx.$executeRaw(Prisma.sql`
      UPDATE app_m01_svp_version
      SET
        status = 'ARCHIVED'::"M01SvpVersionStatus",
        is_current = false,
        effective_to = ${effectiveFrom},
        updated_at = now()
      WHERE id = ${draft.parentSvpVersionId}
    `);
    await tx.$executeRaw(Prisma.sql`
      UPDATE app_m01_svp_version
      SET
        version_label = ${versionLabel},
        major = ${draft.major},
        minor = ${nextMinor},
        patch = ${nextPatch},
        zmena_type = ${finalChangeType}::"M01SvpZmenaType",
        status = 'ACTIVE'::"M01SvpVersionStatus",
        effective_from = ${effectiveFrom},
        effective_to = NULL,
        approved_at = now(),
        approved_by_person_id = ${changedByPersonId},
        is_current = true,
        updated_at = now()
      WHERE id = ${draft.id}
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO app_m01_svp_version_change (
        id,
        svp_version_id,
        parent_svp_version_id,
        change_type,
        version_label,
        effective_from,
        changed_by_person_id,
        summary,
        created_at
      )
      VALUES (
        ${id("m01-svp-change")},
        ${draft.id},
        ${draft.parentSvpVersionId},
        ${finalChangeType}::"M01SvpZmenaType",
        ${versionLabel},
        ${effectiveFrom},
        ${changedByPersonId},
        CAST(${JSON.stringify(summary)} AS jsonb),
        now()
      )
    `);
  });

  revalidatePath("/portal/lodicky/sprava");
  revalidatePath("/portal/lodicky/sprava/rvp");
  redirect(appendStatusParam(`/portal/lodicky/sprava?svp=${encodeURIComponent(draft.id)}&tab=struktura`, "saved", "published"));
}

async function validOvuIds(lodickaId: string, ovuIds: string[], stupen: "I_STUPEN" | "II_STUPEN"): Promise<Set<string>> {
  if (ovuIds.length === 0) return new Set();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT o.id
    FROM app_m01_rvp_ovu o
    JOIN app_m01_rvp_uzlovy_bod ub ON ub.id = o.uzlovy_bod_id AND ub.stage_code = ${stupen}
    JOIN app_m01_svp_version svp ON svp.based_on_rvp_version_id = o.rvp_version_id
    JOIN app_m01_lodicka l ON l.svp_version_id = svp.id
    WHERE l.id = ${lodickaId}
      AND o.id IN (${Prisma.join([...new Set(ovuIds)])})
  `);
  return new Set(rows.map((row) => row.id));
}

async function validPruvodcePersonIds(personIds: string[]): Promise<Set<string>> {
  if (personIds.length === 0) return new Set();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT DISTINCT p.id
    FROM app_person p
    JOIN app_role_assignment ra
      ON ra.person_id = p.id
      AND ra.role = 'pruvodce'
      AND ra.is_active = true
    WHERE p.is_active = true
      AND p.id IN (${Prisma.join([...new Set(personIds)])})
  `);
  return new Set(rows.map((row) => row.id));
}

async function getM01AssignmentPersonIds(
  tx: Prisma.TransactionClient,
  input: {
    oblastIds?: string[];
    lodickaIds?: string[];
  },
): Promise<string[]> {
  const oblastIds = [...new Set(input.oblastIds?.filter(Boolean) ?? [])];
  const lodickaIds = [...new Set(input.lodickaIds?.filter(Boolean) ?? [])];
  const personIds = new Set<string>();

  if (oblastIds.length > 0) {
    const rows = await tx.$queryRaw<Array<{ personId: string }>>(Prisma.sql`
      SELECT DISTINCT person_id AS "personId"
      FROM app_m01_oblast_spravce
      WHERE oblast_id IN (${Prisma.join(oblastIds)})
    `);
    for (const row of rows) personIds.add(row.personId);
  }

  if (lodickaIds.length > 0) {
    const rows = await tx.$queryRaw<Array<{ personId: string }>>(Prisma.sql`
      SELECT DISTINCT person_id AS "personId"
      FROM (
        SELECT person_id
        FROM app_m01_lodicka_stav_garant
        WHERE lodicka_id IN (${Prisma.join(lodickaIds)})
        UNION
        SELECT person_id
        FROM app_m01_lodicka_garant
        WHERE lodicka_id IN (${Prisma.join(lodickaIds)})
        UNION
        SELECT garant_person_id AS person_id
        FROM app_m01_lodicka
        WHERE id IN (${Prisma.join(lodickaIds)})
          AND garant_person_id IS NOT NULL
      ) people
    `);
    for (const row of rows) personIds.add(row.personId);
  }

  return [...personIds];
}

async function validateClassification(input: {
  svpVersionId: string;
  stupen: "I_STUPEN" | "II_STUPEN";
  predmetId: string;
  podpredmetId: string;
  oblastId: string;
}): Promise<boolean> {
  if (!input.predmetId || !input.oblastId) return false;

  const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM app_m01_predmet pr
      JOIN app_m01_oblast ob
        ON ob.id = ${input.oblastId}
        AND ob.svp_version_id = pr.svp_version_id
        AND ob.predmet_id = pr.id
        AND ob.stupen::text = ${input.stupen}
      LEFT JOIN app_m01_podpredmet pp
        ON pp.id = ${input.podpredmetId || null}
        AND pp.svp_version_id = pr.svp_version_id
        AND pp.predmet_id = pr.id
        AND pp.stupen::text = ${input.stupen}
      WHERE pr.id = ${input.predmetId}
        AND pr.svp_version_id = ${input.svpVersionId}
        AND pr.stupen::text = ${input.stupen}
        AND pr.is_active = true
        AND ob.is_active = true
        AND (
          (${input.podpredmetId || null}::text IS NULL AND ob.podpredmet_id IS NULL)
          OR (
            pp.id IS NOT NULL
            AND ob.podpredmet_id = pp.id
          )
        )
    ) AS ok
  `);

  return Boolean(rows[0]?.ok);
}

async function getClassificationInfo(input: {
  svpVersionId: string;
  stupen: "I_STUPEN" | "II_STUPEN";
  predmetId: string;
  podpredmetId: string;
  oblastId: string;
}): Promise<ClassificationInfo | null> {
  const rows = await prisma.$queryRaw<ClassificationInfo[]>(Prisma.sql`
    SELECT
      pr.kod AS "predmetKod",
      pp.kod AS "podpredmetKod",
      ob.kod AS "oblastKod"
    FROM app_m01_predmet pr
    JOIN app_m01_oblast ob
      ON ob.id = ${input.oblastId}
      AND ob.svp_version_id = pr.svp_version_id
      AND ob.predmet_id = pr.id
      AND ob.stupen::text = ${input.stupen}
    LEFT JOIN app_m01_podpredmet pp
      ON pp.id = ${input.podpredmetId || null}
      AND pp.svp_version_id = pr.svp_version_id
      AND pp.predmet_id = pr.id
      AND pp.stupen::text = ${input.stupen}
    WHERE pr.id = ${input.predmetId}
      AND pr.svp_version_id = ${input.svpVersionId}
      AND pr.stupen::text = ${input.stupen}
      AND pr.is_active = true
      AND ob.is_active = true
      AND (
        (${input.podpredmetId || null}::text IS NULL AND ob.podpredmet_id IS NULL)
        OR (
          pp.id IS NOT NULL
          AND ob.podpredmet_id = pp.id
        )
      )
    LIMIT 1
  `);

  return rows[0] ?? null;
}

function normalizeCodePart(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);
  return normalized || fallback;
}

async function generateLodickaCode(input: {
  svpVersionId: string;
  rocnikDo: number;
  classification: ClassificationInfo;
}): Promise<string> {
  const svpRows = await prisma.$queryRaw<Array<{ effectiveYear: number }>>(Prisma.sql`
    SELECT EXTRACT(YEAR FROM effective_from)::int AS "effectiveYear"
    FROM app_m01_svp_version
    WHERE id = ${input.svpVersionId}
    LIMIT 1
  `);
  const year = svpRows[0]?.effectiveYear ?? new Date().getFullYear();
  const predmetKod = normalizeCodePart(input.classification.predmetKod, "PRED");
  const areaKod = normalizeCodePart(
    input.classification.podpredmetKod ?? input.classification.oblastKod ?? input.classification.predmetKod,
    predmetKod,
  );
  const prefix = `${year}-${predmetKod}-${areaKod}-${input.rocnikDo}`;
  const rows = await prisma.$queryRaw<Array<{ kod: string }>>(Prisma.sql`
    SELECT kod
    FROM app_m01_lodicka
    WHERE svp_version_id = ${input.svpVersionId}
      AND kod LIKE ${`${prefix}-%`}
    ORDER BY kod DESC
    LIMIT 1
  `);
  const lastSequence = Number.parseInt(rows[0]?.kod.split("-").at(-1) ?? "0", 10);
  const nextSequence = Number.isInteger(lastSequence) ? lastSequence + 1 : 1;
  return `${prefix}-${String(nextSequence).padStart(3, "0")}`;
}

export async function updateSvpVersionManagementAction(formData: FormData) {
  const svpVersionId = readString(formData, "svpVersionId");
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava";
  const access = await getActionAccess();

  if (!svpVersionId || !canManageWholeFleet(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }
  await ensureDraftSvpVersion(svpVersionId, returnTo);

  const label = readString(formData, "label");
  const basedOnRvpVersionId = readString(formData, "basedOnRvpVersionId");
  const effectiveFrom = parseDateInput(readString(formData, "effectiveFrom"));
  const rawEffectiveTo = readString(formData, "effectiveTo");
  const effectiveTo = rawEffectiveTo ? parseDateInput(rawEffectiveTo) : null;
  const notes = readString(formData, "notes");

  if (!label || !basedOnRvpVersionId || !effectiveFrom || (rawEffectiveTo && !effectiveTo)) {
    redirect(appendStatusParam(returnTo, "error", "invalid-svp"));
  }

  if (effectiveTo && effectiveTo < effectiveFrom) {
    redirect(appendStatusParam(returnTo, "error", "invalid-svp"));
  }

  const [existingLabelRows, rvpRows, conflictRows] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM app_m01_svp_version
      WHERE label = ${label}
        AND id <> ${svpVersionId}
      LIMIT 1
    `),
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM app_m01_rvp_version
      WHERE id = ${basedOnRvpVersionId}
      LIMIT 1
    `),
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT count(*)::int AS count
      FROM app_m01_lodicka l
      JOIN app_m01_lodicka_ovu_link link ON link.lodicka_id = l.id
      JOIN app_m01_rvp_ovu o ON o.id = link.rvp_ovu_id
      WHERE l.svp_version_id = ${svpVersionId}
        AND o.rvp_version_id <> ${basedOnRvpVersionId}
    `),
  ]);

  if (existingLabelRows.length > 0) {
    redirect(appendStatusParam(returnTo, "error", "duplicate-svp-label"));
  }

  if (rvpRows.length === 0) {
    redirect(appendStatusParam(returnTo, "error", "invalid-rvp"));
  }

  if ((conflictRows[0]?.count ?? 0) > 0) {
    redirect(appendStatusParam(returnTo, "error", "rvp-ovu-conflict"));
  }

  await prisma.$executeRaw(Prisma.sql`
    UPDATE app_m01_svp_version
    SET
      label = ${label},
      based_on_rvp_version_id = ${basedOnRvpVersionId},
      effective_from = ${effectiveFrom},
      effective_to = ${effectiveTo},
      notes = ${notes || null},
      updated_at = now()
    WHERE id = ${svpVersionId}
  `);

  revalidatePath("/portal/lodicky/sprava");
  revalidatePath("/portal/lodicky/sprava/rvp");
  redirect(appendStatusParam(returnTo, "saved", "svp"));
}

export async function updateOblastSpravciManagementAction(formData: FormData) {
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava";
  const access = await getActionAccess();

  if (!canManageWholeFleet(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }

  const svpVersionId = readString(formData, "svpVersionId");
  const oblastIds = [...new Set([...readStringList(formData, "oblastIds"), readString(formData, "oblastId")].filter(Boolean))];
  const mode = readString(formData, "mode");
  const requestedSpravceIds = [...new Set(readStringList(formData, "spravcePersonIds"))];
  const ownPersonIds = [...new Set(access.personIds.map((personId) => personId.trim()).filter(Boolean))];

  if (!svpVersionId || oblastIds.length === 0 || oblastIds.length > 100 || (mode !== "add" && mode !== "replace" && mode !== "remove")) {
    redirect(appendStatusParam(returnTo, "error", "invalid-oblast-spravci"));
  }

  if ((mode === "add" || mode === "remove") && requestedSpravceIds.length === 0) {
    redirect(appendStatusParam(returnTo, "error", "invalid-oblast-spravci"));
  }

  const [oblastRows, validSpravci] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM app_m01_oblast
      WHERE id IN (${Prisma.join(oblastIds)})
        AND svp_version_id = ${svpVersionId}
        AND is_active = true
    `),
    requestedSpravceIds.length > 0
      ? validPruvodcePersonIds(requestedSpravceIds)
      : Promise.resolve(new Set<string>()),
  ]);

  if (oblastRows.length !== oblastIds.length || validSpravci.size !== requestedSpravceIds.length) {
    redirect(appendStatusParam(returnTo, "error", "invalid-oblast-spravci"));
  }

  if (mode === "remove" && ownPersonIds.some((personId) => requestedSpravceIds.includes(personId))) {
    redirect(appendStatusParam(returnTo, "error", "self-spravce-remove"));
  }

  await prisma.$transaction(async (tx) => {
    const affectedPersonIds = new Set<string>([
      ...requestedSpravceIds,
      ...(await getM01AssignmentPersonIds(tx, { oblastIds })),
    ]);
    const preservedOwnRows = mode === "replace" && ownPersonIds.length > 0
      ? await tx.$queryRaw<Array<{ oblastId: string; personId: string; isPrimary: boolean }>>(Prisma.sql`
          SELECT oblast_id AS "oblastId", person_id AS "personId", is_primary AS "isPrimary"
          FROM app_m01_oblast_spravce
          WHERE oblast_id IN (${Prisma.join(oblastIds)})
            AND person_id IN (${Prisma.join(ownPersonIds)})
        `)
      : [];

    if (mode === "replace") {
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM app_m01_oblast_spravce
        WHERE oblast_id IN (${Prisma.join(oblastIds)})
      `);
    }

    if (mode === "remove" && requestedSpravceIds.length > 0) {
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM app_m01_oblast_spravce
        WHERE oblast_id IN (${Prisma.join(oblastIds)})
          AND person_id IN (${Prisma.join(requestedSpravceIds)})
      `);
    }

    if (mode === "add" || mode === "replace") {
      for (const oblastId of oblastIds) {
        const preservedForOblast = preservedOwnRows.filter((row) => row.oblastId === oblastId);
        const finalSpravceIds = mode === "replace"
          ? [...new Set([...requestedSpravceIds, ...preservedForOblast.map((row) => row.personId)])]
          : requestedSpravceIds;
        for (const personId of finalSpravceIds) affectedPersonIds.add(personId);
        for (const [index, personId] of finalSpravceIds.entries()) {
          const preservedOwnRow = preservedForOblast.find((row) => row.personId === personId);
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO app_m01_oblast_spravce (id, oblast_id, person_id, is_primary, created_at)
            VALUES (${id("m01-oblast-spravce")}, ${oblastId}, ${personId}, ${preservedOwnRow?.isPrimary ?? index === 0}, now())
            ON CONFLICT (oblast_id, person_id) DO UPDATE
            SET is_primary = app_m01_oblast_spravce.is_primary OR EXCLUDED.is_primary
          `);
        }
      }
    }

    await syncM01DerivedRolesForPersons(tx, [...affectedPersonIds]);
  });

  revalidatePath("/portal/lodicky/sprava");
  redirect(appendStatusParam(returnTo, "saved", "oblast-spravci"));
}

async function getPredmetForTaxonomy(input: {
  predmetId: string;
  svpVersionId: string;
}): Promise<{ id: string; stupen: "I_STUPEN" | "II_STUPEN" } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; stupen: "I_STUPEN" | "II_STUPEN" }>>(Prisma.sql`
    SELECT id, stupen::text AS stupen
    FROM app_m01_predmet
    WHERE id = ${input.predmetId}
      AND svp_version_id = ${input.svpVersionId}
      AND is_active = true
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function getPodpredmetForTaxonomy(input: {
  podpredmetId: string;
  predmetId: string;
  svpVersionId: string;
  stupen: "I_STUPEN" | "II_STUPEN";
}): Promise<{ id: string } | null> {
  if (!input.podpredmetId) return null;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM app_m01_podpredmet
    WHERE id = ${input.podpredmetId}
      AND svp_version_id = ${input.svpVersionId}
      AND predmet_id = ${input.predmetId}
      AND stupen::text = ${input.stupen}
      AND is_active = true
    LIMIT 1
  `);
  return rows[0] ?? null;
}

type OrderedTaxonomyRow = { id: string };
type TaxonomyDb = Pick<Prisma.TransactionClient, "$executeRaw" | "$queryRaw">;

function reorderedIds(existingIds: string[], movedId: string, insertAfterId: string): string[] {
  const withoutMoved = existingIds.filter((idValue) => idValue !== movedId);
  if (!insertAfterId || insertAfterId === "__start__") return [movedId, ...withoutMoved];
  const index = withoutMoved.indexOf(insertAfterId);
  if (index < 0) return [...withoutMoved, movedId];
  return [
    ...withoutMoved.slice(0, index + 1),
    movedId,
    ...withoutMoved.slice(index + 1),
  ];
}

async function rewritePredmetOrder(db: TaxonomyDb, orderedIds: string[]) {
  for (const [index, predmetId] of orderedIds.entries()) {
    await db.$executeRaw(Prisma.sql`
      UPDATE app_m01_predmet
      SET poradi = ${(index + 1) * 10}, updated_at = now()
      WHERE id = ${predmetId}
    `);
  }
}

async function rewritePodpredmetOrder(db: TaxonomyDb, orderedIds: string[]) {
  for (const [index, podpredmetId] of orderedIds.entries()) {
    await db.$executeRaw(Prisma.sql`
      UPDATE app_m01_podpredmet
      SET poradi = ${(index + 1) * 10}, updated_at = now()
      WHERE id = ${podpredmetId}
    `);
  }
}

async function rewriteOblastOrder(db: TaxonomyDb, orderedIds: string[]) {
  for (const [index, oblastId] of orderedIds.entries()) {
    await db.$executeRaw(Prisma.sql`
      UPDATE app_m01_oblast
      SET poradi = ${(index + 1) * 10}, updated_at = now()
      WHERE id = ${oblastId}
    `);
  }
}

async function getPredmetSiblingIds(db: TaxonomyDb, input: {
  svpVersionId: string;
  stupen: "I_STUPEN" | "II_STUPEN";
}) {
  const rows = await db.$queryRaw<OrderedTaxonomyRow[]>(Prisma.sql`
    SELECT id
    FROM app_m01_predmet
    WHERE svp_version_id = ${input.svpVersionId}
      AND stupen::text = ${input.stupen}
      AND is_active = true
    ORDER BY poradi ASC NULLS LAST, nazev ASC, id ASC
  `);
  return rows.map((row) => row.id);
}

async function getPodpredmetSiblingIds(db: TaxonomyDb, input: {
  svpVersionId: string;
  predmetId: string;
}) {
  const rows = await db.$queryRaw<OrderedTaxonomyRow[]>(Prisma.sql`
    SELECT id
    FROM app_m01_podpredmet
    WHERE svp_version_id = ${input.svpVersionId}
      AND predmet_id = ${input.predmetId}
      AND is_active = true
    ORDER BY poradi ASC NULLS LAST, nazev ASC, id ASC
  `);
  return rows.map((row) => row.id);
}

async function getOblastSiblingIds(db: TaxonomyDb, input: {
  svpVersionId: string;
  predmetId: string;
  podpredmetId: string | null;
}) {
  const rows = await db.$queryRaw<OrderedTaxonomyRow[]>(Prisma.sql`
    SELECT id
    FROM app_m01_oblast
    WHERE svp_version_id = ${input.svpVersionId}
      AND predmet_id = ${input.predmetId}
      AND (
        (${input.podpredmetId}::text IS NULL AND podpredmet_id IS NULL)
        OR podpredmet_id = ${input.podpredmetId}
      )
      AND is_active = true
    ORDER BY poradi ASC NULLS LAST, nazev ASC, id ASC
  `);
  return rows.map((row) => row.id);
}

export async function upsertTaxonomyManagementAction(formData: FormData) {
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava?tab=struktura";
  const access = await getActionAccess();

  if (!canManageWholeFleet(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }

  const svpVersionId = readString(formData, "svpVersionId");
  const itemType = readString(formData, "itemType");
  const itemId = readString(formData, "itemId");
  const insertAfterId = readString(formData, "insertAfterId");
  const kod = readString(formData, "kod") || null;
  const nazev = readString(formData, "nazev");

  if (!svpVersionId || !nazev) {
    redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
  }

  const svpRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM app_m01_svp_version
    WHERE id = ${svpVersionId}
    LIMIT 1
  `);
  if (svpRows.length === 0) {
    redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
  }
  await ensureDraftSvpVersion(svpVersionId, returnTo);

  if (itemType === "predmet") {
    const stupen = parseStupen(readString(formData, "stupen"));
    if (!stupen) {
      redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
    }

    const duplicateRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM app_m01_predmet
      WHERE svp_version_id = ${svpVersionId}
        AND stupen::text = ${stupen}
        AND id <> ${itemId || "__new__"}
        AND (
          nazev = ${nazev}
          OR (${kod}::text IS NOT NULL AND kod = ${kod})
        )
      LIMIT 1
    `);
    if (duplicateRows.length > 0) {
      redirect(appendStatusParam(returnTo, "error", "duplicate-taxonomy"));
    }

    if (itemId) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE app_m01_predmet
        SET kod = ${kod}, nazev = ${nazev}, updated_at = now()
        WHERE id = ${itemId}
          AND svp_version_id = ${svpVersionId}
      `);
    } else {
      const newPredmetId = id("m01-predmet");
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO app_m01_predmet (id, svp_version_id, kod, nazev, stupen, poradi, is_active, created_at, updated_at)
          VALUES (${newPredmetId}, ${svpVersionId}, ${kod}, ${nazev}, ${stupen}::"M01Stupen", 9999, true, now(), now())
        `);
        const siblingIds = await getPredmetSiblingIds(tx, { svpVersionId, stupen });
        await rewritePredmetOrder(tx, reorderedIds(siblingIds, newPredmetId, insertAfterId));
      });
    }
  } else if (itemType === "podpredmet") {
    const predmetId = readString(formData, "predmetId");
    const predmet = await getPredmetForTaxonomy({ predmetId, svpVersionId });
    if (!predmet) {
      redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
    }

    const duplicateRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM app_m01_podpredmet
      WHERE svp_version_id = ${svpVersionId}
        AND id <> ${itemId || "__new__"}
        AND (
          (predmet_id = ${predmet.id} AND nazev = ${nazev})
          OR (${kod}::text IS NOT NULL AND stupen::text = ${predmet.stupen} AND kod = ${kod})
        )
      LIMIT 1
    `);
    if (duplicateRows.length > 0) {
      redirect(appendStatusParam(returnTo, "error", "duplicate-taxonomy"));
    }

    if (itemId) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE app_m01_podpredmet
        SET kod = ${kod}, nazev = ${nazev}, updated_at = now()
        WHERE id = ${itemId}
          AND svp_version_id = ${svpVersionId}
      `);
    } else {
      const newPodpredmetId = id("m01-podpredmet");
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO app_m01_podpredmet (id, svp_version_id, predmet_id, kod, nazev, stupen, poradi, is_active, created_at, updated_at)
          VALUES (${newPodpredmetId}, ${svpVersionId}, ${predmet.id}, ${kod}, ${nazev}, ${predmet.stupen}::"M01Stupen", 9999, true, now(), now())
        `);
        const siblingIds = await getPodpredmetSiblingIds(tx, { svpVersionId, predmetId: predmet.id });
        await rewritePodpredmetOrder(tx, reorderedIds(siblingIds, newPodpredmetId, insertAfterId));
      });
    }
  } else if (itemType === "oblast") {
    const predmetId = readString(formData, "predmetId");
    const podpredmetId = readString(formData, "podpredmetId");
    const predmet = await getPredmetForTaxonomy({ predmetId, svpVersionId });
    if (!predmet) {
      redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
    }
    const podpredmet = podpredmetId
      ? await getPodpredmetForTaxonomy({ podpredmetId, predmetId: predmet.id, svpVersionId, stupen: predmet.stupen })
      : null;
    if (podpredmetId && !podpredmet) {
      redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
    }

    const currentOblastRows = itemId
      ? await prisma.$queryRaw<Array<{ id: string; stupen: "I_STUPEN" | "II_STUPEN"; lodickyCount: number }>>(Prisma.sql`
          SELECT
            ob.id,
            ob.stupen::text AS stupen,
            count(l.id)::int AS "lodickyCount"
          FROM app_m01_oblast ob
          LEFT JOIN app_m01_lodicka l ON l.oblast_id = ob.id AND l.is_deleted = false
          WHERE ob.id = ${itemId}
            AND ob.svp_version_id = ${svpVersionId}
          GROUP BY ob.id
          LIMIT 1
        `)
      : [];
    const currentOblast = currentOblastRows[0] ?? null;
    if (itemId && !currentOblast) {
      redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
    }
    if (currentOblast && currentOblast.lodickyCount > 0 && currentOblast.stupen !== predmet.stupen) {
      redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
    }

    const duplicateRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM app_m01_oblast
      WHERE svp_version_id = ${svpVersionId}
        AND id <> ${itemId || "__new__"}
        AND (
          (${kod}::text IS NOT NULL AND stupen::text = ${predmet.stupen} AND kod = ${kod})
          OR (
            predmet_id = ${predmet.id}
            AND (
              (${podpredmet?.id ?? null}::text IS NULL AND podpredmet_id IS NULL)
              OR podpredmet_id = ${podpredmet?.id ?? null}
            )
            AND nazev = ${nazev}
          )
        )
      LIMIT 1
    `);
    if (duplicateRows.length > 0) {
      redirect(appendStatusParam(returnTo, "error", "duplicate-taxonomy"));
    }

    if (itemId) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`
          UPDATE app_m01_oblast
          SET
            predmet_id = ${predmet.id},
            podpredmet_id = ${podpredmet?.id ?? null},
            kod = ${kod},
            nazev = ${nazev},
            stupen = ${predmet.stupen}::"M01Stupen",
            updated_at = now()
          WHERE id = ${itemId}
            AND svp_version_id = ${svpVersionId}
        `);
        await tx.$executeRaw(Prisma.sql`
          UPDATE app_m01_lodicka
          SET
            predmet_id = ${predmet.id},
            podpredmet_id = ${podpredmet?.id ?? null},
            stupen = ${predmet.stupen}::"M01Stupen",
            updated_at = now()
          WHERE oblast_id = ${itemId}
            AND svp_version_id = ${svpVersionId}
            AND is_deleted = false
        `);
      });
    } else {
      const newOblastId = id("m01-oblast");
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO app_m01_oblast (id, svp_version_id, predmet_id, podpredmet_id, kod, nazev, stupen, poradi, is_active, created_at, updated_at)
          VALUES (${newOblastId}, ${svpVersionId}, ${predmet.id}, ${podpredmet?.id ?? null}, ${kod}, ${nazev}, ${predmet.stupen}::"M01Stupen", 9999, true, now(), now())
        `);
        const siblingIds = await getOblastSiblingIds(tx, {
          svpVersionId,
          predmetId: predmet.id,
          podpredmetId: podpredmet?.id ?? null,
        });
        await rewriteOblastOrder(tx, reorderedIds(siblingIds, newOblastId, insertAfterId));
      });
    }
  } else {
    redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
  }

  revalidatePath("/portal/lodicky/sprava");
  redirect(appendStatusParam(returnTo, "saved", "taxonomy"));
}

export async function moveTaxonomyManagementAction(formData: FormData) {
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava?tab=struktura";
  const access = await getActionAccess();

  if (!canManageWholeFleet(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }

  const svpVersionId = readString(formData, "svpVersionId");
  const itemType = readString(formData, "itemType");
  const itemId = readString(formData, "itemId");
  const insertAfterId = readString(formData, "insertAfterId");

  if (!svpVersionId || !itemId || (itemType !== "predmet" && itemType !== "podpredmet" && itemType !== "oblast")) {
    redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
  }
  await ensureDraftSvpVersion(svpVersionId, returnTo);

  if (itemType === "predmet") {
    const rows = await prisma.$queryRaw<Array<{ id: string; stupen: "I_STUPEN" | "II_STUPEN" }>>(Prisma.sql`
      SELECT id, stupen::text AS stupen
      FROM app_m01_predmet
      WHERE id = ${itemId}
        AND svp_version_id = ${svpVersionId}
        AND is_active = true
      LIMIT 1
    `);
    const predmet = rows[0] ?? null;
    if (!predmet) {
      redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
    }
    await prisma.$transaction(async (tx) => {
      const siblingIds = await getPredmetSiblingIds(tx, { svpVersionId, stupen: predmet.stupen });
      await rewritePredmetOrder(tx, reorderedIds(siblingIds, itemId, insertAfterId));
    });
  } else if (itemType === "podpredmet") {
    const rows = await prisma.$queryRaw<Array<{ id: string; predmetId: string }>>(Prisma.sql`
      SELECT id, predmet_id AS "predmetId"
      FROM app_m01_podpredmet
      WHERE id = ${itemId}
        AND svp_version_id = ${svpVersionId}
        AND is_active = true
      LIMIT 1
    `);
    const podpredmet = rows[0] ?? null;
    if (!podpredmet) {
      redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
    }
    await prisma.$transaction(async (tx) => {
      const siblingIds = await getPodpredmetSiblingIds(tx, { svpVersionId, predmetId: podpredmet.predmetId });
      await rewritePodpredmetOrder(tx, reorderedIds(siblingIds, itemId, insertAfterId));
    });
  } else {
    const targetPredmetId = readString(formData, "targetPredmetId");
    const targetPodpredmetId = readString(formData, "targetPodpredmetId");
    const targetPredmet = await getPredmetForTaxonomy({ predmetId: targetPredmetId, svpVersionId });
    if (!targetPredmet) {
      redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
    }
    const targetPodpredmet = targetPodpredmetId
      ? await getPodpredmetForTaxonomy({
          podpredmetId: targetPodpredmetId,
          predmetId: targetPredmet.id,
          svpVersionId,
          stupen: targetPredmet.stupen,
        })
      : null;
    if (targetPodpredmetId && !targetPodpredmet) {
      redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
    }

    const rows = await prisma.$queryRaw<Array<{ id: string; stupen: "I_STUPEN" | "II_STUPEN"; lodickyCount: number }>>(Prisma.sql`
      SELECT
        ob.id,
        ob.stupen::text AS stupen,
        count(l.id)::int AS "lodickyCount"
      FROM app_m01_oblast ob
      LEFT JOIN app_m01_lodicka l ON l.oblast_id = ob.id AND l.is_deleted = false
      WHERE ob.id = ${itemId}
        AND ob.svp_version_id = ${svpVersionId}
        AND ob.is_active = true
      GROUP BY ob.id
      LIMIT 1
    `);
    const oblast = rows[0] ?? null;
    if (!oblast || (oblast.lodickyCount > 0 && oblast.stupen !== targetPredmet.stupen)) {
      redirect(appendStatusParam(returnTo, "error", "invalid-taxonomy"));
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        UPDATE app_m01_oblast
        SET
          predmet_id = ${targetPredmet.id},
          podpredmet_id = ${targetPodpredmet?.id ?? null},
          stupen = ${targetPredmet.stupen}::"M01Stupen",
          updated_at = now()
        WHERE id = ${itemId}
          AND svp_version_id = ${svpVersionId}
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE app_m01_lodicka
        SET
          predmet_id = ${targetPredmet.id},
          podpredmet_id = ${targetPodpredmet?.id ?? null},
          stupen = ${targetPredmet.stupen}::"M01Stupen",
          updated_at = now()
        WHERE oblast_id = ${itemId}
          AND svp_version_id = ${svpVersionId}
          AND is_deleted = false
      `);
      const siblingIds = await getOblastSiblingIds(tx, {
        svpVersionId,
        predmetId: targetPredmet.id,
        podpredmetId: targetPodpredmet?.id ?? null,
      });
      await rewriteOblastOrder(tx, reorderedIds(siblingIds, itemId, insertAfterId));
    });
  }

  revalidatePath("/portal/lodicky/sprava");
  redirect(appendStatusParam(returnTo, "saved", "taxonomy"));
}

export async function moveTaxonomyLodickaAction(formData: FormData) {
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava?tab=struktura";
  const access = await getActionAccess();

  if (!canManageWholeFleet(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }

  const svpVersionId = readString(formData, "svpVersionId");
  const lodickaId = readString(formData, "lodickaId");
  const targetOblastId = readString(formData, "targetOblastId");

  if (!svpVersionId || !lodickaId || !targetOblastId) {
    redirect(appendStatusParam(returnTo, "error", "invalid-classification"));
  }
  await ensureDraftSvpVersion(svpVersionId, returnTo);

  const rows = await prisma.$queryRaw<Array<{
    lodickaId: string;
    rocnikOd: number;
    rocnikDo: number;
    targetStupen: "I_STUPEN" | "II_STUPEN";
    targetPredmetId: string;
    targetPodpredmetId: string | null;
  }>>(Prisma.sql`
    SELECT
      l.id AS "lodickaId",
      l.rocnik_od AS "rocnikOd",
      l.rocnik_do AS "rocnikDo",
      ob.stupen::text AS "targetStupen",
      ob.predmet_id AS "targetPredmetId",
      ob.podpredmet_id AS "targetPodpredmetId"
    FROM app_m01_lodicka l
    JOIN app_m01_oblast ob
      ON ob.id = ${targetOblastId}
      AND ob.svp_version_id = l.svp_version_id
      AND ob.is_active = true
    WHERE l.id = ${lodickaId}
      AND l.svp_version_id = ${svpVersionId}
      AND l.is_deleted = false
    LIMIT 1
  `);
  const row = rows[0] ?? null;
  if (!row || !gradeRangeMatchesStupen(row.targetStupen, row.rocnikOd, row.rocnikDo)) {
    redirect(appendStatusParam(returnTo, "error", "invalid-grade-range"));
  }

  await prisma.$executeRaw(Prisma.sql`
    UPDATE app_m01_lodicka
    SET
      predmet_id = ${row.targetPredmetId},
      podpredmet_id = ${row.targetPodpredmetId},
      oblast_id = ${targetOblastId},
      stupen = ${row.targetStupen}::"M01Stupen",
      updated_at = now()
    WHERE id = ${lodickaId}
      AND svp_version_id = ${svpVersionId}
      AND is_deleted = false
  `);

  revalidatePath("/portal/lodicky/sprava");
  redirect(appendStatusParam(returnTo, "saved", "taxonomy"));
}

export async function updateTaxonomyLodickaDetailAction(formData: FormData) {
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava?tab=struktura";
  const access = await getActionAccess();
  if (!canManageLodicky(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }

  const lodickaId = readString(formData, "lodickaId");
  const context = await getLodickaSvpContext(lodickaId);
  if (!context || !(await verifyCanEditLodicka({ lodickaId, access }))) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }

  const popis = readString(formData, "popis");
  const wholeFleet = canManageWholeFleet(access.roles);
  if (!wholeFleet) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE app_m01_lodicka
      SET popis = ${popis || null}, updated_at = now()
      WHERE id = ${lodickaId}
    `);
    revalidatePath("/portal/lodicky/sprava");
    revalidatePath(`/portal/lodicky/sprava/${lodickaId}`);
    redirect(appendStatusParam(returnTo, "saved", "1"));
  }
  await ensureDraftSvpVersion(context.svpVersionId, returnTo);

  const rocnikOd = parseGrade(readString(formData, "rocnikOd"));
  const rocnikDo = parseGrade(readString(formData, "rocnikDo"));
  const stupen = parseStupen(context.stupen);
  if (!stupen || rocnikOd === null || rocnikDo === null || rocnikOd > rocnikDo || !gradeRangeMatchesStupen(stupen, rocnikOd, rocnikDo)) {
    redirect(appendStatusParam(returnTo, "error", "invalid-grade-range"));
  }

  const ovuNotApplicable = readString(formData, "ovuNotApplicable") === "1";
  const requestedOvuIds = ovuNotApplicable ? [] : [...new Set(readStringList(formData, "ovuIds"))];
  const allowedOvuIds = await validOvuIds(lodickaId, requestedOvuIds, stupen);
  if (allowedOvuIds.size !== requestedOvuIds.length) {
    redirect(appendStatusParam(returnTo, "error", "invalid-ovu"));
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      UPDATE app_m01_lodicka
      SET
        popis = ${popis || null},
        rocnik_od = ${rocnikOd},
        rocnik_do = ${rocnikDo},
        ovu_not_applicable = ${ovuNotApplicable},
        updated_at = now()
      WHERE id = ${lodickaId}
    `);
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM app_m01_lodicka_ovu_link
      WHERE lodicka_id = ${lodickaId}
    `);
    for (const ovuId of requestedOvuIds) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO app_m01_lodicka_ovu_link (id, lodicka_id, rvp_ovu_id, source_ovu_code, is_primary, created_at)
        VALUES (${id("m01-lodicka-ovu")}, ${lodickaId}, ${ovuId}, NULL, true, now())
        ON CONFLICT (lodicka_id, rvp_ovu_id) DO NOTHING
      `);
    }
  });

  revalidatePath("/portal/lodicky/sprava");
  revalidatePath(`/portal/lodicky/sprava/${lodickaId}`);
  redirect(appendStatusParam(returnTo, "saved", "1"));
}

export async function updateTaxonomyOblastPeopleAction(formData: FormData) {
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava?tab=struktura";
  const access = await getActionAccess();
  if (!canManageWholeFleet(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }

  const svpVersionId = readString(formData, "svpVersionId");
  const oblastId = readString(formData, "oblastId");
  const requestedSpravceIds = [...new Set(readStringList(formData, "spravcePersonIds"))];
  const requestedGarantIds = [...new Set(readStringList(formData, "garantPersonIds"))];
  const [oblastRows, validSpravci, validGaranti] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM app_m01_oblast
      WHERE id = ${oblastId}
        AND svp_version_id = ${svpVersionId}
        AND is_active = true
      LIMIT 1
    `),
    requestedSpravceIds.length > 0 ? validPruvodcePersonIds(requestedSpravceIds) : Promise.resolve(new Set<string>()),
    requestedGarantIds.length > 0 ? validPruvodcePersonIds(requestedGarantIds) : Promise.resolve(new Set<string>()),
  ]);
  if (!svpVersionId || !oblastId || oblastRows.length === 0 || validSpravci.size !== requestedSpravceIds.length || validGaranti.size !== requestedGarantIds.length) {
    redirect(appendStatusParam(returnTo, "error", "invalid-oblast-spravci"));
  }

  await prisma.$transaction(async (tx) => {
    const affectedPersonIds = new Set<string>([
      ...requestedSpravceIds,
      ...requestedGarantIds,
      ...(await getM01AssignmentPersonIds(tx, { oblastIds: [oblastId] })),
    ]);
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM app_m01_oblast_spravce
      WHERE oblast_id = ${oblastId}
    `);
    for (const [index, personId] of requestedSpravceIds.entries()) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO app_m01_oblast_spravce (id, oblast_id, person_id, is_primary, created_at)
        VALUES (${id("m01-oblast-spravce")}, ${oblastId}, ${personId}, ${index === 0}, now())
        ON CONFLICT (oblast_id, person_id) DO UPDATE
        SET is_primary = EXCLUDED.is_primary
      `);
    }

    const lodicky = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM app_m01_lodicka
      WHERE oblast_id = ${oblastId}
        AND svp_version_id = ${svpVersionId}
        AND is_deleted = false
    `);
    const lodickaIds = lodicky.map((lodicka) => lodicka.id);
    if (lodickaIds.length > 0) {
      for (const personId of await getM01AssignmentPersonIds(tx, { lodickaIds })) {
        affectedPersonIds.add(personId);
      }
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM app_m01_lodicka_stav_garant
        WHERE lodicka_id IN (${Prisma.join(lodickaIds)})
      `);
      for (const lodickaId of lodickaIds) {
        for (const [index, personId] of requestedGarantIds.entries()) {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO app_m01_lodicka_stav_garant (id, lodicka_id, person_id, is_primary, created_at)
            VALUES (${id("m01-lodicka-stav-garant")}, ${lodickaId}, ${personId}, ${index === 0}, now())
            ON CONFLICT (lodicka_id, person_id) DO UPDATE
            SET is_primary = EXCLUDED.is_primary
          `);
        }
      }
      await tx.$executeRaw(Prisma.sql`
        UPDATE app_m01_lodicka
        SET garant_person_id = ${requestedGarantIds[0] || null}, updated_at = now()
        WHERE id IN (${Prisma.join(lodickaIds)})
      `);
    }

    await syncM01DerivedRolesForPersons(tx, [...affectedPersonIds]);
  });

  revalidatePath("/portal/lodicky/sprava");
  redirect(appendStatusParam(returnTo, "saved", "oblast-spravci"));
}

export async function createLodickaManagementAction(formData: FormData) {
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava";
  const access = await getActionAccess();
  if (!canManageWholeFleet(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }

  const svpVersionId = readString(formData, "svpVersionId");
  const nazev = readString(formData, "nazev");
  const popis = readString(formData, "popis");
  const stupen = parseStupen(readString(formData, "stupen"));
  const rocnikOd = parseGrade(readString(formData, "rocnikOd"));
  const rocnikDo = parseGrade(readString(formData, "rocnikDo"));
  const predmetId = readString(formData, "predmetId");
  const podpredmetId = readString(formData, "podpredmetId");
  const oblastId = readString(formData, "oblastId");
  const ovuNotApplicable = readString(formData, "ovuNotApplicable") === "1";
  const requestedOvuIds = ovuNotApplicable ? [] : [...new Set(readStringList(formData, "ovuIds"))];
  const requestedSpravceIds = [...new Set(readStringList(formData, "spravcePersonIds"))];
  const requestedGarantIds = [...new Set([...readStringList(formData, "garantPersonIds"), readString(formData, "garantPersonId")].filter(Boolean))];

  if (!svpVersionId || !nazev || !stupen || rocnikOd === null || rocnikDo === null || rocnikOd > rocnikDo) {
    redirect(appendStatusParam(returnTo, "error", "invalid"));
  }
  await ensureDraftSvpVersion(svpVersionId, returnTo);

  if (!gradeRangeMatchesStupen(stupen, rocnikOd, rocnikDo)) {
    redirect(appendStatusParam(returnTo, "error", "invalid-grade-range"));
  }

  const [svpRows, classificationIsValid, classification, validSpravci] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; rvpVersionId: string }>>(Prisma.sql`
      SELECT id, based_on_rvp_version_id AS "rvpVersionId"
      FROM app_m01_svp_version
      WHERE id = ${svpVersionId}
      LIMIT 1
    `),
    validateClassification({ svpVersionId, stupen, predmetId, podpredmetId, oblastId }),
    getClassificationInfo({ svpVersionId, stupen, predmetId, podpredmetId, oblastId }),
    validPruvodcePersonIds(requestedSpravceIds),
  ]);

  if (svpRows.length === 0 || !classificationIsValid || !classification) {
    redirect(appendStatusParam(returnTo, "error", "invalid-classification"));
  }

  if (validSpravci.size !== requestedSpravceIds.length) {
    redirect(appendStatusParam(returnTo, "error", "invalid-spravce"));
  }

  if (requestedGarantIds.length > 0) {
    const validGaranti = await validPruvodcePersonIds(requestedGarantIds);
    if (validGaranti.size !== requestedGarantIds.length) {
      redirect(appendStatusParam(returnTo, "error", "invalid-garant"));
    }
  }

  const allowedOvuRows = requestedOvuIds.length > 0
    ? await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT o.id
        FROM app_m01_rvp_ovu o
        JOIN app_m01_rvp_uzlovy_bod ub ON ub.id = o.uzlovy_bod_id AND ub.stage_code = ${stupen}
        WHERE o.rvp_version_id = ${svpRows[0].rvpVersionId}
          AND o.id IN (${Prisma.join(requestedOvuIds)})
      `)
    : [];
  if (allowedOvuRows.length !== requestedOvuIds.length) {
    redirect(appendStatusParam(returnTo, "error", "invalid-ovu"));
  }

  const lodickaId = id("m01-lodicka");
  const kod = await generateLodickaCode({ svpVersionId, rocnikDo, classification });

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO app_m01_lodicka (
        id,
        svp_version_id,
        predmet_id,
        podpredmet_id,
        oblast_id,
        kod,
        nazev,
        popis,
        typ,
        rocnik_od,
        rocnik_do,
        stupen,
        garant_person_id,
        ovu_not_applicable,
        is_deleted,
        created_at,
        updated_at
      )
      VALUES (
        ${lodickaId},
        ${svpVersionId},
        ${predmetId},
        ${podpredmetId || null},
        ${oblastId},
        ${kod},
        ${nazev},
        ${popis || null},
        'INDIVIDUALNI'::"M01LodickaTyp",
        ${rocnikOd},
        ${rocnikDo},
        ${stupen}::"M01Stupen",
        ${requestedGarantIds[0] || null},
        ${ovuNotApplicable},
        false,
        now(),
        now()
      )
    `);

    for (const ovuId of requestedOvuIds) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO app_m01_lodicka_ovu_link (id, lodicka_id, rvp_ovu_id, source_ovu_code, is_primary, created_at)
        VALUES (${id("m01-lodicka-ovu")}, ${lodickaId}, ${ovuId}, NULL, true, now())
        ON CONFLICT (lodicka_id, rvp_ovu_id) DO NOTHING
      `);
    }

    for (const [index, personId] of requestedSpravceIds.entries()) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO app_m01_oblast_spravce (id, oblast_id, person_id, is_primary, created_at)
        VALUES (${id("m01-oblast-spravce")}, ${oblastId}, ${personId}, ${index === 0}, now())
        ON CONFLICT (oblast_id, person_id) DO UPDATE
        SET is_primary = EXCLUDED.is_primary
      `);
    }

    for (const [index, personId] of requestedGarantIds.entries()) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO app_m01_lodicka_stav_garant (id, lodicka_id, person_id, is_primary, created_at)
        VALUES (${id("m01-lodicka-stav-garant")}, ${lodickaId}, ${personId}, ${index === 0}, now())
        ON CONFLICT (lodicka_id, person_id) DO UPDATE
        SET is_primary = EXCLUDED.is_primary
      `);
    }

    await syncM01DerivedRolesForPersons(tx, [
      ...requestedSpravceIds,
      ...requestedGarantIds,
    ]);
  });

  revalidatePath("/portal/lodicky/sprava");
  revalidatePath(`/portal/lodicky/sprava/${lodickaId}`);
  redirect(`/portal/lodicky/sprava/${lodickaId}?svp=${encodeURIComponent(svpVersionId)}&saved=1`);
}

export async function updateLodickaManagementAction(formData: FormData) {
  const lodickaId = readString(formData, "lodickaId");
  const returnTo = readString(formData, "returnTo") || `/portal/lodicky/sprava/${encodeURIComponent(lodickaId)}`;
  const access = await getActionAccess();

  if (!lodickaId || !canManageLodicky(access.roles)) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }

  const [canEdit, context] = await Promise.all([
    verifyCanEditLodicka({ lodickaId, access }),
    getLodickaSvpContext(lodickaId),
  ]);
  if (!canEdit || !context) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }

  const nazev = readString(formData, "nazev");
  const popis = readString(formData, "popis");
  const wholeFleet = canManageWholeFleet(access.roles);
  const editMode = readString(formData, "editMode");

  if (!wholeFleet || editMode === "basic") {
    if (!nazev) {
      redirect(appendStatusParam(returnTo, "error", "invalid"));
    }
    await prisma.$executeRaw(Prisma.sql`
      UPDATE app_m01_lodicka
      SET
        nazev = ${nazev},
        popis = ${popis || null},
        updated_at = now()
      WHERE id = ${lodickaId}
    `);
    revalidatePath("/portal/lodicky/sprava");
    revalidatePath(`/portal/lodicky/sprava/${lodickaId}`);
    redirect(appendStatusParam(returnTo, "saved", "1"));
  }

  await ensureDraftSvpVersion(context.svpVersionId, returnTo);

  const rocnikOd = parseGrade(readString(formData, "rocnikOd"));
  const rocnikDo = parseGrade(readString(formData, "rocnikDo"));
  const requestedStupen = wholeFleet ? parseStupen(readString(formData, "stupen")) : parseStupen(context.stupen);

  if (!nazev || rocnikOd === null || rocnikDo === null || rocnikOd > rocnikDo) {
    redirect(appendStatusParam(returnTo, "error", "invalid"));
  }

  if (!requestedStupen || !gradeRangeMatchesStupen(requestedStupen, rocnikOd, rocnikDo)) {
    redirect(appendStatusParam(returnTo, "error", "invalid-grade-range"));
  }

  const ovuNotApplicable = readString(formData, "ovuNotApplicable") === "1";
  const requestedOvuIds = ovuNotApplicable ? [] : [...new Set(readStringList(formData, "ovuIds"))];
  const allowedOvuIds = await validOvuIds(lodickaId, requestedOvuIds, requestedStupen);
  if (allowedOvuIds.size !== requestedOvuIds.length) {
    redirect(appendStatusParam(returnTo, "error", "invalid-ovu"));
  }

  const requestedSpravceIds = wholeFleet ? [...new Set(readStringList(formData, "spravcePersonIds"))] : [];
  const requestedGarantIds = [...new Set([...readStringList(formData, "garantPersonIds"), readString(formData, "garantPersonId")].filter(Boolean))];
  const requestedPredmetId = wholeFleet ? readString(formData, "predmetId") : "";
  const requestedPodpredmetId = wholeFleet ? readString(formData, "podpredmetId") : "";
  const requestedOblastId = wholeFleet ? readString(formData, "oblastId") : "";

  if (wholeFleet) {
    const [validSpravci, classificationIsValid] = await Promise.all([
      validPruvodcePersonIds(requestedSpravceIds),
      validateClassification({
        svpVersionId: context.svpVersionId,
        stupen: requestedStupen,
        predmetId: requestedPredmetId,
        podpredmetId: requestedPodpredmetId,
        oblastId: requestedOblastId,
      }),
    ]);

    if (validSpravci.size !== requestedSpravceIds.length) {
      redirect(appendStatusParam(returnTo, "error", "invalid-spravce"));
    }

    if (!classificationIsValid) {
      redirect(appendStatusParam(returnTo, "error", "invalid-classification"));
    }
  }

  if (requestedGarantIds.length > 0) {
    const validGaranti = await validPruvodcePersonIds(requestedGarantIds);
    if (validGaranti.size !== requestedGarantIds.length) {
      redirect(appendStatusParam(returnTo, "error", "invalid-garant"));
    }
  }

  await prisma.$transaction(async (tx) => {
    const affectedPersonIds = new Set<string>([
      ...requestedSpravceIds,
      ...requestedGarantIds,
      ...(await getM01AssignmentPersonIds(tx, {
        oblastIds: wholeFleet && requestedOblastId ? [requestedOblastId] : [],
        lodickaIds: [lodickaId],
      })),
    ]);

    if (wholeFleet) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE app_m01_lodicka
        SET
          nazev = ${nazev},
          popis = ${popis || null},
          rocnik_od = ${rocnikOd},
          rocnik_do = ${rocnikDo},
          stupen = ${requestedStupen}::"M01Stupen",
          predmet_id = ${requestedPredmetId},
          podpredmet_id = ${requestedPodpredmetId || null},
          oblast_id = ${requestedOblastId},
          garant_person_id = ${requestedGarantIds[0] || null},
          ovu_not_applicable = ${ovuNotApplicable},
          updated_at = now()
        WHERE id = ${lodickaId}
      `);
    } else {
      await tx.$executeRaw(Prisma.sql`
        UPDATE app_m01_lodicka
        SET
          nazev = ${nazev},
          popis = ${popis || null},
          rocnik_od = ${rocnikOd},
          rocnik_do = ${rocnikDo},
          garant_person_id = ${requestedGarantIds[0] || null},
          ovu_not_applicable = ${ovuNotApplicable},
          updated_at = now()
        WHERE id = ${lodickaId}
      `);
    }

    await tx.$executeRaw(Prisma.sql`
      DELETE FROM app_m01_lodicka_ovu_link
      WHERE lodicka_id = ${lodickaId}
    `);

    for (const ovuId of requestedOvuIds) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO app_m01_lodicka_ovu_link (id, lodicka_id, rvp_ovu_id, source_ovu_code, is_primary, created_at)
        VALUES (${id("m01-lodicka-ovu")}, ${lodickaId}, ${ovuId}, NULL, true, now())
        ON CONFLICT (lodicka_id, rvp_ovu_id) DO NOTHING
      `);
    }

    if (wholeFleet) {
      const ownPersonIds = [...new Set(access.personIds.map((personId) => personId.trim()).filter(Boolean))];
      const preservedOwnRows = ownPersonIds.length > 0
        ? await tx.$queryRaw<Array<{ personId: string; isPrimary: boolean }>>(Prisma.sql`
            SELECT person_id AS "personId", is_primary AS "isPrimary"
            FROM app_m01_oblast_spravce
            WHERE oblast_id = ${requestedOblastId}
              AND person_id IN (${Prisma.join(ownPersonIds)})
          `)
        : [];
      const finalSpravceIds = [...new Set([...requestedSpravceIds, ...preservedOwnRows.map((row) => row.personId)])];
      for (const personId of finalSpravceIds) affectedPersonIds.add(personId);

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM app_m01_oblast_spravce
        WHERE oblast_id = ${requestedOblastId}
      `);

      for (const [index, personId] of finalSpravceIds.entries()) {
        const preservedOwnRow = preservedOwnRows.find((row) => row.personId === personId);
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO app_m01_oblast_spravce (id, oblast_id, person_id, is_primary, created_at)
          VALUES (${id("m01-oblast-spravce")}, ${requestedOblastId}, ${personId}, ${preservedOwnRow?.isPrimary ?? index === 0}, now())
          ON CONFLICT (oblast_id, person_id) DO UPDATE
          SET is_primary = EXCLUDED.is_primary
        `);
      }
    }

    await tx.$executeRaw(Prisma.sql`
      DELETE FROM app_m01_lodicka_stav_garant
      WHERE lodicka_id = ${lodickaId}
    `);

    for (const [index, personId] of requestedGarantIds.entries()) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO app_m01_lodicka_stav_garant (id, lodicka_id, person_id, is_primary, created_at)
        VALUES (${id("m01-lodicka-stav-garant")}, ${lodickaId}, ${personId}, ${index === 0}, now())
        ON CONFLICT (lodicka_id, person_id) DO UPDATE
        SET is_primary = EXCLUDED.is_primary
      `);
    }

    await syncM01DerivedRolesForPersons(tx, [...affectedPersonIds]);
  });

  revalidatePath("/portal/lodicky/sprava");
  revalidatePath(`/portal/lodicky/sprava/${lodickaId}`);
  redirect(appendStatusParam(returnTo, "saved", "1"));
}

export async function bulkUpdateLodickyManagementAction(formData: FormData) {
  const returnTo = readString(formData, "returnTo") || "/portal/lodicky/sprava";
  const access = await getActionAccess();
  const wholeFleet = canManageWholeFleet(access.roles);
  if (!canManageLodicky(access.roles) || !wholeFleet) {
    redirect(appendStatusParam(returnTo, "error", "not-allowed"));
  }

  const svpVersionId = readString(formData, "svpVersionId");
  const lodickaIds = [...new Set(readStringList(formData, "lodickaIds"))];
  if (!svpVersionId || lodickaIds.length === 0 || lodickaIds.length > 100) {
    redirect(appendStatusParam(returnTo, "error", "invalid-bulk-selection"));
  }

  const applyClassification = readString(formData, "applyClassification") === "1";
  const applySpravci = readString(formData, "applySpravci") === "1";
  const applyGarant = readString(formData, "applyGarant") === "1";

  if (!applyClassification && !applySpravci && !applyGarant) {
    redirect(appendStatusParam(returnTo, "error", "invalid-bulk-action"));
  }

  const personIds = [...new Set(access.personIds.map((personId) => personId.trim()).filter(Boolean))];
  const accessClause = wholeFleet
    ? Prisma.empty
    : personIds.length > 0
      ? Prisma.sql`AND (
          EXISTS (
            SELECT 1
            FROM app_m01_oblast_spravce scope_os
            WHERE scope_os.oblast_id = l.oblast_id
              AND scope_os.person_id IN (${Prisma.join(personIds)})
          )
          OR EXISTS (
            SELECT 1
            FROM app_m01_lodicka_garant legacy_lg
            WHERE legacy_lg.lodicka_id = l.id
              AND legacy_lg.person_id IN (${Prisma.join(personIds)})
          )
        )`
      : Prisma.sql`AND false`;

  const selectedRows = await prisma.$queryRaw<Array<{ id: string; oblastId: string }>>(Prisma.sql`
    SELECT l.id, l.oblast_id AS "oblastId"
    FROM app_m01_lodicka l
    WHERE l.id IN (${Prisma.join(lodickaIds)})
      AND l.svp_version_id = ${svpVersionId}
      AND l.is_deleted = false
      ${accessClause}
  `);
  if (selectedRows.length !== lodickaIds.length) {
    redirect(appendStatusParam(returnTo, "error", "invalid-bulk-selection"));
  }

  let requestedStupen: "I_STUPEN" | "II_STUPEN" | null = null;
  let requestedRocnikOd: number | null = null;
  let requestedRocnikDo: number | null = null;
  let requestedPredmetId = "";
  let requestedPodpredmetId = "";
  let requestedOblastId = "";

  if (applyClassification) {
    requestedStupen = parseStupen(readString(formData, "stupen"));
    requestedRocnikOd = parseGrade(readString(formData, "rocnikOd"));
    requestedRocnikDo = parseGrade(readString(formData, "rocnikDo"));
    requestedPredmetId = readString(formData, "predmetId");
    requestedPodpredmetId = readString(formData, "podpredmetId");
    requestedOblastId = readString(formData, "oblastId");

    if (
      !requestedStupen ||
      requestedRocnikOd === null ||
      requestedRocnikDo === null ||
      requestedRocnikOd > requestedRocnikDo ||
      !gradeRangeMatchesStupen(requestedStupen, requestedRocnikOd, requestedRocnikDo)
    ) {
      redirect(appendStatusParam(returnTo, "error", "invalid-grade-range"));
    }

    const classificationIsValid = await validateClassification({
      svpVersionId,
      stupen: requestedStupen,
      predmetId: requestedPredmetId,
      podpredmetId: requestedPodpredmetId,
      oblastId: requestedOblastId,
    });
    if (!classificationIsValid) {
      redirect(appendStatusParam(returnTo, "error", "invalid-classification"));
    }

    if (!wholeFleet) {
      const targetAccessRows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT count(*)::int AS count
        FROM app_m01_oblast_spravce os
        WHERE os.oblast_id = ${requestedOblastId}
          AND os.person_id IN (${Prisma.join(personIds)})
      `);
      if ((targetAccessRows[0]?.count ?? 0) === 0) {
        redirect(appendStatusParam(returnTo, "error", "not-allowed"));
      }
    }
  }

  const spravceMode = readString(formData, "spravceMode");
  const requestedSpravceIds = [...new Set(readStringList(formData, "spravcePersonIds"))];
  const affectedOblastIdsForSpravci = applySpravci
    ? applyClassification && requestedOblastId
      ? [requestedOblastId]
      : [...new Set(selectedRows.map((row) => row.oblastId))]
    : [];
  if (applySpravci) {
    if (!wholeFleet) {
      redirect(appendStatusParam(returnTo, "error", "not-allowed"));
    }
    if (spravceMode !== "add" && spravceMode !== "replace" && spravceMode !== "remove") {
      redirect(appendStatusParam(returnTo, "error", "invalid-spravce"));
    }
    if ((spravceMode === "add" || spravceMode === "remove") && requestedSpravceIds.length === 0) {
      redirect(appendStatusParam(returnTo, "error", "invalid-spravce"));
    }
    if (requestedSpravceIds.length > 0) {
      const validSpravci = await validPruvodcePersonIds(requestedSpravceIds);
      if (validSpravci.size !== requestedSpravceIds.length) {
        redirect(appendStatusParam(returnTo, "error", "invalid-spravce"));
      }
    }
    if (spravceMode === "remove" && personIds.some((personId) => requestedSpravceIds.includes(personId))) {
      redirect(appendStatusParam(returnTo, "error", "self-spravce-remove"));
    }
  }

  const garantMode = readString(formData, "garantMode");
  const requestedGarantIds = [...new Set([...readStringList(formData, "garantPersonIds"), readString(formData, "garantPersonId")].filter(Boolean))];
  if (applyGarant) {
    if (garantMode !== "add" && garantMode !== "replace" && garantMode !== "remove") {
      redirect(appendStatusParam(returnTo, "error", "invalid-garant"));
    }
    if ((garantMode === "add" || garantMode === "remove") && requestedGarantIds.length === 0) {
      redirect(appendStatusParam(returnTo, "error", "invalid-garant"));
    }
    if (requestedGarantIds.length > 0) {
      const validGaranti = await validPruvodcePersonIds(requestedGarantIds);
      if (validGaranti.size !== requestedGarantIds.length) {
        redirect(appendStatusParam(returnTo, "error", "invalid-garant"));
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    const affectedPersonIds = new Set<string>([
      ...requestedSpravceIds,
      ...requestedGarantIds,
      ...(await getM01AssignmentPersonIds(tx, {
        oblastIds: affectedOblastIdsForSpravci,
        lodickaIds,
      })),
    ]);

    if (applyClassification && requestedStupen && requestedRocnikOd !== null && requestedRocnikDo !== null) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE app_m01_lodicka
        SET
          stupen = ${requestedStupen}::"M01Stupen",
          rocnik_od = ${requestedRocnikOd},
          rocnik_do = ${requestedRocnikDo},
          predmet_id = ${requestedPredmetId},
          podpredmet_id = ${requestedPodpredmetId || null},
          oblast_id = ${requestedOblastId},
          updated_at = now()
        WHERE id IN (${Prisma.join(lodickaIds)})
      `);

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM app_m01_lodicka_ovu_link link
        USING app_m01_rvp_ovu ovu
        LEFT JOIN app_m01_rvp_uzlovy_bod ub ON ub.id = ovu.uzlovy_bod_id
        WHERE link.rvp_ovu_id = ovu.id
          AND link.lodicka_id IN (${Prisma.join(lodickaIds)})
          AND ub.stage_code IS NOT NULL
          AND ub.stage_code <> ${requestedStupen}
      `);
    }

    if (applySpravci) {
      const preservedOwnRows = spravceMode === "replace" && personIds.length > 0
        ? await tx.$queryRaw<Array<{ oblastId: string; personId: string; isPrimary: boolean }>>(Prisma.sql`
            SELECT oblast_id AS "oblastId", person_id AS "personId", is_primary AS "isPrimary"
            FROM app_m01_oblast_spravce
            WHERE oblast_id IN (${Prisma.join(affectedOblastIdsForSpravci)})
              AND person_id IN (${Prisma.join(personIds)})
          `)
        : [];

      if (spravceMode === "replace") {
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM app_m01_oblast_spravce
          WHERE oblast_id IN (${Prisma.join(affectedOblastIdsForSpravci)})
        `);
      }

      if (spravceMode === "remove" && requestedSpravceIds.length > 0) {
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM app_m01_oblast_spravce
          WHERE oblast_id IN (${Prisma.join(affectedOblastIdsForSpravci)})
            AND person_id IN (${Prisma.join(requestedSpravceIds)})
        `);
      }

      if (spravceMode === "add" || spravceMode === "replace") {
        for (const oblastId of affectedOblastIdsForSpravci) {
          const preservedForOblast = preservedOwnRows.filter((row) => row.oblastId === oblastId);
          const finalSpravceIds = spravceMode === "replace"
            ? [...new Set([...requestedSpravceIds, ...preservedForOblast.map((row) => row.personId)])]
            : requestedSpravceIds;
          for (const personId of finalSpravceIds) affectedPersonIds.add(personId);
          for (const [index, personId] of finalSpravceIds.entries()) {
            const preservedOwnRow = preservedForOblast.find((row) => row.personId === personId);
            await tx.$executeRaw(Prisma.sql`
              INSERT INTO app_m01_oblast_spravce (id, oblast_id, person_id, is_primary, created_at)
              VALUES (${id("m01-oblast-spravce")}, ${oblastId}, ${personId}, ${preservedOwnRow?.isPrimary ?? index === 0}, now())
              ON CONFLICT (oblast_id, person_id) DO UPDATE
              SET is_primary = app_m01_oblast_spravce.is_primary OR EXCLUDED.is_primary
            `);
          }
        }
      }
    }

    if (applyGarant) {
      if (garantMode === "replace") {
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM app_m01_lodicka_stav_garant
          WHERE lodicka_id IN (${Prisma.join(lodickaIds)})
        `);
      }

      if (garantMode === "remove" && requestedGarantIds.length > 0) {
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM app_m01_lodicka_stav_garant
          WHERE lodicka_id IN (${Prisma.join(lodickaIds)})
            AND person_id IN (${Prisma.join(requestedGarantIds)})
        `);
      }

      if ((garantMode === "add" || garantMode === "replace") && requestedGarantIds.length > 0) {
        for (const lodickaId of lodickaIds) {
          for (const [index, personId] of requestedGarantIds.entries()) {
            await tx.$executeRaw(Prisma.sql`
              INSERT INTO app_m01_lodicka_stav_garant (id, lodicka_id, person_id, is_primary, created_at)
              VALUES (${id("m01-lodicka-stav-garant")}, ${lodickaId}, ${personId}, ${index === 0}, now())
              ON CONFLICT (lodicka_id, person_id) DO UPDATE
              SET is_primary = app_m01_lodicka_stav_garant.is_primary OR EXCLUDED.is_primary
            `);
          }
        }
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE app_m01_lodicka l
        SET
          garant_person_id = (
            SELECT sg.person_id
            FROM app_m01_lodicka_stav_garant sg
            WHERE sg.lodicka_id = l.id
            ORDER BY sg.is_primary DESC, sg.created_at ASC
            LIMIT 1
          ),
          updated_at = now()
        WHERE l.id IN (${Prisma.join(lodickaIds)})
      `);
    }

    await syncM01DerivedRolesForPersons(tx, [...affectedPersonIds]);
  });

  revalidatePath("/portal/lodicky/sprava");
  for (const lodickaId of lodickaIds.slice(0, 30)) {
    revalidatePath(`/portal/lodicky/sprava/${lodickaId}`);
  }
  redirect(appendStatusParam(returnTo, "saved", "bulk"));
}
