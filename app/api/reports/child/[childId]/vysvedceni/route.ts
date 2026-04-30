import { NextResponse } from "next/server";

import { getApiSessionContext } from "@/src/lib/api/session";
import { getChildVysvedceniForActor } from "@/src/lib/reports-db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ childId: string }> },
) {
  const context = await getApiSessionContext();
  if (!context) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  const { childId } = await params;
  if (!childId) {
    return NextResponse.json({ error: "Chybí childId" }, { status: 400 });
  }

  try {
    const result = await getChildVysvedceniForActor(
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

    return NextResponse.json({
      child: result.child,
      predmetu: result.predmetu,
      oblasti: result.oblasti,
    });
  } catch (error) {
    console.error("[api/reports/child/[childId]/vysvedceni]", error);
    return NextResponse.json({ error: "Nepodařilo se načíst vysvědčení." }, { status: 500 });
  }
}
