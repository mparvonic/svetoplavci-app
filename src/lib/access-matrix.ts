export const GUIDE_ACCESS_ROLES = new Set([
  "ucitel",
  "zamestnanec",
  "pruvodce",
  "garant",
]);

export const CHILD_ACCESS_ROLES = new Set(["rodic", "zak"]);
export const M01_ACCESS_ROLES = new Set([
  "admin",
  "rodic",
  "zak",
  "ucitel",
  "zamestnanec",
  "pruvodce",
  "garant",
]);
// Keep this list local to avoid importing Prisma/Node-only modules into middleware (Edge runtime).
export const AUTHENTICATED_APP_ROLES = new Set([
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

export function getRequiredRolesForPath(pathname: string): Set<string> | null {
  for (const rule of ROUTE_ROLE_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.roles;
    }
  }
  return null;
}

export function hasAnyRole(roles: string[], allowed: Set<string>): boolean {
  return roles.some((role) => allowed.has(role.toLowerCase()));
}
