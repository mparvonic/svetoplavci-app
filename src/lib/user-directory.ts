import { prisma } from "@/src/lib/prisma";

export const APP_ROLES = [
  "admin",
  "zamestnanec",
  "ucitel",
  "pruvodce",
  "garant",
  "spravce_lodicek",
  "spravce_flotily",
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

function canIgnoreDirectoryLookupError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : String(error);
  const isDevRuntime = process.env.NODE_ENV === "development" || process.env.AUTH_BYPASS === "1";

  return (
    isDevRuntime
    && (code === "P2021"
      || code === "P2022"
      || message.includes("app_login_identity")
      || message.includes("appLoginIdentity"))
  );
}

export async function getApprovedLoginProfileByEmail(email: string): Promise<LoginProfile | null> {
  const normalized = normalizeEmail(email);
  let identity;
  try {
    identity = await prisma.appLoginIdentity.findFirst({
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
  } catch (error) {
    if (!canIgnoreDirectoryLookupError(error)) throw error;
    console.error("[user-directory] login directory lookup unavailable in dev; continuing without profile", error);
    return null;
  }

  if (!identity) return null;
  if (identity.personLinks.length === 0) return null;
  if (identity.personLinks.length > 1) {
    console.warn("[user-directory] login identity has multiple approved person links; denying ambiguous login", {
      identityId: identity.id,
      email: normalized,
      personIds: identity.personLinks.map((link) => link.personId),
    });
    return null;
  }

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
