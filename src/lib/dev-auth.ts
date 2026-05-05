import { cookies } from "next/headers";

import { prisma } from "@/src/lib/prisma";
import { selectPrimaryRole, type AppRole } from "@/src/lib/user-directory";
import { getConfiguredAppHost, isBypassAllowedForHost, resolveBypassHost } from "@/src/lib/environment-access";

export const DEV_AUTH_COOKIE_NAME = "svp_dev_user_id";

export type DevAuthUserOption = {
  personId: string;
  displayName: string;
  email: string;
  role: AppRole;
  roles: AppRole[];
};

type ApprovedEmailLink = {
  personId: string;
  identity: {
    normalizedValue: string | null;
    identityValue: string;
  };
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
  {
    personId: "cmnix1k9g003d01qeddlfz5eq",
    displayName: "Kateřina Parvonič (test)",
    email: "katerina.parvonic@svetoplavci.cz",
    role: "garant",
    roles: ["garant", "pruvodce", "rodic"],
  },
  {
    personId: "cmnix8eu500ou01qeff51rxnv",
    displayName: "Irma Wichtová (test)",
    email: "irma.wichtova@svetoplavci.cz",
    role: "garant",
    roles: ["garant", "pruvodce", "rodic"],
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
  const host = getConfiguredAppHost();
  return host === "app.svetoplavci.cz";
}

export function isDevAuthBypassEnabled(): boolean {
  const host = resolveBypassHost(getConfiguredAppHost());
  if (!isBypassAllowedForHost(host)) return false;
  if (process.env.AUTH_BYPASS === "1") return true;
  return process.env.NODE_ENV === "development" && process.env.AUTH_BYPASS !== "0";
}

function getDevAuthUsersSource(): "db" | "representative" | "static" {
  const source = (process.env.DEV_AUTH_USERS_SOURCE ?? "static").trim().toLowerCase();
  if (source === "db") return "db";
  if (source === "representative") return "representative";
  return "static";
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

  let links: ApprovedEmailLink[];
  try {
    links = await prisma.appLoginPersonLink.findMany({
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
  } catch (error) {
    console.warn(
      "[dev-auth] approved email lookup failed; using synthetic local emails:",
      error instanceof Error ? error.message : String(error),
    );
    return new Map();
  }

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
    const [guide, parentLink, students, multiRolePeople] = await Promise.all([
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
      prisma.appPerson.findMany({
        where: {
          isActive: true,
          roles: {
            some: {
              role: "rodic",
              isActive: true,
            },
          },
          AND: [
            {
              roles: {
                some: {
                  role: { in: ["garant", "pruvodce", "ucitel", "zamestnanec"] },
                  isActive: true,
                },
              },
            },
          ],
        },
        select: {
          id: true,
          displayName: true,
          roles: {
            where: {
              isActive: true,
            },
            select: { role: true },
          },
        },
        orderBy: {
          displayName: "asc",
        },
      }),
    ]);
    const emailsByPersonId = await getApprovedEmailsByPersonId([
      guide?.id ?? "",
      parentLink?.parentPersonId ?? "",
      ...students.map((student) => student.id),
      ...multiRolePeople.map((person) => person.id),
    ]);

    const multiRoleByPersonId = new Map<string, DevAuthUserOption>();
    for (const person of multiRolePeople) {
      const roles = uniqueRoles(person.roles.map((item) => item.role));
      if (roles.length === 0) continue;

      const option: DevAuthUserOption = {
        personId: person.id,
        displayName: `Lokální multi-role - ${person.displayName}`,
        email: emailsByPersonId.get(person.id) ?? `local-${person.id}@svetoplavci.local`,
        role: selectPrimaryRole(roles),
        roles,
      };

      const existing = multiRoleByPersonId.get(option.personId);
      if (!existing || compareDevUsers(option, existing) < 0) {
        multiRoleByPersonId.set(option.personId, option);
      }
    }

    const result: DevAuthUserOption[] = [];
    const seen = new Set<string>();
    const pushUnique = (user: DevAuthUserOption | undefined) => {
      if (!user) return;
      if (seen.has(user.personId)) return;
      seen.add(user.personId);
      result.push(user);
    };

    pushUnique(FALLBACK_DEV_USERS[0]);
    [...multiRoleByPersonId.values()].sort(compareDevUsers).forEach((user) => pushUnique(user));
    pushUnique(
      guide
        ? {
            personId: guide.id,
            displayName: `Lokální průvodce - ${guide.displayName}`,
            email: emailsByPersonId.get(guide.id) ?? "local-pruvodce@svetoplavci.local",
            role: "pruvodce",
            roles: ["pruvodce"],
          }
        : FALLBACK_DEV_USERS.find((user) => user.role === "pruvodce"),
    );
    pushUnique(
      parentLink
        ? {
            personId: parentLink.parentPersonId,
            displayName: `Lokální rodič - ${parentLink.parentPerson.displayName} (${parentLink.childPerson.displayName})`,
            email: emailsByPersonId.get(parentLink.parentPersonId) ?? "local-rodic@svetoplavci.local",
            role: "rodic",
            roles: ["rodic"],
          }
        : FALLBACK_DEV_USERS.find((user) => user.role === "rodic"),
    );
    if (students.length > 0) {
      students.forEach((student) =>
        pushUnique({
          personId: student.id,
          displayName: `Lokální žák - ${student.displayName}`,
          email: emailsByPersonId.get(student.id) ?? "local-zak@svetoplavci.local",
          role: "zak",
          roles: ["zak"],
        }),
      );
    } else {
      pushUnique(FALLBACK_DEV_USERS.find((user) => user.role === "zak"));
    }

    return result;
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

  let users: DevAuthUserOption[] = [];
  const source = getDevAuthUsersSource();
  if (source === "db") {
    try {
      users = await getDbDevAuthUsers();
    } catch (error) {
      console.warn(
        "[dev-auth] DB-backed local users failed; falling back to static users:",
        error instanceof Error ? error.message : String(error),
      );
      users = FALLBACK_DEV_USERS;
    }
  } else if (source === "representative") {
    users = await getRepresentativeDevAuthUsers();
  } else {
    users = FALLBACK_DEV_USERS;
  }
  const resolved = users.length > 0 ? users : FALLBACK_DEV_USERS;
  const fallbackOnly =
    resolved.length === FALLBACK_DEV_USERS.length &&
    resolved.every((user, index) => user.personId === FALLBACK_DEV_USERS[index]?.personId);
  devAuthUsersCache = {
    expiresAt: Date.now() + (fallbackOnly ? 3_000 : 30_000),
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
