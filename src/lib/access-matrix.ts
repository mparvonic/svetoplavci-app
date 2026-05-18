export const GUIDE_ACCESS_ROLES = new Set([
  "tester",
  "ucitel",
  "zamestnanec",
  "pruvodce",
  "garant",
  "spravce_lodicek",
  "spravce_flotily",
]);

export const CHILD_ACCESS_ROLES = new Set(["tester", "rodic", "zak"]);
export const M01_ACCESS_ROLES = new Set([
  "rodic",
  "zak",
  "garant",
  "spravce_lodicek",
  "spravce_flotily",
  "pruvodce",
  "ucitel",
  "zamestnanec",
  "admin",
  "proto",
]);
const M01_ACCESS_ROLES_WITH_TESTER = new Set([...M01_ACCESS_ROLES, "tester"]);
// Keep this list local to avoid importing Prisma/Node-only modules into middleware (Edge runtime).
export const AUTHENTICATED_APP_ROLES = new Set([
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
]);

type RouteRoleRule = {
  prefix: string;
  roles: Set<string>;
};

const ROUTE_ROLE_RULES: RouteRoleRule[] = [
  { prefix: "/admin", roles: new Set(["admin"]) },
  { prefix: "/api/admin", roles: new Set(["admin"]) },
  { prefix: "/api/internal", roles: new Set(["admin"]) },
  { prefix: "/api/ostrovy/guide", roles: GUIDE_ACCESS_ROLES },
  { prefix: "/api/ostrovy/my-children", roles: CHILD_ACCESS_ROLES },
  { prefix: "/api/reports", roles: CHILD_ACCESS_ROLES },
  { prefix: "/api/m01", roles: M01_ACCESS_ROLES },
  { prefix: "/api/coda", roles: CHILD_ACCESS_ROLES },
  { prefix: "/api/support", roles: AUTHENTICATED_APP_ROLES },
];

export function getRequiredRolesForPath(
  pathname: string,
  options?: { allowTesterForM01?: boolean },
): Set<string> | null {
  for (const rule of ROUTE_ROLE_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      if (rule.prefix === "/api/m01") {
        return options?.allowTesterForM01 ? M01_ACCESS_ROLES_WITH_TESTER : M01_ACCESS_ROLES;
      }
      return rule.roles;
    }
  }
  return null;
}

export function hasAnyRole(roles: string[], allowed: Set<string>): boolean {
  return roles.some((role) => allowed.has(role.toLowerCase()));
}
