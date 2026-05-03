import { NextRequest, NextResponse } from "next/server";
import { checkKioskKey, findChildByChip, getKioskTermsForChild } from "@/src/lib/kiosk";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!checkKioskKey(req.headers.get("x-kiosk-key"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { chipCode?: string; childId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let child;
  if (body.childId) {
    // Refresh path: re-load child by ID
    const { prisma } = await import("@/src/lib/prisma");
    const { Prisma } = await import("@prisma/client");
    const person = await prisma.appPerson.findFirst({
      where: { id: body.childId, isActive: true },
      select: { id: true, displayName: true, nickname: true },
    });
    if (!person) return NextResponse.json({ error: "Dítě nenalezeno." }, { status: 404 });
    const gradeRows = await prisma.$queryRaw<Array<{ grade: number | null }>>(Prisma.sql`
      SELECT (sr.payload->>'CurrentGradeNum')::int AS grade
      FROM app_person_source_record sr
      WHERE sr.person_id = ${person.id} AND sr.active_source = TRUE
        AND sr.derived_roles @> ARRAY['zak']::text[]
        AND (sr.payload->>'CurrentGradeNum') ~ '^[0-9]+$'
      LIMIT 1
    `);
    const now = new Date();
    const groupRows = await prisma.$queryRaw<Array<{ kind: string; code: string }>>(Prisma.sql`
      SELECT lower(g.kind::text) AS kind, lower(g.code) AS code
      FROM app_group g JOIN app_group_membership gm ON gm.group_id = g.id
      WHERE gm.person_id = ${person.id} AND g.is_active = TRUE
        AND (g.valid_from IS NULL OR g.valid_from <= ${now})
        AND (g.valid_to IS NULL OR g.valid_to > ${now})
    `).catch(() => [] as Array<{ kind: string; code: string }>);
    child = {
      id: person.id,
      displayName: person.displayName ?? "",
      nickname: person.nickname ?? null,
      schoolGrade: gradeRows[0]?.grade ?? null,
      groupKeys: groupRows.map((r) => `${r.kind}::${r.code}`),
    };
  } else {
    const chipCode = body.chipCode?.trim();
    if (!chipCode) return NextResponse.json({ error: "chipCode required" }, { status: 400 });
    child = await findChildByChip(chipCode);
    if (!child) return NextResponse.json({ error: "Čip nebyl rozpoznán." }, { status: 404 });
  }

  const terms = await getKioskTermsForChild(child);

  return NextResponse.json({ child, terms });
}
