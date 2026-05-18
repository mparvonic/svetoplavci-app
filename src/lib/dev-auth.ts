import { cookies } from "next/headers";

import { prisma } from "@/src/lib/prisma";
import { selectPrimaryRole, type AppRole } from "@/src/lib/user-directory";
import { getConfiguredAppHost, isBypassAllowedForHost, resolveBypassHost } from "@/src/lib/environment-access";

export const DEV_AUTH_COOKIE_NAME = "svp_dev_user_id";

export type DevAuthUserOption = {
  selectionId: string;
  personId: string;
  displayName: string;
  email: string;
  role: AppRole;
  roles: AppRole[];
  mode?: "role" | "person";
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
  spravce_lodicek: "správce lodiček",
  spravce_flotily: "správce flotily",
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
  "spravce_flotily",
  "spravce_lodicek",
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
    selectionId: "local-dev-admin",
    personId: "local-dev-admin",
    displayName: "Lokální admin",
    email: "local-admin@svetoplavci.local",
    role: "admin",
    roles: ["admin", "tester", "pruvodce", "spravce_lodicek", "spravce_flotily", "rodic", "zak"],
    mode: "person",
  },
  {
    selectionId: "local-dev-pruvodce",
    personId: "local-dev-pruvodce",
    displayName: "Lokální průvodce",
    email: "local-pruvodce@svetoplavci.local",
    role: "pruvodce",
    roles: ["pruvodce"],
    mode: "role",
  },
  {
    selectionId: "local-dev-rodic",
    personId: "local-dev-rodic",
    displayName: "Lokální rodič",
    email: "local-rodic@svetoplavci.local",
    role: "rodic",
    roles: ["rodic"],
    mode: "role",
  },
  {
    selectionId: "local-dev-zak",
    personId: "local-dev-zak",
    displayName: "Lokální žák",
    email: "local-zak@svetoplavci.local",
    role: "zak",
    roles: ["zak"],
    mode: "role",
  },
  {
    selectionId: "static-garant-cmnix1k9g003d01qeddlfz5eq",
    personId: "cmnix1k9g003d01qeddlfz5eq",
    displayName: "Kateřina Parvonič (test)",
    email: "katerina.parvonic@svetoplavci.cz",
    role: "garant",
    roles: ["garant", "spravce_lodicek", "pruvodce", "rodic"],
    mode: "person",
  },
  {
    selectionId: "static-garant-cmnix8eu500ou01qeff51rxnv",
    personId: "cmnix8eu500ou01qeff51rxnv",
    displayName: "Irma Wichtová (test)",
    email: "irma.wichtova@svetoplavci.cz",
    role: "garant",
    roles: ["garant", "spravce_lodicek", "pruvodce", "rodic"],
    mode: "person",
  },
  {
    selectionId: "static-pruvodce-cmnixcwy801lc01qez4ac1l25",
    personId: "cmnixcwy801lc01qez4ac1l25",
    displayName: "Jiří Kotaška (test rodič/průvodce)",
    email: "kotasky@email.cz",
    role: "pruvodce",
    roles: ["pruvodce", "rodic"],
    mode: "person",
  },
];

const ROLE_ONLY_DEV_USERS: DevAuthUserOption[] = ROLE_SORT_ORDER.map((role) => ({
  selectionId: `local-role-${role}`,
  personId: `local-role-${role}`,
  displayName: `Role: ${getDevAuthRoleLabel(role)}`,
  email: `local-${role.replaceAll("_", "-")}@svetoplavci.local`,
  role,
  roles: [role],
  mode: "role",
}));

const REPRESENTATIVE_STUDENT_LIMIT = Number.parseInt(process.env.DEV_AUTH_STUDENT_LIMIT ?? "24", 10);
const DEV_AUTH_USERS_CACHE_MS = Number.parseInt(process.env.DEV_AUTH_USERS_CACHE_MS ?? "600000", 10);
const DEV_AUTH_USERS_FALLBACK_CACHE_MS = Number.parseInt(process.env.DEV_AUTH_USERS_FALLBACK_CACHE_MS ?? "30000", 10);

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
let devAuthUsersInFlight: Promise<DevAuthUserOption[]> | null = null;

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
  const source = (process.env.DEV_AUTH_USERS_SOURCE ?? "representative").trim().toLowerCase();
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
  const modeDiff = (a.mode === "role" ? 0 : 1) - (b.mode === "role" ? 0 : 1);
  if (modeDiff !== 0) return modeDiff;
  const aRoleIndex = ROLE_SORT_ORDER.indexOf(a.role);
  const bRoleIndex = ROLE_SORT_ORDER.indexOf(b.role);
  const roleDiff = (aRoleIndex >= 0 ? aRoleIndex : 999) - (bRoleIndex >= 0 ? bRoleIndex : 999);
  if (roleDiff !== 0) return roleDiff;
  return a.displayName.localeCompare(b.displayName, "cs");
}

