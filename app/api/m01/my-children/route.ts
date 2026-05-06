import { NextResponse } from "next/server";
import { getApiSessionContext } from "@/src/lib/api/session";
import { filterChildrenByGarant, getPortalParentAndChildrenForActor } from "@/src/lib/portal-db";

const PROTO_ROLE_TO_SESSION_ROLES: Record<string, Set<string>> = {
  rodic: new Set(["rodic"]),
  zak: new Set(["zak"]),
  garant: new Set(["garant", "pruvodce", "ucitel", "zamestnanec", "admin", "proto"]),
  spravce: new Set(["admin", "zamestnanec", "proto"]),
};

function getEffectiveRoles(sessionRoles: string[], requestedRole: string): string[] | null {
  const normalized = requestedRole.trim().toLowerCase();
  if (!normalized) return sessionRoles;
  const allowedRoles = PROTO_ROLE_TO_SESSION_ROLES[normalized];
  if (!allowedRoles) return sessionRoles;
  const filtered = sessionRoles.filter((role) => allowedRoles.has(role));
  return filtered.length > 0 ? filtered : null;
}

export async function GET(req: Request) {
  const context = await getApiSessionContext(req);
  if (!context) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const role = (url.searchParams.get("role") ?? "").trim().toLowerCase();
    const scope = (url.searchParams.get("scope") ?? "").trim().toLowerCase();
    const garantId = (url.searchParams.get("garantId") ?? "").trim();
    const effectiveRoles = getEffectiveRoles(context.roles, role);
    if (!effectiveRoles) {
      return NextResponse.json({ error: "Přístup zamítnut pro zvolený pohled." }, { status: 403 });
    }

    const portalContext = await getPortalParentAndChildrenForActor({
      email: context.email,
      personIds: context.personIds,
      roles: effectiveRoles,
    });
    if (!portalContext) {
      if (role === "rodic") {
        const fallback = await getPortalParentAndChildrenForActor({
          email: context.email,
          personIds: context.personIds,
          roles: context.roles,
        });
        if (fallback) {
          return NextResponse.json({
            parent: fallback.parent,
            userEmail: context.email,
            children: [],
          });
        }
      }
      return NextResponse.json({ error: "Přístup zamítnut." }, { status: 403 });
    }

    return NextResponse.json({
      parent: portalContext.parent,
      userEmail: context.email,
      children:
        (role === "garant" || role === "spravce") && scope === "moje" && garantId
          ? await filterChildrenByGarant(portalContext.children, garantId)
          : portalContext.children,
      parentChildren: portalContext.parentChildren,
    });
  } catch (error) {
    console.error("[api/m01/my-children]", error);
    return NextResponse.json({ error: "Nepodařilo se načíst děti." }, { status: 500 });
  }
}
