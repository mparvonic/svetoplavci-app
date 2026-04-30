import type { Session } from "next-auth";

import { auth } from "@/src/lib/auth";
import { getSelectedDevAuthUser } from "@/src/lib/dev-auth";
import { prisma } from "@/src/lib/prisma";
import { getApprovedLoginProfileByEmail } from "@/src/lib/user-directory";

export interface ApiSessionContext {
  session: Session;
  email: string;
  roles: string[];
  personIds: string[];
  actorPersonId: string | null;
}

export const GUIDE_ROLE_CODES = new Set(["admin", "tester", "ucitel", "zamestnanec", "pruvodce", "garant"]);
export const CHILD_VIEW_ROLE_CODES = new Set(["admin", "tester", "rodic", "zak"]);
export const LOCAL_DEV_ROLES = ["admin", "tester", "pruvodce", "rodic", "zak"];

export function isLocalDevAuthBypass(): boolean {
  return process.env.NODE_ENV === "development";
}

export function collectSessionRoles(session: Session | null): string[] {
  const roles = new Set<string>();
  if (!session?.user) return [];
  if (Array.isArray(session.user.roles)) {
    for (const role of session.user.roles) roles.add(String(role).toLowerCase());
  }
  if (session.user.role) roles.add(String(session.user.role).toLowerCase());
  return [...roles];
}

export function hasAnySessionRole(roles: string[], allowed: Set<string>): boolean {
  return roles.some((role) => allowed.has(role.toLowerCase()));
}

function isLocalDevEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@svetoplavci.local");
}

async function resolveLocalDevPersonIds(email: string, roles: string[]): Promise<string[]> {
  if (!isLocalDevAuthBypass() || !isLocalDevEmail(email)) return [];

  const selectedDevUser = await getSelectedDevAuthUser();
  if (selectedDevUser?.email === email && !selectedDevUser.personId.startsWith("local-dev-")) {
    return [selectedDevUser.personId];
  }

  const normalizedRoles = roles.map((role) => role.toLowerCase());
  if (normalizedRoles.some((role) => role === "admin" || role === "tester")) return [];

  if (normalizedRoles.includes("zak")) {
    const student = await prisma.appPerson.findFirst({
      where: {
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
      },
      select: { id: true },
      orderBy: { displayName: "asc" },
    });
    return student ? [student.id] : [];
  }

  if (normalizedRoles.includes("rodic")) {
    const parent = await prisma.appPersonRelation.findFirst({
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
      select: { parentPersonId: true },
      orderBy: { createdAt: "asc" },
    });
    return parent ? [parent.parentPersonId] : [];
  }

  if (normalizedRoles.includes("pruvodce")) {
    const guide = await prisma.appPerson.findFirst({
      where: {
        isActive: true,
        roles: { some: { role: "pruvodce", isActive: true } },
      },
      select: { id: true },
      orderBy: { displayName: "asc" },
    });
    return guide ? [guide.id] : [];
  }

  return [];
}

export async function getApiSessionContext(): Promise<ApiSessionContext | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!session || !email) {
    if (!isLocalDevAuthBypass()) return null;
    return {
      session: {
        user: {
          email: "local-dev@svetoplavci.local",
          role: "admin",
          roles: LOCAL_DEV_ROLES,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as Session,
      email: "local-dev@svetoplavci.local",
      roles: LOCAL_DEV_ROLES,
      personIds: [],
      actorPersonId: null,
    };
  }

  let profile = null;
  try {
    profile = await getApprovedLoginProfileByEmail(email);
  } catch (error) {
    if (!isLocalDevAuthBypass()) throw error;
    console.error("[api/session] failed to load login profile in local dev; continuing without actor person", error);
  }
  const roles = collectSessionRoles(session);
  let personIds = profile?.personIds ?? [];
  if (personIds.length === 0) {
    try {
      personIds = await resolveLocalDevPersonIds(email, roles);
    } catch (error) {
      if (!isLocalDevAuthBypass()) throw error;
      console.warn(
        "[api/session] local dev person fallback failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return {
    session,
    email,
    roles,
    personIds,
    actorPersonId: personIds[0] ?? null,
  };
}
