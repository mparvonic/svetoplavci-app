import { NextRequest, NextResponse } from "next/server";
import { AppGroupKind, AppSchoolEventRegistrationStatus, Prisma } from "@prisma/client";

import {
  getApiSessionContext,
  GUIDE_ROLE_CODES,
  hasAnySessionRole,
} from "@/src/lib/api/session";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACTIVE_REGISTRATION_STATUSES = [
  AppSchoolEventRegistrationStatus.REGISTERED,
  AppSchoolEventRegistrationStatus.WAITLIST,
];

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

type StudentRow = {
  id: string;
  displayName: string;
  nickname: string | null;
  firstName: string | null;
  lastName: string | null;
  rocnikCode: string | null;
  smeckaCode: string | null;
  smeckaName: string | null;
};

export async function GET(req: NextRequest) {
  const sessionContext = await getApiSessionContext(req);
  if (!sessionContext) return unauthorized();
  if (!hasAnySessionRole(sessionContext.roles, GUIDE_ROLE_CODES)) return forbidden();

  const termId = req.nextUrl.searchParams.get("termId")?.trim() || null;
  const students = await prisma.$queryRaw<StudentRow[]>(Prisma.sql`
    SELECT
      c.id,
      c.display_name AS "displayName",
      c.nickname,
      c.first_name AS "firstName",
      c.last_name AS "lastName",
      COALESCE(grp_rocnik.code, ss.current_grade_num::text) AS "rocnikCode",
      grp_smecka.code AS "smeckaCode",
      grp_smecka.name AS "smeckaName"
    FROM app_person c
    JOIN app_role_assignment ra
      ON ra.person_id = c.id
      AND ra.role = 'zak'
      AND ra.is_active = true
    JOIN LATERAL (
      SELECT
        s.current_grade_num,
        s.study_mode_code,
        s.study_mode_key
      FROM app_student_state s
      WHERE s.person_id = c.id
        AND (s.effective_to IS NULL OR s.effective_to::date >= CURRENT_DATE)
      ORDER BY s.effective_from DESC, s.created_at DESC
      LIMIT 1
    ) ss ON true
    LEFT JOIN LATERAL (
      SELECT g.code
      FROM app_group_membership gm
      JOIN app_group g ON g.id = gm.group_id
      WHERE gm.person_id = c.id
        AND gm.group_kind = 'rocnik'
        AND gm.valid_from <= NOW()
        AND (gm.valid_to IS NULL OR gm.valid_to >= NOW())
        AND g.is_active = true
      ORDER BY gm.valid_from DESC, gm.created_at DESC
      LIMIT 1
    ) grp_rocnik ON true
    LEFT JOIN LATERAL (
      SELECT g.code, g.name
      FROM app_group_membership gm
      JOIN app_group g ON g.id = gm.group_id
      WHERE gm.person_id = c.id
        AND gm.group_kind = 'smecka'
        AND gm.valid_from <= NOW()
        AND (gm.valid_to IS NULL OR gm.valid_to >= NOW())
        AND g.is_active = true
      ORDER BY gm.valid_from DESC, gm.created_at DESC
      LIMIT 1
    ) grp_smecka ON true
    WHERE c.is_active = true
      AND grp_smecka.code IS NOT NULL
      AND COALESCE(grp_rocnik.code, ss.current_grade_num::text) IS NOT NULL
      AND (
        ss.study_mode_code = '11'
        OR lower(ss.study_mode_key::text) = 'denni'
      )
    ORDER BY c.display_name ASC
  `);

  const studentIds = students.map((student) => student.id);
  const memberships = studentIds.length
    ? await prisma.appGroupMembership.findMany({
        where: {
          personId: { in: studentIds },
          validFrom: { lte: new Date() },
          OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
          group: {
            isActive: true,
            validFrom: { lte: new Date() },
            OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
          },
        },
        select: {
          personId: true,
          groupKind: true,
          group: {
            select: {
              code: true,
            },
          },
        },
      })
    : [];

  const groupsByPerson = new Map<string, Array<{ kind: string; code: string }>>();
  for (const row of memberships) {
    const code = row.group.code.trim();
    if (!code) continue;
    const kind = row.groupKind.toString().trim().toLowerCase();
    const list = groupsByPerson.get(row.personId) ?? [];
    if (!list.some((item) => item.kind === kind && item.code === code.toLowerCase())) {
      list.push({ kind, code: code.toLowerCase() });
    }
    groupsByPerson.set(row.personId, list);
  }

  const registrations = termId
    ? await prisma.appSchoolEventRegistration.findMany({
        where: {
          status: { in: ACTIVE_REGISTRATION_STATUSES },
          schoolEvent: {
            offerGroupId: termId,
            eventType: { code: "OSTROVY" },
            isActive: true,
          },
        },
        select: {
          personId: true,
          status: true,
          schoolEventId: true,
          schoolEvent: {
            select: { title: true },
          },
        },
      })
    : [];

  const registrationByPerson = new Map(registrations.map((row) => [row.personId, row]));
  return NextResponse.json({
    students: students.map((student) => {
      const registration = registrationByPerson.get(student.id);
      return {
        id: student.id,
        displayName: student.nickname || student.displayName,
        firstName: student.firstName,
        lastName: student.lastName,
        nickname: student.nickname,
        rocnik: student.rocnikCode?.trim() || null,
        smecka: student.smeckaName?.trim() || null,
        smeckaCode: student.smeckaCode?.trim().toLowerCase() || null,
        groupPairs: groupsByPerson.get(student.id) ?? [],
        currentRegistration: registration
          ? {
              eventId: registration.schoolEventId,
              eventTitle: registration.schoolEvent.title,
              status: registration.status,
            }
          : null,
      };
    }),
  });
}
