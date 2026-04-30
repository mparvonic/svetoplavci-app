import { NextRequest, NextResponse } from "next/server";
import { AppSchoolEventRegistrationStatus } from "@prisma/client";

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

export async function GET(req: NextRequest) {
  const sessionContext = await getApiSessionContext();
  if (!sessionContext) return unauthorized();
  if (!hasAnySessionRole(sessionContext.roles, GUIDE_ROLE_CODES)) return forbidden();

  const termId = req.nextUrl.searchParams.get("termId")?.trim() || null;
  const students = await prisma.appPerson.findMany({
    where: {
      isActive: true,
      roles: { some: { role: "zak", isActive: true } },
    },
    select: {
      id: true,
      displayName: true,
      identifier: true,
    },
    orderBy: [{ displayName: "asc" }],
  });

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
        displayName: student.displayName,
        identifier: student.identifier,
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
