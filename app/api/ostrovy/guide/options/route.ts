import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import {
  getApiSessionContext,
  GUIDE_ROLE_CODES,
  hasAnySessionRole,
} from "@/src/lib/api/session";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

type GroupRow = {
  kind: string;
  code: string;
  name: string | null;
  memberCount: number;
};

const ROCNIKY = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function stupenForRocnik(rocnik: number): number {
  return rocnik <= 5 ? 1 : 2;
}

async function listSchoolLevelGroups(): Promise<GroupRow[]> {
  const rows = await prisma.$queryRaw<Array<{ rocnik: number; memberCount: number }>>(Prisma.sql`
    WITH student_grades AS (
      SELECT
        (sr.payload->>'CurrentGradeNum')::int AS rocnik,
        sr.person_id
      FROM app_person_source_record sr
      JOIN app_person p ON p.id = sr.person_id
      WHERE sr.active_source = TRUE
        AND sr.derived_roles @> ARRAY['zak']::text[]
        AND p.is_active = TRUE
        AND (sr.payload->>'CurrentGradeNum') ~ '^[0-9]+$'
    )
    SELECT rocnik, COUNT(DISTINCT person_id)::int AS "memberCount"
    FROM student_grades
    WHERE rocnik BETWEEN 1 AND 9
    GROUP BY rocnik
    ORDER BY rocnik
  `);

  const countsByRocnik = new Map(rows.map((row) => [row.rocnik, row.memberCount]));
  const rocnikGroups: GroupRow[] = ROCNIKY.map((rocnik) => ({
    kind: "rocnik",
    code: String(rocnik),
    name: `${rocnik}. ročník`,
    memberCount: countsByRocnik.get(rocnik) ?? 0,
  }));

  const stupenGroups: GroupRow[] = [1, 2].map((stupen) => ({
    kind: "stupen",
    code: String(stupen),
    name: `${stupen}. stupeň`,
    memberCount: rows
      .filter((row) => stupenForRocnik(row.rocnik) === stupen)
      .reduce((sum, row) => sum + row.memberCount, 0),
  }));

  return [...stupenGroups, ...rocnikGroups];
}

async function listActiveGroups(): Promise<GroupRow[]> {
  const tableRows = await prisma.$queryRaw<Array<{ ok: boolean }>>(Prisma.sql`
    SELECT to_regclass('public.app_group') IS NOT NULL AS ok
  `);
  if (!tableRows[0]?.ok) return [];

  return prisma.$queryRaw<GroupRow[]>(Prisma.sql`
    WITH active_groups AS (
      SELECT
        g.id,
        lower(g.kind::text) AS kind,
        g.code,
        COALESCE(
          to_jsonb(g)->>'name',
          to_jsonb(g)->>'display_name',
          to_jsonb(g)->>'label',
          g.code
        ) AS name
      FROM app_group g
      WHERE g.is_active = TRUE
        AND lower(g.kind::text) NOT IN ('stupen', 'rocnik')
        AND (g.valid_from IS NULL OR g.valid_from <= NOW())
        AND (g.valid_to IS NULL OR g.valid_to > NOW())
    )
    SELECT
      ag.kind,
      ag.code,
      ag.name,
      COUNT(DISTINCT p.id)::int AS "memberCount"
    FROM active_groups ag
    LEFT JOIN app_group_membership gm
      ON gm.group_id = ag.id
      AND (gm.valid_from IS NULL OR gm.valid_from <= NOW())
      AND (gm.valid_to IS NULL OR gm.valid_to > NOW())
    LEFT JOIN app_person p
      ON p.id = gm.person_id
      AND p.is_active = TRUE
    GROUP BY ag.id, ag.kind, ag.code, ag.name
    ORDER BY
      CASE ag.kind
        WHEN 'stupen' THEN 1
        WHEN 'rocnik' THEN 2
        WHEN 'smecka' THEN 3
        WHEN 'studijni_skupina' THEN 4
        WHEN 'posadka' THEN 5
        ELSE 9
      END,
      ag.code
  `);
}

export async function GET() {
  const context = await getApiSessionContext();
  if (!context) return unauthorized();
  if (!hasAnySessionRole(context.roles, GUIDE_ROLE_CODES)) return forbidden();

  const now = new Date();
  const [guides, schoolLevelGroups, dbGroups] = await Promise.all([
    prisma.appPerson.findMany({
      where: {
        isActive: true,
        roles: {
          some: {
            role: { equals: "pruvodce", mode: "insensitive" },
            isActive: true,
            OR: [{ validFrom: null }, { validFrom: { lte: now } }],
            AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }],
          },
        },
      },
      select: {
        id: true,
        displayName: true,
        identifier: true,
        loginLinks: {
          where: {
            status: "approved",
            identity: { isActive: true },
          },
          select: {
            identity: {
              select: { normalizedValue: true },
            },
          },
          take: 1,
        },
        sourceRecords: {
          where: {
            activeSource: true,
            primaryEmail: { not: null },
          },
          select: { primaryEmail: true },
          take: 1,
        },
      },
      orderBy: [{ displayName: "asc" }],
    }),
    listSchoolLevelGroups(),
    listActiveGroups(),
  ]);

  return NextResponse.json({
    guides: guides.map((guide) => ({
      id: guide.id,
      displayName: guide.displayName,
      identifier: guide.identifier,
      email: guide.loginLinks[0]?.identity.normalizedValue ?? guide.sourceRecords[0]?.primaryEmail ?? null,
    })),
    groups: [...schoolLevelGroups, ...dbGroups],
  });
}
