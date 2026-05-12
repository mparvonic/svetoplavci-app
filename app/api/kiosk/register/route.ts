import { NextRequest, NextResponse } from "next/server";
import { checkKioskKey } from "@/src/lib/kiosk";
import { registerOstrovStudent, unregisterOstrovStudent } from "@/src/lib/school-events/ostrovy";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function mapKioskError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ECONNREFUSED") || message.includes("connect ECONNREFUSED")) {
    return { status: 503, message: "Databáze není dostupná. Na devu nejdřív spusťte DB tunnel." };
  }
  if (message.includes("not found") || message.includes("neexistuje")) {
    return { status: 404, message };
  }
  if (message.includes("capacity is full") || message.includes("plný") || message.includes("vyčerpaný limit")) {
    return { status: 409, message };
  }
  if (
    message.includes("Registrační okno") ||
    message.includes("Okno pro odhlášení") ||
    message.includes("není aktivní žák v denním studiu") ||
    message.includes("outside the target audience")
  ) {
    return { status: 403, message };
  }
  return { status: 500, message: "Interní chyba kiosku." };
}

/** POST /api/kiosk/register — register child for island */
export async function POST(req: NextRequest) {
  try {
    if (!checkKioskKey(req.headers.get("x-kiosk-key"), req.headers.get("host"))) return unauthorized();

    let body: { childId?: string; islandId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { childId, islandId } = body;
    if (!childId || !islandId) {
      return NextResponse.json({ error: "childId and islandId required" }, { status: 400 });
    }

    await registerOstrovStudent({
      eventId: islandId,
      personId: childId,
      allowTransfer: true,
      allowGuideException: false,
      sourceRef: "api/kiosk/register",
      enqueueCalendarSync: false,
      waitForCalendarSync: false,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[kiosk/register:POST] Unhandled error", error);
    const mapped = mapKioskError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

/** DELETE /api/kiosk/register — unregister child from island */
export async function DELETE(req: NextRequest) {
  try {
    if (!checkKioskKey(req.headers.get("x-kiosk-key"), req.headers.get("host"))) return unauthorized();

    let body: { childId?: string; islandId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { childId, islandId } = body;
    if (!childId || !islandId) {
      return NextResponse.json({ error: "childId and islandId required" }, { status: 400 });
    }

    await unregisterOstrovStudent({
      eventId: islandId,
      personId: childId,
      allowGuideException: false,
      sourceRef: "api/kiosk/register",
      enqueueCalendarSync: false,
      waitForCalendarSync: false,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[kiosk/register:DELETE] Unhandled error", error);
    const mapped = mapKioskError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
