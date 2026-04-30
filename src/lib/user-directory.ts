import { prisma } from "@/src/lib/prisma";

export const APP_ROLES = [
  "admin",
  "zamestnanec",
  "ucitel",
  "pruvodce",
  "garant",
  "patron",
  "druzinar",
  "editor_hodnoceni",
  "schvalovatel_hodnoceni",
  "rodic",
  "zak",
  "tester",
  "proto",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export interface LoginProfile {
  identityId: string;
  email: string;
  personIds: string[];
  roles: AppRole[];
  jmeno?: string;
  primaryRole: AppRole;
}

const PRIMARY_ROLE_ORDER: AppRole[] = [
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

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function uniqueRoles(roles: string[]): AppRole[] {
  const set = new Set<AppRole>();
  for (const role of roles) {
    if ((APP_ROLES as readonly string[]).includes(role)) {
      set.add(role as AppRole);
    }
  }
  return [...set];
}

export function selectPrimaryRole(roles: AppRole[]): AppRole {
  for (const role of PRIMARY_ROLE_ORDER) {
    if (roles.includes(role)) return role;
  }
  return "zak";
}

export async function getApprovedLoginProfileByEmail(email: string): Promise<LoginProfile | null> {
  const normalized = normalizeEmail(email);
  const identity = await prisma.appLoginIdentity.findFirst({
    where: {
      identityType: "email",
      normalizedValue: normalized,
      isActive: true,
    },
    include: {
      personLinks: {
        where: {
          status: "approved",
          person: {
            isActive: true,
          },
        },
        include: {
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
      },
    },
  });

  if (!identity) return null;
  if (identity.personLinks.length === 0) return null;

  const personIds = identity.personLinks.map((link) => link.personId);
  const allRoles = uniqueRoles(
    identity.personLinks.flatMap((link) => link.person.roles.map((r) => r.role))
  );
  if (allRoles.length === 0) return null;

  const primaryPerson = identity.personLinks[0]?.person;
  return {
    identityId: identity.id,
    email: normalized,
    personIds,
    roles: allRoles,
    jmeno: primaryPerson?.displayName ?? undefined,
    primaryRole: selectPrimaryRole(allRoles),
  };
}

export function hasAnyRole(roles: string[] | undefined, allowed: AppRole[]): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => allowed.includes(r as AppRole));
}
