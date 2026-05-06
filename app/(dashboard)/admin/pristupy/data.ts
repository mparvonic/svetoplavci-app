import { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";

export const ADMIN_ACCESS_PAGE_SIZE = 50;

export type AdminAccessSearchParams = {
  q?: string;
  status?: string;
  page: number;
};

function trimParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export function parseAdminAccessSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): AdminAccessSearchParams {
  const rawPage = Number(trimParam(searchParams.page));
  return {
    q: trimParam(searchParams.q),
    status: trimParam(searchParams.status),
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

function buildIdentityWhere(filters: AdminAccessSearchParams): Prisma.AppLoginIdentityWhereInput {
  const and: Prisma.AppLoginIdentityWhereInput[] = [];
  const query = filters.q?.trim();

  if (query) {
    and.push({
      OR: [
        { identityValue: { contains: query, mode: "insensitive" } },
        { normalizedValue: { contains: query, mode: "insensitive" } },
        {
          personLinks: {
            some: {
              person: {
                OR: [
                  { displayName: { contains: query, mode: "insensitive" } },
                  { firstName: { contains: query, mode: "insensitive" } },
                  { lastName: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    });
  }

  if (filters.status === "active") and.push({ isActive: true });
  if (filters.status === "inactive") and.push({ isActive: false });
  if (filters.status === "approved") and.push({ personLinks: { some: { status: "approved" } } });
  if (filters.status === "pending") and.push({ personLinks: { some: { status: "pending" } } });
  if (filters.status === "conflict") and.push({ conflicts: { some: { status: "open" } } });

  return and.length > 0 ? { AND: and } : {};
}

export async function getAdminAccessPage(filters: AdminAccessSearchParams) {
  const where = buildIdentityWhere(filters);
  const skip = (filters.page - 1) * ADMIN_ACCESS_PAGE_SIZE;

  const [
    identities,
    totalCount,
    activeIdentities,
    approvedLinks,
    pendingLinks,
    openConflictsCount,
  ] = await Promise.all([
    prisma.appLoginIdentity.findMany({
      where,
      orderBy: [{ normalizedValue: "asc" }, { id: "asc" }],
      skip,
      take: ADMIN_ACCESS_PAGE_SIZE,
      select: {
        id: true,
        identityType: true,
        identityValue: true,
        normalizedValue: true,
        isActive: true,
        updatedAt: true,
        personLinks: {
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          select: {
            id: true,
            status: true,
            approvedBy: true,
            approvedAt: true,
            reason: true,
            person: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                middleName: true,
                lastName: true,
                isActive: true,
                roles: {
                  where: { isActive: true },
                  orderBy: { role: "asc" },
                  select: { role: true },
                },
              },
            },
          },
        },
        conflicts: {
          where: { status: "open" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.appLoginIdentity.count({ where }),
    prisma.appLoginIdentity.count({ where: { isActive: true } }),
    prisma.appLoginPersonLink.count({ where: { status: "approved" } }),
    prisma.appLoginPersonLink.count({ where: { status: "pending" } }),
    prisma.appIdentityConflict.count({ where: { status: "open" } }),
  ]);

  const emails = identities.map((identity) => identity.normalizedValue.trim().toLowerCase()).filter(Boolean);
  const authUsers = emails.length
    ? await prisma.user.findMany({
        where: { email: { in: emails } },
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
    identities,
    totalCount,
    activeIdentities,
    approvedLinks,
    pendingLinks,
    openConflictsCount,
    authByEmail,
    page: filters.page,
    pageSize: ADMIN_ACCESS_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(totalCount / ADMIN_ACCESS_PAGE_SIZE)),
  };
}
