import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { auth } from "@/src/lib/auth";
import { collectSessionRoles, isLocalDevAuthBypass, LOCAL_DEV_ROLES } from "@/src/lib/api/session";
import { getSelectedDevAuthUser } from "@/src/lib/dev-auth";
import { prisma } from "@/src/lib/prisma";
import { canManageWholeFleet } from "@/app/(dashboard)/portal/lodicky/sprava/data";

export async function POST(request: NextRequest) {
  const session = await auth();
  const selectedDevUser = isLocalDevAuthBypass() ? await getSelectedDevAuthUser() : null;
  const roles = selectedDevUser?.roles ?? (session ? collectSessionRoles(session) : LOCAL_DEV_ROLES);
  if (!canManageWholeFleet(roles)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let svpVersionId = "";
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      svpVersionId = typeof body?.svpVersionId === "string" ? body.svpVersionId : "";
    } else {
      const body = await request.text();
      const parsed = JSON.parse(body || "{}");
      svpVersionId = typeof parsed?.svpVersionId === "string" ? parsed.svpVersionId : "";
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!svpVersionId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM app_m01_svp_version
    WHERE id = ${svpVersionId}
      AND status = 'DRAFT'::"M01SvpVersionStatus"
      AND parent_svp_version_id IS NOT NULL
  `);

  return NextResponse.json({ ok: true });
}
