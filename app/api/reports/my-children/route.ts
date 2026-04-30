import { NextResponse } from "next/server";

import { getApiSessionContext } from "@/src/lib/api/session";
import { getReportParentAndChildrenForActor } from "@/src/lib/reports-db";

export async function GET() {
  const context = await getApiSessionContext();
  if (!context) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  try {
    const reportContext = await getReportParentAndChildrenForActor({
      email: context.email,
      personIds: context.personIds,
      roles: context.roles,
    });
    if (!reportContext) {
      return NextResponse.json({ error: "Přístup zamítnut." }, { status: 403 });
    }

    return NextResponse.json({
      parent: reportContext.parent,
      userEmail: context.email,
      children: reportContext.children,
    });
  } catch (error) {
    console.error("[api/reports/my-children]", error);
    return NextResponse.json({ error: "Nepodařilo se načíst děti." }, { status: 500 });
  }
}
