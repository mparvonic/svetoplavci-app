import { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";

export const ADMIN_RELATIONS_PAGE_SIZE = 50;

export type AdminRelationsSearchParams = {
  q?: string;
  source?: string;
  status?: string;
  page: number;
};

function trimParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export function parseAdminRelationsSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): AdminRelationsSearchParams {
  const rawPage = Number(trimParam(searchParams.page));
  return {
    q: trimParam(searchParams.q),
    source: trimParam(searchParams.source),
    status: trimParam(searchParams.status),
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

function personSearch(query: string): Prisma.AppPersonWhereInput {
  return {
    OR: [
      { displayName: { contains: query, mode: "insensitive" } },
      { nickname: { contains: query, mode: "insensitive" } },
      { firstName: { contains: query, mode: "insensitive" } },
      { middleName: { contains: query, mode: "insensitive" } },
      { lastName: { contains: query, mode: "insensitive" } },
      { identifier: { contains: query, mode: "insensitive" } },
      {
        sourceRecords: {
          some: {
            primaryEmail: { contains: query, mode: "insensitive" },
          },
        },
      },
      {
        loginLinks: {
          some: {
            identity: {
              normalizedValue: { contains: query, mode: "insensitive" },
            },
          },
        },
      },
    ],
  };
}

function buildRelationWhere(
  filters: AdminRelationsSearchParams,
): Prisma.AppPersonRelationWhereInput {
  const and: Prisma.AppPersonRelationWhereInput[] = [
    { relationType: "parent_of" },
  ];
  const query = filters.q?.trim();
  const source = filters.source?.trim();
  const status = filters.status?.trim();

  if (query) {
    and.push({
      OR: [
        { parentPerson: personSearch(query) },
        { childPerson: personSearch(query) },
      ],
    });
  }

  if (source) and.push({ source });
  if (status === "active") and.push({ isActive: true });
  if (status === "inactive") and.push({ isActive: false });

  return and.length > 0 ? { AND: and } : {};
}

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
    select: { sourceType: true, primaryEmail: true },
  },
  loginLinks: {
    where: { status: "approved", identity: { isActive: true } },
    orderBy: { approvedAt: "desc" },
    take: 1,
    select: {
      identity: {
        select: { normalizedValue: true },
      },
    },
  },
  parentLinks: {
    where: { relationType: "parent_of", isActive: true },
    select: { childPersonId: true },
  },
  childLinks: {
    where: { relationType: "parent_of", isActive: true },
    select: { parentPersonId: true },
  },
} satisfies Prisma.AppPersonSelect;

export async function getAdminRelationsPage(
  filters: AdminRelationsSearchParams,
) {
  const where = buildRelationWhere(filters);
  const skip = (filters.page - 1) * ADMIN_RELATIONS_PAGE_SIZE;

  const [
    relations,
    totalCount,
    activeCount,
    inactiveCount,
    childrenWithoutParentsCount,
    parentsWithoutChildrenCount,
    childrenWithoutParents,
    parentsWithoutChildren,
    sourceOptions,
    parentOptions,
    childOptions,
  ] = await Promise.all([
    prisma.appPersonRelation.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
      skip,
      take: ADMIN_RELATIONS_PAGE_SIZE,
      select: {
        id: true,
        source: true,
        isActive: true,
        createdBy: true,
        updatedBy: true,
        changeReason: true,
        createdAt: true,
        updatedAt: true,
        parentPerson: { select: personSelect },
        childPerson: { select: personSelect },
      },
    }),
    prisma.appPersonRelation.count({ where }),
    prisma.appPersonRelation.count({
      where: { relationType: "parent_of", isActive: true },
    }),
    prisma.appPersonRelation.count({
      where: { relationType: "parent_of", isActive: false },
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
      take: 8,
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
      take: 8,
      select: personSelect,
    }),
    prisma.appPersonRelation.findMany({
      where: { relationType: "parent_of" },
      distinct: ["source"],
      orderBy: { source: "asc" },
      select: { source: true },
    }),
    prisma.appPerson.findMany({
      where: {
        isActive: true,
        roles: { some: { role: "rodic", isActive: true } },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
        { displayName: "asc" },
      ],
      select: personSelect,
    }),
    prisma.appPerson.findMany({
      where: {
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
        { displayName: "asc" },
      ],
      select: personSelect,
    }),
  ]);

  return {
    relations,
    totalCount,
    activeCount,
    inactiveCount,
    childrenWithoutParentsCount,
    parentsWithoutChildrenCount,
    childrenWithoutParents,
    parentsWithoutChildren,
    sourceOptions: sourceOptions.map((item) => item.source).filter(Boolean),
    parentOptions,
    childOptions,
    page: filters.page,
    pageSize: ADMIN_RELATIONS_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(totalCount / ADMIN_RELATIONS_PAGE_SIZE)),
  };
}
