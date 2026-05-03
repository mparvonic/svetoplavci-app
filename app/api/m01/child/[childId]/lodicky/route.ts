import { NextResponse } from "next/server";
import { getApiSessionContext } from "@/src/lib/api/session";
import { getPortalChildLodickyForActor } from "@/src/lib/portal-db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ childId: string }> }
) {
  const context = await getApiSessionContext(req);
  if (!context) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  const { childId } = await params;
  if (!childId) {
    return NextResponse.json({ error: "Chybí childId" }, { status: 400 });
  }

  try {
    const result = await getPortalChildLodickyForActor(
      {
        email: context.email,
        personIds: context.personIds,
        roles: context.roles,
      },
      childId,
    );
    if (!result) {
      return NextResponse.json({ error: "Toto dítě vám není přiřazeno." }, { status: 403 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/m01/child/[childId]/lodicky]", error);
    return NextResponse.json({ error: "Nepodařilo se načíst osobní lodičky." }, { status: 500 });
  }
}
