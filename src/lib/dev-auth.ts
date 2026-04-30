import { cookies } from "next/headers";

import { prisma } from "@/src/lib/prisma";
import { selectPrimaryRole, type AppRole } from "@/src/lib/user-directory";

export const DEV_AUTH_COOKIE_NAME = "svp_dev_user_id";

export type DevAuthUserOption = {
  personId: string;
  displayName: string;
  email: string;
  role: AppRole;
  roles: AppRole[];
};

const ROLE_LABELS: Partial<Record<AppRole, string>> = {
  admin: "admin",
  tester: "tester",
  proto: "proto",
  garant: "garant",
  pruvodce: "průvodce",
  zamestnanec: "zaměstnanec",
  ucitel: "učitel",
  rodic: "rodič",
  zak: "žák",
};

const ROLE_SORT_ORDER: AppRole[] = [
  "admin",
  "tester",
  "proto",
  "garant",
  "pruvodce",
  "zamestnanec",
  "ucitel",
  "editor_hodnoceni",
  "schvalovatel_hodnoceni",
  "druzinar",
  "patron",
  "rodic",
  "zak",
];

const FALLBACK_DEV_USERS: DevAuthUserOption[] = [
  {
    personId: "local-dev-admin",
    displayName: "Lokální admin",
    email: "local-admin@svetoplavci.local",
    role: "admin",
    roles: ["admin", "tester", "pruvodce", "rodic", "zak"],
  },
  {
    personId: "local-dev-pruvodce",
    displayName: "Lokální průvodce",
    email: "local-pruvodce@svetoplavci.local",
    role: "pruvodce",
    roles: ["pruvodce"],
  },
  {
    personId: "local-dev-rodic",
    displayName: "Lokální rodič",
    email: "local-rodic@svetoplavci.local",
    role: "rodic",
    roles: ["rodic"],
  },
  {
    personId: "local-dev-zak",
    displayName: "Lokální žák",
    email: "local-zak@svetoplavci.local",
    role: "zak",
    roles: ["zak"],
  },
];

const LEGACY_DEV_ROLE_BY_PERSON_ID = new Map<string, AppRole>([
  ["local-dev-admin", "admin"],
  ["local-dev-pruvodce", "pruvodce"],
  ["local-dev-rodic", "rodic"],
  ["local-dev-zak", "zak"],
]);

let devAuthUsersCache: {
  expiresAt: number;
  users: DevAuthUserOption[];
} | null = null;

export function isProductionApplicationUrl(): boolean {
  const configuredUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "";
  if (!configuredUrl) return false;

  try {
    const hostname = new URL(configuredUrl).hostname.toLowerCase();
    return hostname === "app.svetoplavci.cz";
  } catch {
    return configuredUrl.toLowerCase().includes("app.svetoplavci.cz");
  }
}

export function isDevAuthBypassEnabled(): boolean {
  if (isProductionApplicationUrl()) return false;
  if (process.env.AUTH_BYPASS === "1") return true;
  return process.env.NODE_ENV === "development" && process.env.AUTH_BYPASS !== "0";
}

function shouldLoadDevUsersFromDb(): boolean {
  return process.env.DEV_AUTH_USERS_SOURCE === "db";
}

export function getDevAuthRoleLabel(role: AppRole): string {
  return ROLE_LABELS[role] ?? role;
}

function uniqueRoles(roles: string[]): AppRole[] {
  const result: AppRole[] = [];
  for (const role of roles) {
    if (result.includes(role as AppRole)) continue;
    result.push(role as AppRole);
  }
  return result;
}

function compareDevUsers(a: DevAuthUserOption, b: DevAuthUserOption): number {
  const aRoleIndex = ROLE_SORT_ORDER.indexOf(a.role);
  const bRoleIndex = ROLE_SORT_ORDER.indexOf(b.role);
  const roleDiff = (aRoleIndex >= 0 ? aRoleIndex : 999) - (bRoleIndex >= 0 ? bRoleIndex : 999);
  if (roleDiff !== 0) return roleDiff;
  return a.displayName.localeCompare(b.displayName, "cs");
}

async function getApprovedEmailsByPersonId(personIds: string[]): Promise<Map<string, string>> {
  const uniquePersonIds = [...new Set(personIds.filter(Boolean))];
  if (uniquePersonIds.length === 0) return new Map();

  const links = await prisma.appLoginPersonLink.findMany({
    where: {
      personId: { in: uniquePersonIds },
      status: "approved",
      identity: {
        identityType: "email",
        isActive: true,
      },
    },
    include: {
      identity: true,
    },
    orderBy: {
      approvedAt: "desc",
    },
  });

  const emails = new Map<string, string>();
  for (const link of links) {
    if (emails.has(link.personId)) continue;
    const email = (link.identity.normalizedValue || link.identity.identityValue).trim().toLowerCase();
    if (email) emails.set(link.personId, email);
  }
  return emails;
}

async function getDbDevAuthUsers(): Promise<DevAuthUserOption[]> {
  const links = await prisma.appLoginPersonLink.findMany({
    where: {
      status: "approved",
      identity: {
        identityType: "email",
        isActive: true,
      },
      person: {
        isActive: true,
      },
    },
    include: {
      identity: true,
      person: {
        include: {
          roles: {
            where: {
              isActive: true,
            },
          },
        },
      },
    },
  });

  const usersByPersonId = new Map<string, DevAuthUserOption>();
  for (const link of links) {
    const roles = uniqueRoles(link.person.roles.map((item) => item.role));
    if (roles.length === 0) continue;

    const email = (link.identity.normalizedValue || link.identity.identityValue).trim().toLowerCase();
    if (!email) continue;

    const option: DevAuthUserOption = {
      personId: link.personId,
      displayName: link.person.displayName,
      email,
      roles,
      role: selectPrimaryRole(roles),
    };

    const existing = usersByPersonId.get(link.personId);
    if (!existing || compareDevUsers(option, existing) < 0) {
      usersByPersonId.set(link.personId, option);
    }
  }

  return [...usersByPersonId.values()].sort(compareDevUsers);
}

