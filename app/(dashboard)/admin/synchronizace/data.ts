import { prisma } from "@/src/lib/prisma";

export const ADMIN_SYNC_RUN_LIMIT = 30;

export async function getAdminSyncPage() {
  const [
    runs,
    totalRuns,
    successRuns,
    failedRuns,
    runningRuns,
    sourceStats,
    childrenWithoutParentsCount,
    parentsWithoutChildrenCount,
    childrenWithoutSmeckaCount,
    childrenWithoutStudyGroupCount,
    guidesWithoutSmeckaCount,
    openIdentityConflictsCount,
    openMembershipViolationsCount,
  ] = await Promise.all([
    prisma.appUserSyncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: ADMIN_SYNC_RUN_LIMIT,
    }),
    prisma.appUserSyncRun.count(),
    prisma.appUserSyncRun.count({ where: { status: "success" } }),
    prisma.appUserSyncRun.count({ where: { status: "failed" } }),
    prisma.appUserSyncRun.count({ where: { status: "running" } }),
    prisma.appPersonSourceRecord.groupBy({
      by: ["sourceType", "activeSource"],
      _count: { _all: true },
      _max: { syncedAt: true },
      orderBy: [{ sourceType: "asc" }, { activeSource: "desc" }],
    }),
    prisma.appPerson.count({
      where: {
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
        childLinks: { none: { relationType: "parent_of", isActive: true } },
      },
    }),
    prisma.appPerson.count({
      where: {
        isActive: true,
        roles: { some: { role: "rodic", isActive: true } },
        parentLinks: { none: { relationType: "parent_of", isActive: true } },
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
    prisma.appIdentityConflict.count({ where: { status: "open" } }),
    prisma.appMembershipViolation.count({ where: { resolvedAt: null } }),
  ]);

  const latestRun = runs[0] ?? null;
  const latestSuccessfulRun =
    runs.find((run) => run.status === "success") ?? null;
  const sourceSummary = sourceStats.map((item) => ({
    sourceType: item.sourceType,
    activeSource: item.activeSource,
    count: item._count._all,
    lastSyncedAt: item._max.syncedAt,
  }));

  return {
    runs,
    latestRun,
    latestSuccessfulRun,
    totalRuns,
    successRuns,
    failedRuns,
    runningRuns,
    sourceSummary,
    quality: {
      childrenWithoutParentsCount,
      parentsWithoutChildrenCount,
      childrenWithoutSmeckaCount,
      childrenWithoutStudyGroupCount,
      guidesWithoutSmeckaCount,
      openIdentityConflictsCount,
      openMembershipViolationsCount,
      totalIssues:
        childrenWithoutParentsCount +
        parentsWithoutChildrenCount +
        childrenWithoutSmeckaCount +
        childrenWithoutStudyGroupCount +
        guidesWithoutSmeckaCount +
        openIdentityConflictsCount +
        openMembershipViolationsCount,
    },
  };
}
