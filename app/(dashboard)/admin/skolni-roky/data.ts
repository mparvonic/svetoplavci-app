import { prisma } from "@/src/lib/prisma";

export async function getAdminSchoolYearsPage() {
  const [
    schoolYears,
    groups,
    activeStudentsCount,
    activeGuidesCount,
    childrenWithoutSmeckaCount,
    childrenWithoutStudyGroupCount,
    guidesWithoutSmeckaCount,
    openMembershipViolationsCount,
    policies,
  ] = await Promise.all([
    prisma.appSchoolYear.findMany({
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
      select: {
        id: true,
        code: true,
        startDate: true,
        endDate: true,
        teachingStartDate: true,
        teachingEndDate: true,
        term1EndDate: true,
        term2StartDate: true,
        isActive: true,
        groups: {
          orderBy: [{ kind: "asc" }, { name: "asc" }],
          select: { id: true },
        },
      },
    }),
    prisma.appGroup.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }, { code: "asc" }],
      select: {
        id: true,
        kind: true,
        code: true,
        name: true,
        isActive: true,
        validFrom: true,
        validTo: true,
        schoolYear: {
          select: { code: true, isActive: true },
        },
        memberships: {
          where: { validTo: null },
          select: {
            id: true,
            membershipRole: true,
            person: {
              select: {
                id: true,
                roles: {
                  where: { isActive: true },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.appPerson.count({
      where: {
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
      },
    }),
    prisma.appPerson.count({
      where: {
        isActive: true,
        roles: { some: { role: "pruvodce", isActive: true } },
      },
    }),
    prisma.appPerson.count({
      where: {
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
        memberships: { none: { groupKind: "smecka", validTo: null } },
      },
    }),
    prisma.appPerson.count({
      where: {
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
        memberships: { none: { groupKind: "studijni_skupina", validTo: null } },
      },
    }),
    prisma.appPerson.count({
      where: {
        isActive: true,
        roles: { some: { role: "pruvodce", isActive: true } },
        memberships: { none: { groupKind: "smecka", validTo: null } },
      },
    }),
    prisma.appMembershipViolation.count({ where: { resolvedAt: null } }),
    prisma.appMembershipPolicy.findMany({
      where: { isActive: true },
      orderBy: [{ scope: "asc" }, { priority: "asc" }],
      select: {
        id: true,
        scope: true,
        scopeValue: true,
        priority: true,
        validFrom: true,
        validTo: true,
        rules: {
          orderBy: { groupKind: "asc" },
          select: {
            id: true,
            groupKind: true,
            minCount: true,
            maxCount: true,
            enforcement: true,
          },
        },
      },
    }),
  ]);

  const activeSchoolYear =
    schoolYears.find((year) => year.isActive) ?? schoolYears[0] ?? null;
  const groupSummaries = groups.map((group) => {
    const studentCount = group.memberships.filter((membership) =>
      membership.person.roles.some((role) => role.role === "zak"),
    ).length;
    const guideCount = group.memberships.filter((membership) =>
      membership.person.roles.some((role) => role.role === "pruvodce"),
    ).length;
    const otherCount = group.memberships.length - studentCount - guideCount;

    return {
      id: group.id,
      kind: group.kind,
      code: group.code,
      name: group.name,
      isActive: group.isActive,
      validFrom: group.validFrom,
      validTo: group.validTo,
      schoolYear: group.schoolYear,
      membershipCount: group.memberships.length,
      studentCount,
      guideCount,
      otherCount,
    };
  });

  const groupKindSummary = groupSummaries.reduce(
    (acc, group) => {
      const bucket = acc.get(group.kind) ?? {
        kind: group.kind,
        groupsCount: 0,
        activeGroupsCount: 0,
        membershipCount: 0,
        studentCount: 0,
        guideCount: 0,
      };
      bucket.groupsCount += 1;
      if (group.isActive) bucket.activeGroupsCount += 1;
      bucket.membershipCount += group.membershipCount;
      bucket.studentCount += group.studentCount;
      bucket.guideCount += group.guideCount;
      acc.set(group.kind, bucket);
      return acc;
    },
    new Map<
      string,
      {
        kind: string;
        groupsCount: number;
        activeGroupsCount: number;
        membershipCount: number;
        studentCount: number;
        guideCount: number;
      }
    >(),
  );

  return {
    schoolYears,
    activeSchoolYear,
    groupSummaries,
    groupKindSummary: Array.from(groupKindSummary.values()),
    activeStudentsCount,
    activeGuidesCount,
    childrenWithoutSmeckaCount,
    childrenWithoutStudyGroupCount,
    guidesWithoutSmeckaCount,
    openMembershipViolationsCount,
    policies,
  };
}
