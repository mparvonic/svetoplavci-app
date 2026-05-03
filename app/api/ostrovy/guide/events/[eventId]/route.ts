import { NextRequest, NextResponse } from "next/server";

import {
  cancelOstrov,
  getOstrov,
  updateOstrov,
  type UpdateOstrovInput,
} from "@/src/lib/school-events/ostrovy";
import {
  getApiSessionContext,
  GUIDE_ROLE_CODES,
  hasAnySessionRole,
} from "@/src/lib/api/session";

export const runtime = "nodejs";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const sessionContext = await getApiSessionContext(req);
  if (!sessionContext) return unauthorized();
  if (!hasAnySessionRole(sessionContext.roles, GUIDE_ROLE_CODES)) return forbidden();

  const { eventId } = await context.params;
  const event = await getOstrov(eventId);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ event });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const sessionContext = await getApiSessionContext(req);
  if (!sessionContext) return unauthorized();
  if (!hasAnySessionRole(sessionContext.roles, GUIDE_ROLE_CODES)) return forbidden();

  const { eventId } = await context.params;
  let payload: UpdateOstrovInput;
  try {
    payload = (await req.json()) as UpdateOstrovInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const event = await updateOstrov(eventId, payload, sessionContext.actorPersonId);
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const sessionContext = await getApiSessionContext(req);
  if (!sessionContext) return unauthorized();
  if (!hasAnySessionRole(sessionContext.roles, GUIDE_ROLE_CODES)) return forbidden();

  const { eventId } = await context.params;
  try {
    const result = await cancelOstrov(eventId, sessionContext.actorPersonId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