function parseDirectSelection(selectionId: string): {
  personId: string | null;
  role: AppRole | null;
  mode: "role" | "person";
} | null {
  for (const role of ROLE_SORT_ORDER) {
    if (selectionId === `local-role-${role}`) {
      return { personId: `local-role-${role}`, role, mode: "role" };
    }
    const rolePrefix = `role-${role}-`;
    if (selectionId.startsWith(rolePrefix)) {
      return { personId: selectionId.slice(rolePrefix.length), role, mode: "role" };
    }
    const personRolePrefix = `person-${role}-`;
    if (selectionId.startsWith(personRolePrefix)) {
      return { personId: selectionId.slice(personRolePrefix.length), role, mode: "person" };
    }
  }

  if (selectionId.startsWith("person-")) {
    return { personId: selectionId.slice("person-".length), role: null, mode: "person" };
  }

  return null;
}

async function getDirectDevAuthUser(selectionId: string): Promise<DevAuthUserOption | null> {
  const parsed = parseDirectSelection(selectionId);
  if (!parsed) return null;

  if (parsed.personId?.startsWith("local-role-") && parsed.role) {
    return ROLE_ONLY_DEV_USERS.find((user) => user.role === parsed.role) ?? null;
  }

  if (!parsed.personId) return null;

  const person = await prisma.appPerson.findFirst({
    where: {
      id: parsed.personId,
      isActive: true,
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
  });
  if (!person) return null;

  const roles = parsed.role
    ? [parsed.role]
    : uniqueRoles(person.roles.map((item) => item.role));
  if (roles.length === 0) return null;

  const emailsByPersonId = await getApprovedEmailsByPersonId([person.id]);
  return {
    selectionId,
    personId: person.id,
    displayName: parsed.mode === "role" && parsed.role
      ? `Role: ${getDevAuthRoleLabel(parsed.role)} - ${person.displayName}`
      : person.displayName,
    email: emailsByPersonId.get(person.id) ?? `local-${(parsed.role ?? roles[0]).replaceAll("_", "-")}@svetoplavci.local`,
    role: parsed.role ?? selectPrimaryRole(roles),
    roles,
    mode: parsed.mode,
  };
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
      selectionId: `person-${link.personId}`,
      personId: link.personId,
      displayName: link.person.displayName,
      email,
      roles,
      role: selectPrimaryRole(roles),
      mode: "person",
    };

    const existing = usersByPersonId.get(link.personId);
    if (!existing || compareDevUsers(option, existing) < 0) {
      usersByPersonId.set(link.personId, option);
    }
  }

  return [...usersByPersonId.values()].sort(compareDevUsers);
}

