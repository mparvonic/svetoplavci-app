import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

const MANUAL_RELATION_SOURCE = "manual_admin";
const MAX_REASON_LENGTH = 500;

function collectRoles(
  session: { user?: { role?: unknown; roles?: unknown } } | null,
): string[] {
  if (!session?.user) return [];
  if (Array.isArray(session.user.roles)) {
    return session.user.roles.map((value) => String(value));
  }
  if (typeof session.user.role === "string" && session.user.role) {
    return [session.user.role];
  }
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

function collectPersonIds(
  payload: Record<string, unknown>,
  arrayKey: string,
  singleKey: string,
): string[] {
  const values: unknown[] = [];
  const arrayValue = payload[arrayKey];
  if (Array.isArray(arrayValue)) values.push(...arrayValue);
  values.push(payload[singleKey]);

  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

async function validatePeople(
  parentPersonIds: string[],
  childPersonIds: string[],
) {
  const allPersonIds = Array.from(
    new Set([...parentPersonIds, ...childPersonIds]),
  );
  const people = await prisma.appPerson.findMany({
    where: { id: { in: allPersonIds } },
    select: {
      id: true,
      isActive: true,
      roles: {
        where: { isActive: true },
        select: { role: true },
      },
    },
  });
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const missingPersonId = allPersonIds.find(
    (personId) => !peopleById.has(personId),
  );

  if (missingPersonId) {
    throw new Error("Některá vybraná osoba nebyla nalezena.");
  }
  if (people.some((person) => !person.isActive)) {
    throw new Error("Vazbu lze vytvořit jen mezi aktivními osobami.");
  }
  const invalidParentId = parentPersonIds.find((personId) => {
    const person = peopleById.get(personId);
    return !person?.roles.some((role) => role.role === "rodic");
  });
  if (invalidParentId) {
    throw new Error("Vybraná osoba nemá aktivní roli rodič.");
  }
  const invalidChildId = childPersonIds.find((personId) => {
    const person = peopleById.get(personId);
    return !person?.roles.some((role) => role.role === "zak");
  });
  if (invalidChildId) {
    throw new Error("Vybraná osoba nemá aktivní roli žák.");
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  const payload = await readJson(req);
  const parentPersonIds = collectPersonIds(
    payload,
    "parentPersonIds",
    "parentPersonId",
  );
  const childPersonIds = collectPersonIds(
    payload,
    "childPersonIds",
    "childPersonId",
  );
  const reason = cleanReason(payload.reason);

  if (parentPersonIds.length === 0 || childPersonIds.length === 0) {
    return NextResponse.json(
      { error: "Vyberte alespoň jednoho rodiče a jedno dítě." },
      { status: 400 },
    );
  }
  if (
    parentPersonIds.some((parentPersonId) =>
      childPersonIds.includes(parentPersonId),
    )
  ) {
    return NextResponse.json(
      { error: "Stejná osoba nemůže být v jedné změně rodičem i dítětem." },
      { status: 400 },
    );
  }
  if (!reason) {
    return NextResponse.json(
      { error: "Doplňte důvod ruční změny." },
      { status: 400 },
    );
  }

  try {
    await validatePeople(parentPersonIds, childPersonIds);

    const result = await prisma.$transaction(async (tx) => {
      const relationIds: string[] = [];
      let createdCount = 0;
      let reactivatedCount = 0;
      let existingCount = 0;

      for (const parentPersonId of parentPersonIds) {
        for (const childPersonId of childPersonIds) {
          const activeExisting = await tx.appPersonRelation.findFirst({
            where: {
              parentPersonId,
              childPersonId,
              relationType: "parent_of",
              isActive: true,
            },
          });
          if (activeExisting) {
            relationIds.push(activeExisting.id);
            existingCount += 1;
            continue;
          }

          const inactiveManual = await tx.appPersonRelation.findUnique({
            where: {
              parentPersonId_childPersonId_relationType_source: {
                parentPersonId,
                childPersonId,
                relationType: "parent_of",
                source: MANUAL_RELATION_SOURCE,
              },
            },
          });
          if (inactiveManual) {
            const relation = await tx.appPersonRelation.update({
              where: { id: inactiveManual.id },
              data: {
                isActive: true,
                updatedBy: admin.email,
                changeReason: reason,
              },
            });
            relationIds.push(relation.id);
            reactivatedCount += 1;
            continue;
          }

          const relation = await tx.appPersonRelation.create({
            data: {
              parentPersonId,
              childPersonId,
              relationType: "parent_of",
              source: MANUAL_RELATION_SOURCE,
              isActive: true,
              createdBy: admin.email,
              updatedBy: admin.email,
              changeReason: reason,
            },
          });
          relationIds.push(relation.id);
          createdCount += 1;
        }
      }

      return { createdCount, reactivatedCount, existingCount, relationIds };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  const payload = await readJson(req);
  const relationId =
    typeof payload.relationId === "string" ? payload.relationId.trim() : "";
  const isActive =
    typeof payload.isActive === "boolean" ? payload.isActive : null;
  const reason = cleanReason(payload.reason);

  if (!relationId) {
    return NextResponse.json(
      { error: "Chybí identifikátor vazby." },
      { status: 400 },
    );
  }
  if (isActive === null) {
    return NextResponse.json(
      { error: "Chybí nový stav vazby." },
      { status: 400 },
    );
  }
  if (!reason) {
    return NextResponse.json(
      { error: "Doplňte důvod ruční změny." },
      { status: 400 },
    );
  }

  try {
    const relation = await prisma.appPersonRelation.update({
      where: { id: relationId },
      data: {
        isActive,
        updatedBy: admin.email,
        changeReason: reason,
      },
    });

    return NextResponse.json({ ok: true, relationId: relation.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
