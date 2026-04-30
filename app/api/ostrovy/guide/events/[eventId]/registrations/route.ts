import { NextRequest, NextResponse } from "next/server";

import {
  listOstrovRegistrations,
  registerOstrovStudent,
  unregisterOstrovStudent,
} from "@/src/lib/school-events/ostrovy";
import {
  getApiSessionContext,
  GUIDE_ROLE_CODES,
  hasAnySessionRole,
} from "@/src/lib/api/session";

export const runtime = "nodejs";
export const maxDuration = 60;

type RegistrationAction = "register" | "unregister";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(_req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const sessionContext = await getApiSessionContext();
  if (!sessionContext) return unauthorized();
  if (!hasAnySessionRole(sessionContext.roles, GUIDE_ROLE_CODES)) return forbidden();

  const { eventId } = await context.params;
  const registrations = await listOstrovRegistrations(eventId);
  return NextResponse.json({ registrations });
}

export async function POST(req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const sessionContext = await getApiSessionContext();
  if (!sessionContext) return unauthorized();
  if (!hasAnySessionRole(sessionContext.roles, GUIDE_ROLE_CODES)) return forbidden();

  const { eventId } = await context.params;
  let payload: {
    personId?: string;
    action?: RegistrationAction;
    allowTransfer?: boolean;
    note?: string | null;
    exceptionReason?: string | null;
  } = {};
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const personId = payload.personId?.trim();
  if (!personId) {
    return NextResponse.json({ error: "personId is required." }, { status: 400 });
  }

  const action = payload.action ?? "register";
  if (action !== "register" && action !== "unregister") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  try {
    const result = action === "register"
      ? await registerOstrovStudent({
          eventId,
          personId,
          actorPersonId: sessionContext.actorPersonId,
          actorRoles: sessionContext.roles,
          allowTransfer: Boolean(payload.allowTransfer),
          allowGuideException: true,
          exceptionReason: payload.exceptionReason ?? "guide change",
          note: payload.note ?? null,
          sourceRef: "api/ostrovy/guide/registrations",
        })
      : await unregisterOstrovStudent({
          eventId,
          personId,
          actorPersonId: sessionContext.actorPersonId,
          actorRoles: sessionContext.roles,
          allowGuideException: true,
          exceptionReason: payload.exceptionReason ?? "guide change",
          note: payload.note ?? null,
          sourceRef: "api/ostrovy/guide/registrations",
        });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
