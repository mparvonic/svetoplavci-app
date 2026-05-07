import { prisma } from "@/src/lib/prisma";

export const ADMIN_DATA_QUALITY_PREVIEW_LIMIT = 12;

const personSelect = {
  id: true,
  displayName: true,
  firstName: true,
  middleName: true,
  lastName: true,
  nickname: true,
  isActive: true,
  roles: {
    where: { isActive: true },
    orderBy: { role: "asc" },
    select: { role: true },
  },
  sourceRecords: {
    where: { activeSource: true },
    orderBy: { syncedAt: "desc" },
    take: 2,
    select: { sourceType: true, primaryEmail: true, organizationIdent: true },
  },
} as const;

export type DataQualityIssueSeverity = "error" | "warning";
export type DataQualityIssueKind =
  | "child_without_parent"
  | "parent_without_child"
  | "child_without_smecka"
  | "child_without_study_group"
  | "guide_without_smecka"
  | "login_conflict"
  | "membership_violation";

export type DataQualityIssue = {
  id: string;
  kind: DataQualityIssueKind;
  severity: DataQualityIssueSeverity;
  title: string;
  subject: string;
  detail: string;
  href: string;
  source: string;
  createdAt?: Date | null;
};

function personDisplayName(person: {
  displayName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}) {
  const structuredName = [person.firstName, person.middleName, person.lastName]
    .filter(Boolean)
    .join(" ");
  return structuredName || person.displayName || "Neznámá osoba";
}

