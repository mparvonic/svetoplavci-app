import { NextResponse } from "next/server";
import { getApiSessionContext } from "@/src/lib/api/session";
import { getPortalParentAndChildrenForActor } from "@/src/lib/portal-db";

export async function GET(req: Request) {
  const context = await getApiSessionContext(req);
  if (!context) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  try {
    const portalContext = await getPortalParentAndChildrenForActor({
      email: context.email,
      personIds: context.personIds,
      roles: context.roles,
    });
    if (!portalContext) {
      return NextResponse.json({ error: "Přístup zamítnut." }, { status: 403 });
    }

    return NextResponse.json({
      parent: portalContext.parent,
      userEmail: context.email,
      children: portalContext.children,
    });
  } catch (error) {
    console.error("[api/m01/my-children]", error);
    return NextResponse.json({ error: "Nepodařilo se načíst děti." }, { status: 500 });
  }
}
