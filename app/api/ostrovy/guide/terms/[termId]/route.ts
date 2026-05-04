import { NextRequest, NextResponse } from "next/server";

import {
  cancelOstrovyTerm,
  getOstrovyTerm,
  updateOstrovyTerm,
  type CancelOstrovyTermInput,
  type UpdateOstrovyTermInput,
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

export async function GET(req: NextRequest, context: { params: Promise<{ termId: string }> }) {
  const sessionContext = await getApiSessionContext(req);
  if (!sessionContext) return unauthorized();
  if (!hasAnySessionRole(sessionContext.roles, GUIDE_ROLE_CODES)) return forbidden();

  const { termId } = await context.params;
  const term = await getOstrovyTerm(termId);
  if (!term) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ term });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ termId: string }> }) {
  const sessionContext = await getApiSessionContext(req);
  if (!sessionContext) return unauthorized();
  if (!hasAnySessionRole(sessionContext.roles, GUIDE_ROLE_CODES)) return forbidden();

  const { termId } = await context.params;
  let payload: UpdateOstrovyTermInput;
  try {
    payload = (await req.json()) as UpdateOstrovyTermInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const term = await updateOstrovyTerm(termId, payload, sessionContext.actorPersonId);
    return NextResponse.json({ ok: true, term });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ termId: string }> }) {
  const sessionContext = await getApiSessionContext(req);
  if (!sessionContext) return unauthorized();
  if (!hasAnySessionRole(sessionContext.roles, GUIDE_ROLE_CODES)) return forbidden();

  const { termId } = await context.params;
  let payload: CancelOstrovyTermInput = {};
  try {
    payload = (await req.json()) as CancelOstrovyTermInput;
  } catch {
    payload = {};
  }

  try {
    const result = await cancelOstrovyTerm(termId, payload, sessionContext.actorPersonId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