async function getRepresentativeDevAuthUsers(): Promise<DevAuthUserOption[]> {
  try {
    const [guide, parentLink, students] = await Promise.all([
      prisma.appPerson.findFirst({
        where: {
          isActive: true,
          roles: { some: { role: "pruvodce", isActive: true } },
        },
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" },
      }),
      prisma.appPersonRelation.findFirst({
        where: {
          relationType: "parent_of",
          isActive: true,
          parentPerson: {
            is: {
              isActive: true,
              roles: { some: { role: "rodic", isActive: true } },
            },
          },
          childPerson: {
            is: {
              isActive: true,
              roles: { some: { role: "zak", isActive: true } },
            },
          },
        },
        select: {
          parentPersonId: true,
          parentPerson: { select: { displayName: true } },
          childPerson: { select: { displayName: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.appPerson.findMany({
        where: {
          isActive: true,
          roles: { some: { role: "zak", isActive: true } },
        },
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" },
      }),
    ]);
    const emailsByPersonId = await getApprovedEmailsByPersonId([
      guide?.id ?? "",
      parentLink?.parentPersonId ?? "",
      ...students.map((student) => student.id),
    ]);

    return [
      FALLBACK_DEV_USERS[0],
      guide
        ? {
            personId: guide.id,
            displayName: `Lokální průvodce - ${guide.displayName}`,
            email: emailsByPersonId.get(guide.id) ?? "local-pruvodce@svetoplavci.local",
            role: "pruvodce",
            roles: ["pruvodce"],
          }
        : FALLBACK_DEV_USERS.find((user) => user.role === "pruvodce"),
      parentLink
        ? {
            personId: parentLink.parentPersonId,
            displayName: `Lokální rodič - ${parentLink.parentPerson.displayName} (${parentLink.childPerson.displayName})`,
            email: emailsByPersonId.get(parentLink.parentPersonId) ?? "local-rodic@svetoplavci.local",
            role: "rodic",
            roles: ["rodic"],
          }
        : FALLBACK_DEV_USERS.find((user) => user.role === "rodic"),
      ...(students.length > 0
        ? students.map((student) => ({
            personId: student.id,
            displayName: `Lokální žák - ${student.displayName}`,
            email: emailsByPersonId.get(student.id) ?? "local-zak@svetoplavci.local",
            role: "zak" as const,
            roles: ["zak" as const],
          }))
        : [FALLBACK_DEV_USERS.find((user) => user.role === "zak")]),
    ].filter((user): user is DevAuthUserOption => Boolean(user));
  } catch (error) {
    console.warn(
      "[dev-auth] DB-backed local users unavailable; using static fallbacks:",
      error instanceof Error ? error.message : String(error),
    );
    return FALLBACK_DEV_USERS;
  }
}

export async function getDevAuthUsers(): Promise<DevAuthUserOption[]> {
  if (!isDevAuthBypassEnabled()) return [];
  if (devAuthUsersCache && devAuthUsersCache.expiresAt > Date.now()) {
    return devAuthUsersCache.users;
  }

  const users = shouldLoadDevUsersFromDb()
    ? await getDbDevAuthUsers()
    : await getRepresentativeDevAuthUsers();
  const resolved = users.length > 0 ? users : FALLBACK_DEV_USERS;
  devAuthUsersCache = {
    expiresAt: Date.now() + 30_000,
    users: resolved,
  };
  return resolved;
}

export async function getSelectedDevAuthUser(): Promise<DevAuthUserOption | null> {
  if (!isDevAuthBypassEnabled()) return null;

  const cookieStore = await cookies();
  const selectedPersonId = cookieStore.get(DEV_AUTH_COOKIE_NAME)?.value ?? null;
  const users = await getDevAuthUsers();
  if (users.length === 0) return null;

  return (
    users.find((user) => user.personId === selectedPersonId) ??
    users.find((user) => selectedPersonId && user.role === LEGACY_DEV_ROLE_BY_PERSON_ID.get(selectedPersonId)) ??
    users.find((user) => user.roles.includes("admin")) ??
    users[0] ??
    null
  );
}

export async function getDevAuthSession() {
  const user = await getSelectedDevAuthUser();
  if (!user) return null;

  return {
    user: {
      name: user.displayName,
      email: user.email,
      image: null,
      role: user.role,
      roles: user.roles,
      jmeno: user.displayName,
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function setDevAuthSelection(personId: string): Promise<boolean> {
  if (!isDevAuthBypassEnabled()) return false;

  const users = await getDevAuthUsers();
  const selected = users.find((user) => user.personId === personId);
  if (!selected) return false;

  const cookieStore = await cookies();
  cookieStore.set(DEV_AUTH_COOKIE_NAME, selected.personId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return true;
}

export async function clearDevAuthSelection(): Promise<void> {
  if (!isDevAuthBypassEnabled()) return;
  const cookieStore = await cookies();
  cookieStore.delete(DEV_AUTH_COOKIE_NAME);
}
