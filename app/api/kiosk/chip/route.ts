import { NextRequest, NextResponse } from "next/server";
import { checkKioskKey, findChildByChip, getKioskTermsForChild } from "@/src/lib/kiosk";
import { resolvePersonName } from "@/src/lib/person-name";

export const runtime = "nodejs";

function mapKioskError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ECONNREFUSED") || message.includes("connect ECONNREFUSED")) {
    return { status: 503, message: "Databáze není dostupná. Na devu nejdřív spusťte DB tunnel." };
  }
  return { status: 500, message: "Interní chyba kiosku." };
}

export async function POST(req: NextRequest) {
  try {
    if (!checkKioskKey(req.headers.get("x-kiosk-key"), req.headers.get("host"))) {
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
        displayName: resolvePersonName({
          nickname: person.nickname,
          displayName: person.displayName,
        }),
        nickname: person.nickname ?? null,
        schoolGrade: gradeRows[0]?.grade ?? null,
        groupKeys: groupRows.map((r) => `${r.kind}::${r.code}`),
      };
    } else {
      const chipCode = body.chipCode?.trim();
      if (!chipCode) return NextResponse.json({ error: "chipCode required" }, { status: 400 });
      child = await findChildByChip(chipCode);
      if (!child) {
        if (process.env.NODE_ENV === "development") {
          const { prisma } = await import("@/src/lib/prisma");
          const chipCoverage = await prisma.appPerson.aggregate({
            where: { isActive: true },
            _count: { chipUid: true, chipHid: true },
          });
          if ((chipCoverage._count.chipUid ?? 0) === 0 && (chipCoverage._count.chipHid ?? 0) === 0) {
            return NextResponse.json(
              { error: "Čip nebyl rozpoznán. V dev DB nejsou vyplněné čipové údaje (chip_uid/chip_hid)." },
              { status: 404 },
            );
          }

          const codePoints = Array.from(chipCode)
            .map((ch) => ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"))
            .join(" ");
          const compact = chipCode.replace(/\s+/g, "");
          return NextResponse.json(
            {
              error: `Čip nebyl rozpoznán. Přijatý kód: "${chipCode}" (compact: "${compact}", délka: ${chipCode.length}, hex: ${codePoints})`,
            },
            { status: 404 },
          );
        }
        return NextResponse.json({ error: "Čip nebyl rozpoznán." }, { status: 404 });
      }
    }

    const terms = await getKioskTermsForChild(child);
    return NextResponse.json({ child, terms });
  } catch (error) {
    console.error("[kiosk/chip] Unhandled error", error);
    const mapped = mapKioskError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
