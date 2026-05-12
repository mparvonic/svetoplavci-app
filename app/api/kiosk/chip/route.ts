import { NextRequest, NextResponse } from "next/server";
import { checkKioskKey, findChildByChip, findChildById, getKioskTermsForChild } from "@/src/lib/kiosk";

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
      child = await findChildById(body.childId);
      if (!child) return NextResponse.json({ error: "Dítě nenalezeno pro Ostrovy." }, { status: 404 });
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
