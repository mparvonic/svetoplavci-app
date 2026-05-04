import { NextResponse } from "next/server";

import {
  CHILD_VIEW_ROLE_CODES,
  getApiSessionContext,
  hasAnySessionRole,
} from "@/src/lib/api/session";
import { getChildVysvedceniGrafyForActor } from "@/src/lib/reports-db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ childId: string }> },
) {
  const context = await getApiSessionContext(req);
  if (!context) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }
  if (!hasAnySessionRole(context.roles, CHILD_VIEW_ROLE_CODES)) {
    return NextResponse.json({ error: "Přístup zamítnut." }, { status: 403 });
  }

  const { childId } = await params;
  if (!childId) {
    return NextResponse.json({ error: "Chybí childId" }, { status: 400 });
  }

  try {
    const result = await getChildVysvedceniGrafyForActor(
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

    const jmeno = result.child.name;
    return NextResponse.json({
      child: jmeno,
      curve: result.curve,
      report: { jmeno, predmety: result.predmety },
    });
  } catch (error) {
    console.error("[api/reports/child/[childId]/vysvedceni-grafy]", error);
    return NextResponse.json({ error: "Nepodařilo se načíst grafy." }, { status: 500 });
  }
}