async function getRoleScopedRepresentativeUsers(): Promise<DevAuthUserOption[]> {
  const people = await prisma.appPerson.findMany({
    where: {
      isActive: true,
      roles: {
        some: {
          role: { in: ROLE_SORT_ORDER },
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      displayName: true,
      roles: {
        where: {
          role: { in: ROLE_SORT_ORDER },
          isActive: true,
        },
        select: { role: true },
      },
    },
    orderBy: {
      displayName: "asc",
    },
  });

  const representativeByRole = new Map<AppRole, { id: string; displayName: string }>();
  for (const role of ROLE_SORT_ORDER) {
    const person = people.find((candidate) => candidate.roles.some((item) => item.role === role));
    if (person) {
      representativeByRole.set(role, {
        id: person.id,
        displayName: person.displayName,
      });
    }
  }

  const emailsByPersonId = await getApprovedEmailsByPersonId([...representativeByRole.values()].map((person) => person.id));

  return ROLE_SORT_ORDER.map((role) => {
    const representative = representativeByRole.get(role);
    if (!representative) return ROLE_ONLY_DEV_USERS.find((user) => user.role === role)!;

    return {
      selectionId: `role-${role}-${representative.id}`,
      personId: representative.id,
      displayName: `Role: ${getDevAuthRoleLabel(role)} - ${representative.displayName}`,
      email: emailsByPersonId.get(representative.id) ?? `local-${role.replaceAll("_", "-")}@svetoplavci.local`,
      role,
      roles: [role],
      mode: "role" as const,
    };
  });
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
        selectionId: `person-${person.id}`,
        personId: person.id,
        displayName: `Lokální multi-role - ${person.displayName}`,
        email: emailsByPersonId.get(person.id) ?? `local-${person.id}@svetoplavci.local`,
        role: selectPrimaryRole(roles),
        roles,
        mode: "person",
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
      if (seen.has(user.selectionId)) return;
      seen.add(user.selectionId);
      result.push(user);
    };

    (await getRoleScopedRepresentativeUsers()).forEach((user) => pushUnique(user));
    pushUnique(FALLBACK_DEV_USERS[0]);
    [...multiRoleByPersonId.values()].sort(compareDevUsers).forEach((user) => pushUnique(user));
    pushUnique(
      guide
        ? {
            selectionId: `person-pruvodce-${guide.id}`,
            personId: guide.id,
            displayName: `Lokální průvodce - ${guide.displayName}`,
            email: emailsByPersonId.get(guide.id) ?? "local-pruvodce@svetoplavci.local",
            role: "pruvodce",
            roles: ["pruvodce"],
            mode: "role",
          }
        : FALLBACK_DEV_USERS.find((user) => user.role === "pruvodce"),
    );
    pushUnique(
      parentLink
        ? {
            selectionId: `person-rodic-${parentLink.parentPersonId}`,
            personId: parentLink.parentPersonId,
            displayName: `Lokální rodič - ${parentLink.parentPerson.displayName} (${parentLink.childPerson.displayName})`,
            email: emailsByPersonId.get(parentLink.parentPersonId) ?? "local-rodic@svetoplavci.local",
            role: "rodic",
            roles: ["rodic"],
            mode: "role",
          }
        : FALLBACK_DEV_USERS.find((user) => user.role === "rodic"),
    );
    const visibleStudents = Number.isInteger(REPRESENTATIVE_STUDENT_LIMIT) && REPRESENTATIVE_STUDENT_LIMIT > 0
      ? students.slice(0, REPRESENTATIVE_STUDENT_LIMIT)
      : students;
    if (visibleStudents.length > 0) {
      visibleStudents.forEach((student) =>
        pushUnique({
          selectionId: `person-zak-${student.id}`,
          personId: student.id,
          displayName: `Lokální žák - ${student.displayName}`,
          email: emailsByPersonId.get(student.id) ?? "local-zak@svetoplavci.local",
          role: "zak",
          roles: ["zak"],
          mode: "role",
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
  if (devAuthUsersInFlight) {
    return devAuthUsersInFlight;
  }

  devAuthUsersInFlight = (async () => {
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
      users = [...ROLE_ONLY_DEV_USERS, ...FALLBACK_DEV_USERS].sort(compareDevUsers);
    }
    const resolved = users.length > 0 ? users : FALLBACK_DEV_USERS;
    const fallbackOnly =
      resolved.length === FALLBACK_DEV_USERS.length &&
      resolved.every((user, index) => user.personId === FALLBACK_DEV_USERS[index]?.personId);
    devAuthUsersCache = {
      expiresAt: Date.now() + (fallbackOnly ? DEV_AUTH_USERS_FALLBACK_CACHE_MS : DEV_AUTH_USERS_CACHE_MS),
      users: resolved,
    };
    return resolved;
  })();

  try {
    return await devAuthUsersInFlight;
  } finally {
    devAuthUsersInFlight = null;
  }
}

export async function getSelectedDevAuthUser(): Promise<DevAuthUserOption | null> {
  if (!isDevAuthBypassEnabled()) return null;

  const cookieStore = await cookies();
  const selectedPersonId = cookieStore.get(DEV_AUTH_COOKIE_NAME)?.value ?? null;
  if (selectedPersonId) {
    const directUser = await getDirectDevAuthUser(selectedPersonId);
    if (directUser) return directUser;
  }
  const users = await getDevAuthUsers();
  if (users.length === 0) return null;

  return (
    users.find((user) => user.selectionId === selectedPersonId) ??
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

export async function setDevAuthSelection(selectionId: string): Promise<boolean> {
  if (!isDevAuthBypassEnabled()) return false;

  const users = await getDevAuthUsers();
  const selected = users.find((user) => user.selectionId === selectionId || user.personId === selectionId);
  if (!selected) return false;

  const cookieStore = await cookies();
  cookieStore.set(DEV_AUTH_COOKIE_NAME, selected.selectionId, {
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
