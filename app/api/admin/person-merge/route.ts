import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

const MAX_REASON_LENGTH = 500;

function collectRoles(
  session: { user?: { role?: unknown; roles?: unknown } } | null,
): string[] {
  if (!session?.user) return [];
  if (Array.isArray(session.user.roles))
    return session.user.roles.map((value) => String(value));
  if (typeof session.user.role === "string" && session.user.role)
    return [session.user.role];
  return [];
}

function isAdmin(
  session: { user?: { role?: unknown; roles?: unknown } } | null,
): boolean {
  return collectRoles(session).includes("admin");
}

function cleanReason(value: unknown): string {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_REASON_LENGTH)
    : "";
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isAdmin(session)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { email: session.user.email };
}

async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const payload = await req.json();
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function collectIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function loginStatusRank(status: string): number {
  if (status === "approved") return 3;
  if (status === "pending") return 2;
  return 1;
}

function strongerLoginStatus(a: string, b: string): string {
  return loginStatusRank(a) >= loginStatusRank(b) ? a : b;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  const payload = await readJson(req);
  const primaryPersonId =
    typeof payload.primaryPersonId === "string"
      ? payload.primaryPersonId.trim()
      : "";
  const mergedPersonIds = collectIds(payload.mergedPersonIds).filter(
    (personId) => personId !== primaryPersonId,
  );
  const reason = cleanReason(payload.reason);

  if (!primaryPersonId || mergedPersonIds.length === 0) {
    return NextResponse.json(
      { error: "Vyberte primární osobu a alespoň jednu osobu ke sloučení." },
      { status: 400 },
    );
  }
  if (!reason) {
    return NextResponse.json(
      { error: "Doplňte důvod sloučení." },
      { status: 400 },
    );
  }

  const allPersonIds = [primaryPersonId, ...mergedPersonIds];

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const people = await tx.appPerson.findMany({
          where: { id: { in: allPersonIds } },
          select: {
            id: true,
            displayName: true,
            firstName: true,
            middleName: true,
            lastName: true,
            nickname: true,
            identifier: true,
            plus4uId: true,
            chipUid: true,
            chipHid: true,
            isActive: true,
            mergedIntoPersonId: true,
          },
        });
        if (people.length !== allPersonIds.length) {
          throw new Error("Některá vybraná osoba nebyla nalezena.");
        }
        const primary = people.find((person) => person.id === primaryPersonId);
        if (!primary) throw new Error("Primární osoba nebyla nalezena.");
        const mergedPeople = people.filter((person) =>
          mergedPersonIds.includes(person.id),
        );
        if (
          mergedPeople.some(
            (person) =>
              person.mergedIntoPersonId &&
              person.mergedIntoPersonId !== primaryPersonId,
          )
        ) {
          throw new Error("Některá osoba už byla sloučena do jiné osoby.");
        }

        const summary = {
          sourceRecords: 0,
          loginLinksMoved: 0,
          loginLinksMerged: 0,
          rolesMoved: 0,
          rolesMerged: 0,
          relationsMoved: 0,
          relationsSkipped: 0,
          studentStates: 0,
          memberships: 0,
          violations: 0,
          eventRowsMoved: 0,
          eventRowsSkipped: 0,
        };

        await tx.appPersonSourceRecord.updateMany({
          where: { personId: { in: mergedPersonIds } },
          data: { personId: primaryPersonId },
        });
        summary.sourceRecords = await tx.appPersonSourceRecord.count({
          where: { personId: primaryPersonId },
        });

        const roles = await tx.appRoleAssignment.findMany({
          where: { personId: { in: mergedPersonIds } },
        });
        for (const role of roles) {
          const existing = await tx.appRoleAssignment.findUnique({
            where: {
              personId_role_source: {
                personId: primaryPersonId,
                role: role.role,
                source: role.source,
              },
            },
          });
          if (existing) {
            await tx.appRoleAssignment.update({
              where: { id: existing.id },
              data: {
                isActive: existing.isActive || role.isActive,
                validFrom: existing.validFrom ?? role.validFrom,
                validTo:
                  existing.validTo && !role.validTo ? null : existing.validTo,
              },
            });
            await tx.appRoleAssignment.update({
              where: { id: role.id },
              data: { isActive: false, validTo: role.validTo ?? new Date() },
            });
            summary.rolesMerged += 1;
          } else {
            await tx.appRoleAssignment.update({
              where: { id: role.id },
              data: { personId: primaryPersonId },
            });
            summary.rolesMoved += 1;
          }
        }

        const loginLinks = await tx.appLoginPersonLink.findMany({
          where: { personId: { in: mergedPersonIds } },
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        });
        for (const link of loginLinks) {
          const existing = await tx.appLoginPersonLink.findUnique({
            where: {
              identityId_personId: {
                identityId: link.identityId,
                personId: primaryPersonId,
              },
            },
          });
          if (existing) {
            const nextStatus = strongerLoginStatus(
              existing.status,
              link.status,
            );
            await tx.appLoginPersonLink.delete({ where: { id: link.id } });
            await tx.appLoginPersonLink.update({
              where: { id: existing.id },
              data: {
                status: nextStatus,
                approvedBy: existing.approvedBy ?? link.approvedBy,
                approvedAt: existing.approvedAt ?? link.approvedAt,
                reason: existing.reason ?? link.reason ?? `Sloučeno: ${reason}`,
              },
            });
            summary.loginLinksMerged += 1;
          } else {
            await tx.appLoginPersonLink.update({
              where: { id: link.id },
              data: { personId: primaryPersonId },
            });
            summary.loginLinksMoved += 1;
          }
        }

        const relations = await tx.appPersonRelation.findMany({
          where: {
            OR: [
              { parentPersonId: { in: mergedPersonIds } },
              { childPersonId: { in: mergedPersonIds } },
            ],
          },
        });
        for (const relation of relations) {
          const nextParentPersonId = mergedPersonIds.includes(
            relation.parentPersonId,
          )
            ? primaryPersonId
            : relation.parentPersonId;
          const nextChildPersonId = mergedPersonIds.includes(
            relation.childPersonId,
          )
            ? primaryPersonId
            : relation.childPersonId;
          if (nextParentPersonId === nextChildPersonId) {
            await tx.appPersonRelation.update({
              where: { id: relation.id },
              data: {
                isActive: false,
                updatedBy: admin.email,
                changeReason: `Sloučení osob: ${reason}`,
              },
            });
            summary.relationsSkipped += 1;
            continue;
          }

          const existing = await tx.appPersonRelation.findUnique({
            where: {
              parentPersonId_childPersonId_relationType_source: {
                parentPersonId: nextParentPersonId,
                childPersonId: nextChildPersonId,
                relationType: relation.relationType,
                source: relation.source,
              },
            },
          });
          if (existing && existing.id !== relation.id) {
            if (relation.isActive && !existing.isActive) {
              await tx.appPersonRelation.update({
                where: { id: existing.id },
                data: {
                  isActive: true,
                  updatedBy: admin.email,
                  changeReason: `Sloučení osob: ${reason}`,
                },
              });
            }
            await tx.appPersonRelation.update({
              where: { id: relation.id },
              data: {
                isActive: false,
                updatedBy: admin.email,
                changeReason: `Duplicitní po sloučení osob: ${reason}`,
              },
            });
            summary.relationsSkipped += 1;
          } else {
            await tx.appPersonRelation.update({
              where: { id: relation.id },
              data: {
                parentPersonId: nextParentPersonId,
                childPersonId: nextChildPersonId,
                updatedBy: admin.email,
                changeReason:
                  relation.changeReason ?? `Sloučení osob: ${reason}`,
              },
            });
            summary.relationsMoved += 1;
          }
        }

        const studentStates = await tx.appStudentState.updateMany({
          where: { personId: { in: mergedPersonIds } },
          data: { personId: primaryPersonId },
        });
        summary.studentStates = studentStates.count;

        const memberships = await tx.appGroupMembership.updateMany({
          where: { personId: { in: mergedPersonIds } },
          data: { personId: primaryPersonId, updatedBy: admin.email, reason },
        });
        summary.memberships = memberships.count;

        const violations = await tx.appMembershipViolation.updateMany({
          where: { personId: { in: mergedPersonIds } },
          data: { personId: primaryPersonId },
        });
        summary.violations = violations.count;

        const primaryPhoto = await tx.appPersonPhoto.findUnique({
          where: { personId: primaryPersonId },
        });
        if (!primaryPhoto) {
          const sourcePhoto = await tx.appPersonPhoto.findFirst({
            where: { personId: { in: mergedPersonIds } },
          });
          if (sourcePhoto)
            await tx.appPersonPhoto.update({
              where: { personId: sourcePhoto.personId },
              data: { personId: primaryPersonId },
            });
        }

        const primaryCalendar = await tx.appStudentCalendar.findUnique({
          where: { personId: primaryPersonId },
        });
        if (!primaryCalendar) {
          const sourceCalendar = await tx.appStudentCalendar.findFirst({
            where: { personId: { in: mergedPersonIds } },
          });
          if (sourceCalendar)
            await tx.appStudentCalendar.update({
              where: { id: sourceCalendar.id },
              data: { personId: primaryPersonId },
            });
        }
        await tx.appStudentCalendar.updateMany({
          where: { personId: { in: mergedPersonIds } },
          data: { isActive: false, syncEnabled: false },
        });

        const eventUpdates = await Promise.all([
          tx.appSchoolEvent.updateMany({
            where: { createdByPersonId: { in: mergedPersonIds } },
            data: { createdByPersonId: primaryPersonId },
          }),
          tx.appSchoolEvent.updateMany({
            where: { updatedByPersonId: { in: mergedPersonIds } },
            data: { updatedByPersonId: primaryPersonId },
          }),
          tx.appSchoolEventTarget.updateMany({
            where: { personId: { in: mergedPersonIds } },
            data: { personId: primaryPersonId },
          }),
          tx.appSchoolEventAudienceRule.updateMany({
            where: { personId: { in: mergedPersonIds } },
            data: { personId: primaryPersonId },
          }),
          tx.appSchoolEventAudienceSnapshotBatch.updateMany({
            where: { createdByPersonId: { in: mergedPersonIds } },
            data: { createdByPersonId: primaryPersonId },
          }),
          tx.appSchoolEventSeries.updateMany({
            where: { createdByPersonId: { in: mergedPersonIds } },
            data: { createdByPersonId: primaryPersonId },
          }),
          tx.appSchoolEventSeries.updateMany({
            where: { updatedByPersonId: { in: mergedPersonIds } },
            data: { updatedByPersonId: primaryPersonId },
          }),
          tx.appSchoolEventRegistration.updateMany({
            where: { changedByPersonId: { in: mergedPersonIds } },
            data: { changedByPersonId: primaryPersonId },
          }),
          tx.appSchoolEventAttendance.updateMany({
            where: { recordedByPersonId: { in: mergedPersonIds } },
            data: { recordedByPersonId: primaryPersonId },
          }),
        ]);
        summary.eventRowsMoved += eventUpdates.reduce(
          (count, update) => count + update.count,
          0,
        );

        const registrations = await tx.appSchoolEventRegistration.findMany({
          where: { personId: { in: mergedPersonIds } },
        });
        for (const registration of registrations) {
          const existing = await tx.appSchoolEventRegistration.findUnique({
            where: {
              schoolEventId_personId: {
                schoolEventId: registration.schoolEventId,
                personId: primaryPersonId,
              },
            },
          });
          if (existing) {
            summary.eventRowsSkipped += 1;
          } else {
            await tx.appSchoolEventRegistration.update({
              where: { id: registration.id },
              data: { personId: primaryPersonId },
            });
            summary.eventRowsMoved += 1;
          }
        }

        const attendances = await tx.appSchoolEventAttendance.findMany({
          where: { personId: { in: mergedPersonIds } },
        });
        for (const attendance of attendances) {
          const existing = await tx.appSchoolEventAttendance.findUnique({
            where: {
              schoolEventId_personId: {
                schoolEventId: attendance.schoolEventId,
                personId: primaryPersonId,
              },
            },
          });
          if (existing) {
            summary.eventRowsSkipped += 1;
          } else {
            await tx.appSchoolEventAttendance.update({
              where: { id: attendance.id },
              data: { personId: primaryPersonId },
            });
            summary.eventRowsMoved += 1;
          }
        }

        const snapshotItems =
          await tx.appSchoolEventAudienceSnapshotItem.findMany({
            where: { personId: { in: mergedPersonIds } },
          });
        for (const item of snapshotItems) {
          const existing =
            await tx.appSchoolEventAudienceSnapshotItem.findUnique({
              where: {
                batchId_personId: {
                  batchId: item.batchId,
                  personId: primaryPersonId,
                },
              },
            });
          if (existing) {
            summary.eventRowsSkipped += 1;
          } else {
            await tx.appSchoolEventAudienceSnapshotItem.update({
              where: { id: item.id },
              data: { personId: primaryPersonId },
            });
            summary.eventRowsMoved += 1;
          }
        }

        const profilePatch = {
          nickname:
            primary.nickname ??
            mergedPeople.find((person) => person.nickname)?.nickname,
          identifier:
            primary.identifier ??
            mergedPeople.find((person) => person.identifier)?.identifier,
          plus4uId:
            primary.plus4uId ??
            mergedPeople.find((person) => person.plus4uId)?.plus4uId,
          chipUid:
            primary.chipUid ??
            mergedPeople.find((person) => person.chipUid)?.chipUid,
          chipHid:
            primary.chipHid ??
            mergedPeople.find((person) => person.chipHid)?.chipHid,
        };

        await tx.appPerson.update({
          where: { id: primaryPersonId },
          data: profilePatch,
        });

        const now = new Date();
        await tx.appPerson.updateMany({
          where: { id: { in: mergedPersonIds } },
          data: {
            isActive: false,
            mergedIntoPersonId: primaryPersonId,
            mergedAt: now,
            mergedBy: admin.email,
            mergeReason: reason,
          },
        });

        return {
          primaryPersonId,
          mergedPersonIds,
          mergedPeople: mergedPeople.map((person) => ({
            id: person.id,
            displayName: person.displayName,
          })),
          summary,
        };
      },
      { timeout: 20_000 },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
