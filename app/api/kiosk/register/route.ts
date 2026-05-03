import { NextRequest, NextResponse } from "next/server";
import { AppSchoolEventRegistrationStatus } from "@prisma/client";
import { checkKioskKey } from "@/src/lib/kiosk";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** POST /api/kiosk/register — register child for island */
export async function POST(req: NextRequest) {
  if (!checkKioskKey(req.headers.get("x-kiosk-key"))) return unauthorized();

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

  const now = new Date();

  const event = await prisma.appSchoolEvent.findFirst({
    where: { id: islandId, isActive: true, eventType: { code: "OSTROVY" } },
    include: {
      registrationPolicy: true,
      registrations: {
        where: { status: { in: [AppSchoolEventRegistrationStatus.REGISTERED, AppSchoolEventRegistrationStatus.WAITLIST] } },
      },
      offerGroup: { select: { id: true } },
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Ostrov nenalezen." }, { status: 404 });
  }

  const policy = event.registrationPolicy;
  if (!policy?.isEnabled) {
    return NextResponse.json({ error: "Přihlašování není povoleno." }, { status: 403 });
  }
  if (policy.opensAt && now < policy.opensAt) {
    return NextResponse.json({ error: "Přihlašování ještě nezačalo." }, { status: 403 });
  }
  if (policy.closesAt && now > policy.closesAt) {
    return NextResponse.json({ error: "Přihlašování bylo uzavřeno." }, { status: 403 });
  }

  const alreadyHere = event.registrations.some((r) => r.personId === childId);
  if (!alreadyHere && policy.capacity != null && event.registrations.length >= policy.capacity) {
    return NextResponse.json({ error: "Ostrov je plný." }, { status: 409 });
  }

  // Cancel any existing registration in the same term
  if (event.offerGroup) {
    const termEvents = await prisma.appSchoolEvent.findMany({
      where: { offerGroupId: event.offerGroup.id, isActive: true, id: { not: islandId } },
      select: { id: true },
    });
    if (termEvents.length > 0) {
      await prisma.appSchoolEventRegistration.updateMany({
        where: {
          personId: childId,
          schoolEventId: { in: termEvents.map((e) => e.id) },
          status: { in: [AppSchoolEventRegistrationStatus.REGISTERED, AppSchoolEventRegistrationStatus.WAITLIST] },
        },
        data: { status: AppSchoolEventRegistrationStatus.UNREGISTERED, updatedAt: now },
      });
    }
  }

  // Upsert registration
  await prisma.appSchoolEventRegistration.upsert({
    where: { schoolEventId_personId: { schoolEventId: islandId, personId: childId } },
    create: {
      schoolEventId: islandId,
      personId: childId,
      status: AppSchoolEventRegistrationStatus.REGISTERED,
    },
    update: {
      status: AppSchoolEventRegistrationStatus.REGISTERED,
      updatedAt: now,
    },
  });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/kiosk/register — unregister child from island */
export async function DELETE(req: NextRequest) {
  if (!checkKioskKey(req.headers.get("x-kiosk-key"))) return unauthorized();

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

  const now = new Date();

  const event = await prisma.appSchoolEvent.findFirst({
    where: { id: islandId, isActive: true, eventType: { code: "OSTROVY" } },
    include: { registrationPolicy: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Ostrov nenalezen." }, { status: 404 });
  }

  const policy = event.registrationPolicy;
  if (policy?.unregisterClosesAt && now > policy.unregisterClosesAt) {
    return NextResponse.json({ error: "Odhlašování bylo uzavřeno." }, { status: 403 });
  }

  await prisma.appSchoolEventRegistration.updateMany({
    where: {
      schoolEventId: islandId,
      personId: childId,
      status: { in: [AppSchoolEventRegistrationStatus.REGISTERED, AppSchoolEventRegistrationStatus.WAITLIST] },
    },
    data: { status: AppSchoolEventRegistrationStatus.UNREGISTERED, updatedAt: now },
  });

  return NextResponse.json({ ok: true });
}
