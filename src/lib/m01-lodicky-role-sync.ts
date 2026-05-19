import { Prisma } from "@prisma/client";

export const M01_DERIVED_ROLE_SOURCE = "m01_lodicky_assignment";
export const M01_DERIVED_ROLE_CODES = ["spravce_lodicek", "garant"] as const;

export type M01DerivedRoleCode = (typeof M01_DERIVED_ROLE_CODES)[number];

export function isM01DerivedRole(role: string): role is M01DerivedRoleCode {
  return (M01_DERIVED_ROLE_CODES as readonly string[]).includes(role);
}

function uniqueIds(personIds: string[]): string[] {
  return [...new Set(personIds.map((personId) => personId.trim()).filter(Boolean))];
}

async function setDerivedRole(
  tx: Prisma.TransactionClient,
  input: {
    personId: string;
    role: M01DerivedRoleCode;
    shouldBeActive: boolean;
    now: Date;
  },
) {
  if (input.shouldBeActive) {
    const existing = await tx.appRoleAssignment.findFirst({
      where: {
        personId: input.personId,
        role: input.role,
        source: M01_DERIVED_ROLE_SOURCE,
      },
      select: { id: true },
    });

    if (existing) {
      await tx.appRoleAssignment.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          validFrom: input.now,
          validTo: null,
        },
      });
    } else {
      await tx.appRoleAssignment.create({
        data: {
          personId: input.personId,
          role: input.role,
          source: M01_DERIVED_ROLE_SOURCE,
          isActive: true,
          validFrom: input.now,
        },
      });
    }

    await tx.appRoleAssignment.updateMany({
      where: {
        personId: input.personId,
        role: input.role,
        source: { not: M01_DERIVED_ROLE_SOURCE },
        isActive: true,
      },
      data: {
        isActive: false,
        validTo: input.now,
      },
    });
    return;
  }

  await tx.appRoleAssignment.updateMany({
    where: {
      personId: input.personId,
      role: input.role,
      isActive: true,
    },
    data: {
      isActive: false,
      validTo: input.now,
    },
  });
}

export async function syncM01DerivedRolesForPersons(
  tx: Prisma.TransactionClient,
  personIds: string[],
) {
  const ids = uniqueIds(personIds);
  if (ids.length === 0) return;

  const rows = await tx.$queryRaw<
    Array<{
      personId: string;
      hasPruvodce: boolean;
      hasSpravceAssignments: boolean;
      hasGarantAssignments: boolean;
    }>
  >(Prisma.sql`
    SELECT
      p.id AS "personId",
      EXISTS (
        SELECT 1
        FROM app_role_assignment role_pruvodce
        WHERE role_pruvodce.person_id = p.id
          AND role_pruvodce.role = 'pruvodce'
          AND role_pruvodce.is_active = true
      ) AS "hasPruvodce",
      EXISTS (
        SELECT 1
        FROM app_m01_oblast_spravce os
        JOIN app_m01_oblast o ON o.id = os.oblast_id AND o.is_active = true
        WHERE os.person_id = p.id
        UNION ALL
        SELECT 1
        FROM app_m01_lodicka_garant lg
        JOIN app_m01_lodicka l ON l.id = lg.lodicka_id AND l.is_deleted = false
        WHERE lg.person_id = p.id
      ) AS "hasSpravceAssignments",
      EXISTS (
        SELECT 1
        FROM app_m01_lodicka_stav_garant sg
        JOIN app_m01_lodicka l ON l.id = sg.lodicka_id AND l.is_deleted = false
        WHERE sg.person_id = p.id
      ) AS "hasGarantAssignments"
    FROM app_person p
    WHERE p.id IN (${Prisma.join(ids)})
      AND p.is_active = true
  `);
  const now = new Date();
  const rowsByPersonId = new Map(rows.map((row) => [row.personId, row]));

  for (const personId of ids) {
    const row = rowsByPersonId.get(personId);
    const hasPruvodce = row?.hasPruvodce === true;
    await setDerivedRole(tx, {
      personId,
      role: "spravce_lodicek",
      shouldBeActive: hasPruvodce && row?.hasSpravceAssignments === true,
      now,
    });
    await setDerivedRole(tx, {
      personId,
      role: "garant",
      shouldBeActive: hasPruvodce && row?.hasGarantAssignments === true,
      now,
    });
  }
}

export async function removeM01AssignmentsForPersons(
  tx: Prisma.TransactionClient,
  personIds: string[],
) {
  const ids = uniqueIds(personIds);
  if (ids.length === 0) return;

  await tx.$executeRaw(Prisma.sql`
    DELETE FROM app_m01_oblast_spravce
    WHERE person_id IN (${Prisma.join(ids)})
  `);
  await tx.$executeRaw(Prisma.sql`
    DELETE FROM app_m01_lodicka_stav_garant
    WHERE person_id IN (${Prisma.join(ids)})
  `);
  await tx.$executeRaw(Prisma.sql`
    DELETE FROM app_m01_lodicka_garant
    WHERE person_id IN (${Prisma.join(ids)})
  `);

  await syncM01DerivedRolesForPersons(tx, ids);
}