function personSourceLabel(person: {
  sourceRecords: {
    sourceType: string;
    primaryEmail: string | null;
    organizationIdent: string | null;
  }[];
}) {
  const primary = person.sourceRecords[0];
  if (!primary) return "bez zdroje";
  return [
    primary.sourceType,
    primary.primaryEmail,
    primary.organizationIdent ? `org ${primary.organizationIdent}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export async function getAdminDataQualityPage() {
  const [
    childrenWithoutParentsCount,
    parentsWithoutChildrenCount,
    childrenWithoutSmeckaCount,
    childrenWithoutStudyGroupCount,
    guidesWithoutSmeckaCount,
    openIdentityConflictsCount,
    openMembershipViolationsCount,
    childrenWithoutParents,
    parentsWithoutChildren,
    childrenWithoutSmecka,
    childrenWithoutStudyGroup,
    guidesWithoutSmecka,
    identityConflicts,
    membershipViolations,
  ] = await Promise.all([
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
    prisma.appPerson.findMany({
      where: {
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
        childLinks: { none: { relationType: "parent_of", isActive: true } },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
        { displayName: "asc" },
      ],
      take: ADMIN_DATA_QUALITY_PREVIEW_LIMIT,
      select: personSelect,
    }),
    prisma.appPerson.findMany({
      where: {
        isActive: true,
        roles: { some: { role: "rodic", isActive: true } },
        parentLinks: { none: { relationType: "parent_of", isActive: true } },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
        { displayName: "asc" },
      ],
      take: ADMIN_DATA_QUALITY_PREVIEW_LIMIT,
      select: personSelect,
    }),
    prisma.appPerson.findMany({
      where: {
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
        memberships: { none: { groupKind: "smecka", validTo: null } },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
        { displayName: "asc" },
      ],
      take: ADMIN_DATA_QUALITY_PREVIEW_LIMIT,
      select: personSelect,
    }),
    prisma.appPerson.findMany({
      where: {
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
        memberships: { none: { groupKind: "studijni_skupina", validTo: null } },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
        { displayName: "asc" },
      ],
      take: ADMIN_DATA_QUALITY_PREVIEW_LIMIT,
      select: personSelect,
    }),
    prisma.appPerson.findMany({
      where: {
        isActive: true,
        roles: { some: { role: "pruvodce", isActive: true } },
        memberships: { none: { groupKind: "smecka", validTo: null } },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
        { displayName: "asc" },
      ],
      take: ADMIN_DATA_QUALITY_PREVIEW_LIMIT,
      select: personSelect,
    }),
    prisma.appIdentityConflict.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: ADMIN_DATA_QUALITY_PREVIEW_LIMIT,
      select: {
        id: true,
        normalizedValue: true,
        reason: true,
        createdAt: true,
        identityId: true,
      },
    }),
    prisma.appMembershipViolation.findMany({
      where: { resolvedAt: null },
      orderBy: { occurredAt: "desc" },
      take: ADMIN_DATA_QUALITY_PREVIEW_LIMIT,
      select: {
        id: true,
        occurredAt: true,
        groupKind: true,
        expectedMin: true,
        expectedMax: true,
        actualCount: true,
        severity: true,
        source: true,
        person: { select: personSelect },
      },
    }),
  ]);

  const issues: DataQualityIssue[] = [
    ...childrenWithoutParents.map((person) => ({
      id: `child_without_parent:${person.id}`,
      kind: "child_without_parent" as const,
      severity: "error" as const,
      title: "Dítě bez rodiče",
      subject: personDisplayName(person),
      detail: personSourceLabel(person),
      href: `/admin/vazby?q=${encodeURIComponent(personDisplayName(person))}`,
      source: "AppPersonRelation",
    })),
    ...parentsWithoutChildren.map((person) => ({
      id: `parent_without_child:${person.id}`,
      kind: "parent_without_child" as const,
      severity: "warning" as const,
      title: "Rodič bez dítěte",
      subject: personDisplayName(person),
      detail: personSourceLabel(person),
      href: `/admin/vazby?q=${encodeURIComponent(personDisplayName(person))}`,
      source: "AppPersonRelation",
    })),
    ...childrenWithoutSmecka.map((person) => ({
      id: `child_without_smecka:${person.id}`,
      kind: "child_without_smecka" as const,
      severity: "error" as const,
      title: "Dítě bez smečky",
      subject: personDisplayName(person),
      detail: personSourceLabel(person),
      href: `/admin/uzivatele/${person.id}`,
      source: "AppGroupMembership",
    })),
    ...childrenWithoutStudyGroup.map((person) => ({
      id: `child_without_study_group:${person.id}`,
      kind: "child_without_study_group" as const,
      severity: "error" as const,
      title: "Dítě bez studijní skupiny",
      subject: personDisplayName(person),
      detail: personSourceLabel(person),
      href: `/admin/uzivatele/${person.id}`,
      source: "AppGroupMembership",
    })),
    ...guidesWithoutSmecka.map((person) => ({
      id: `guide_without_smecka:${person.id}`,
      kind: "guide_without_smecka" as const,
      severity: "warning" as const,
      title: "Průvodce bez smečky",
      subject: personDisplayName(person),
      detail: personSourceLabel(person),
      href: `/admin/uzivatele/${person.id}`,
      source: "AppGroupMembership",
    })),
    ...identityConflicts.map((conflict) => ({
      id: `login_conflict:${conflict.id}`,
      kind: "login_conflict" as const,
      severity: "error" as const,
      title: "Login konflikt",
      subject: conflict.normalizedValue,
      detail: conflict.reason,
      href: conflict.identityId
        ? `/admin/pristupy?status=conflict#konflikt-${conflict.id}`
        : "/admin/pristupy?status=conflict",
      source: "AppIdentityConflict",
      createdAt: conflict.createdAt,
    })),
    ...membershipViolations.map((violation) => ({
      id: `membership_violation:${violation.id}`,
      kind: "membership_violation" as const,
      severity:
        violation.severity === "error"
          ? ("error" as const)
          : ("warning" as const),
      title: "Porušení členství",
      subject: personDisplayName(violation.person),
      detail: `${violation.groupKind}: očekáváno ${violation.expectedMin}-${violation.expectedMax ?? "∞"}, aktuálně ${violation.actualCount}`,
      href: `/admin/uzivatele/${violation.person.id}`,
      source: violation.source,
      createdAt: violation.occurredAt,
    })),
  ];

  return {
    counts: {
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
    issues,
  };
}
