import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";

export const ADMIN_USERS_PAGE_SIZE = 50;
export const ADMIN_USERS_SORT_OPTIONS = ["lastName", "firstName"] as const;

export type AdminUsersSort = (typeof ADMIN_USERS_SORT_OPTIONS)[number];

export type AdminUsersSearchParams = {
  q?: string;
  roles: string[];
  source?: string;
  status?: string;
  page: number;
  sort: AdminUsersSort;
};

function trimParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export function parseAdminUsersSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): AdminUsersSearchParams {
  const rawRoles = searchParams.role;
  const roles = (
    Array.isArray(rawRoles) ? rawRoles : rawRoles ? [rawRoles] : []
  )
    .map((value) => value.trim())
    .filter(Boolean);

  const rawPage = Number(trimParam(searchParams.page));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const rawSort = trimParam(searchParams.sort);
  const sort: AdminUsersSort = ADMIN_USERS_SORT_OPTIONS.includes(
    rawSort as AdminUsersSort,
  )
    ? (rawSort as AdminUsersSort)
    : "lastName";

  return {
    q: trimParam(searchParams.q),
    roles,
    source: trimParam(searchParams.source),
    status: trimParam(searchParams.status),
    page,
    sort,
  };
}

function buildPersonWhere(
  filters: AdminUsersSearchParams,
): Prisma.AppPersonWhereInput {
  const and: Prisma.AppPersonWhereInput[] = [];
  const query = filters.q?.trim();
  const roles = filters.roles;
  const source = filters.source?.trim();
  const status = filters.status?.trim();

  if (query) {
    and.push({
      OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        { nickname: { contains: query, mode: "insensitive" } },
        { firstName: { contains: query, mode: "insensitive" } },
        { middleName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { identifier: { contains: query, mode: "insensitive" } },
        { plus4uId: { contains: query, mode: "insensitive" } },
        {
          sourceRecords: {
            some: {
              OR: [
                { primaryEmail: { contains: query, mode: "insensitive" } },
                { sourcePersonId: { contains: query, mode: "insensitive" } },
                { sourceRecordId: { contains: query, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          loginLinks: {
            some: {
              identity: {
                OR: [
                  { identityValue: { contains: query, mode: "insensitive" } },
                  { normalizedValue: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    });
  }

  if (roles.length > 0) {
    and.push({
      roles: {
        some: {
          role: { in: roles },
          isActive: true,
        },
      },
    });
  }

  if (source) {
    and.push({
      sourceRecords: {
        some: {
          sourceType: { equals: source, mode: "insensitive" },
          activeSource: true,
        },
      },
    });
  }

  if (status === "active") and.push({ isActive: true });
  if (status === "inactive") and.push({ isActive: false });

  return and.length > 0 ? { AND: and } : {};
}

export async function getAdminUsersPage(filters: AdminUsersSearchParams) {
  const where = buildPersonWhere(filters);
  const skip = (filters.page - 1) * ADMIN_USERS_PAGE_SIZE;
  const orderBy =
    filters.sort === "firstName"
      ? [
          { firstName: "asc" as const },
          { lastName: "asc" as const },
          { displayName: "asc" as const },
          { id: "asc" as const },
        ]
      : [
          { lastName: "asc" as const },
          { firstName: "asc" as const },
          { displayName: "asc" as const },
          { id: "asc" as const },
        ];

  const [people, totalCount, activeCount, inactiveCount, roles, sources] =
    await Promise.all([
      prisma.appPerson.findMany({
        where,
        orderBy,
        skip,
        take: ADMIN_USERS_PAGE_SIZE,
        select: {
          id: true,
          displayName: true,
          nickname: true,
          firstName: true,
          middleName: true,
          lastName: true,
          identifier: true,
          plus4uId: true,
          isActive: true,
          updatedAt: true,
          roles: {
            where: { isActive: true },
            orderBy: { role: "asc" },
            select: { role: true, source: true },
          },
          sourceRecords: {
            where: { activeSource: true },
            orderBy: { syncedAt: "desc" },
            take: 3,
            select: { sourceType: true, primaryEmail: true, syncedAt: true },
          },
          loginLinks: {
            orderBy: { updatedAt: "desc" },
            take: 3,
            select: {
              status: true,
              identity: {
                select: {
                  normalizedValue: true,
                  isActive: true,
                },
              },
            },
          },
          parentLinks: {
            where: { isActive: true, relationType: "parent_of" },
            select: { id: true },
          },
          childLinks: {
            where: { isActive: true, relationType: "parent_of" },
            select: { id: true },
          },
          memberships: {
            where: { validTo: null },
            select: {
              groupKind: true,
              membershipRole: true,
              group: {
                select: { code: true, name: true },
              },
            },
          },
        },
      }),
      prisma.appPerson.count({ where }),
      prisma.appPerson.count({ where: { isActive: true } }),
      prisma.appPerson.count({ where: { isActive: false } }),
      prisma.appRoleAssignment.findMany({
        where: { isActive: true },
        distinct: ["role"],
        orderBy: { role: "asc" },
        select: { role: true },
      }),
      prisma.appPersonSourceRecord.findMany({
        where: { activeSource: true },
        distinct: ["sourceType"],
        orderBy: { sourceType: "asc" },
        select: { sourceType: true },
      }),
    ]);

  const loginEmails = [
    ...new Set(
      people
        .flatMap((person) => [
          ...person.sourceRecords.map((record) => record.primaryEmail),
          ...person.loginLinks.map((link) => link.identity.normalizedValue),
        ])
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const authUsers = loginEmails.length
    ? await prisma.user.findMany({
        where: { email: { in: loginEmails } },
        select: {
          email: true,
          emailVerified: true,
          accounts: { select: { provider: true } },
          sessions: {
            orderBy: { expires: "desc" },
            take: 1,
            select: { expires: true },
          },
        },
      })
    : [];

  const authByEmail = new Map(
    authUsers
      .filter((user) => user.email)
      .map((user) => [
        user.email!.toLowerCase(),
        {
          emailVerified: user.emailVerified,
          providers: user.accounts.map((account) => account.provider),
          activeSessionExpires: user.sessions[0]?.expires ?? null,
        },
      ]),
  );

  return {
    people,
    totalCount,
    activeCount,
    inactiveCount,
    page: filters.page,
    pageSize: ADMIN_USERS_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(totalCount / ADMIN_USERS_PAGE_SIZE)),
    roleOptions: roles.map((item) => item.role).filter(Boolean),
    sourceOptions: sources.map((item) => item.sourceType).filter(Boolean),
    authByEmail,
  };
}

export async function getAdminUserDetail(personId: string) {
  const person = await prisma.appPerson.findUnique({
    where: { id: personId },
    select: {
      id: true,
      dedupKey: true,
      displayName: true,
      nickname: true,
      firstName: true,
      middleName: true,
      lastName: true,
      identifier: true,
      plus4uId: true,
      chipUid: true,
      chipHid: true,
      isActive: true,
      mergedIntoPersonId: true,
      mergedAt: true,
      mergedBy: true,
      mergeReason: true,
      mergedIntoPerson: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          middleName: true,
          lastName: true,
        },
      },
      createdAt: true,
      updatedAt: true,
      roles: {
        orderBy: [{ isActive: "desc" }, { role: "asc" }],
        select: {
          id: true,
          role: true,
          source: true,
          isActive: true,
          validFrom: true,
          validTo: true,
          updatedAt: true,
        },
      },
      sourceRecords: {
        orderBy: [{ activeSource: "desc" }, { syncedAt: "desc" }],
        select: {
          id: true,
          sourceType: true,
          sourceKey: true,
          sourcePersonId: true,
          sourceRecordId: true,
          organizationIdent: true,
          primaryEmail: true,
          activeSource: true,
          derivedRoles: true,
          payload: true,
          syncedAt: true,
          updatedAt: true,
        },
      },
      loginLinks: {
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          status: true,
          approvedBy: true,
          approvedAt: true,
          reason: true,
          updatedAt: true,
          identity: {
            select: {
              id: true,
              identityType: true,
              identityValue: true,
              normalizedValue: true,
              isActive: true,
            },
          },
        },
      },
      parentLinks: {
        where: { relationType: "parent_of" },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          source: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          childPerson: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              middleName: true,
              lastName: true,
              roles: {
                where: { isActive: true },
                select: { role: true },
              },
            },
          },
        },
      },
      childLinks: {
        where: { relationType: "parent_of" },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          source: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          parentPerson: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              middleName: true,
              lastName: true,
              roles: {
                where: { isActive: true },
                select: { role: true },
              },
            },
          },
        },
      },
      studentStates: {
        orderBy: [{ effectiveTo: "asc" }, { effectiveFrom: "desc" }],
        take: 5,
        select: {
          id: true,
          sourceType: true,
          effectiveFrom: true,
          effectiveTo: true,
          currentGradeNum: true,
          initialGradeNum: true,
          studyModeCode: true,
          studyModeKey: true,
          schoolYear: {
            select: { code: true },
          },
        },
      },
      memberships: {
        orderBy: [{ validTo: "asc" }, { groupKind: "asc" }],
        select: {
          id: true,
          groupKind: true,
          membershipRole: true,
          validFrom: true,
          validTo: true,
          source: true,
          reason: true,
          group: {
            select: {
              id: true,
              kind: true,
              code: true,
              name: true,
              isActive: true,
              schoolYear: {
                select: { code: true, isActive: true },
              },
            },
          },
        },
      },
      violations: {
        where: { resolvedAt: null },
        orderBy: { occurredAt: "desc" },
        take: 10,
        select: {
          id: true,
          occurredAt: true,
          groupKind: true,
          expectedMin: true,
          expectedMax: true,
          actualCount: true,
          severity: true,
          source: true,
        },
      },
    },
  });

  if (!person) notFound();
  return person;
}

export async function getAdminPersonMergeOptions() {
  return prisma.appPerson.findMany({
    where: {
      mergedIntoPersonId: null,
    },
    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" },
      { displayName: "asc" },
      { id: "asc" },
    ],
    select: {
      id: true,
      displayName: true,
      firstName: true,
      middleName: true,
      lastName: true,
      nickname: true,
      identifier: true,
      plus4uId: true,
      isActive: true,
      roles: {
        where: { isActive: true },
        orderBy: { role: "asc" },
        select: { role: true },
      },
      sourceRecords: {
        where: { activeSource: true },
        orderBy: { syncedAt: "desc" },
        take: 3,
        select: {
          sourceType: true,
          primaryEmail: true,
          organizationIdent: true,
          sourcePersonId: true,
          sourceRecordId: true,
        },
      },
      loginLinks: {
        where: { identity: { isActive: true } },
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: {
          status: true,
          identity: { select: { normalizedValue: true } },
        },
      },
    },
  });
}
