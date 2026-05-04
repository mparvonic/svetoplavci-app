import { NextRequest, NextResponse } from "next/server";

import {
  createOstrov,
  listOstrovyTerms,
  type CreateOstrovInput,
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

export async function GET(req: NextRequest) {
  const context = await getApiSessionContext(req);
  if (!context) return unauthorized();
  if (!hasAnySessionRole(context.roles, GUIDE_ROLE_CODES)) return forbidden();

  const params = req.nextUrl.searchParams;
  const terms = await listOstrovyTerms({
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    includeInactive: params.get("includeInactive") === "1",
  });
  const termId = params.get("termId");
  const events = terms
    .filter((term) => !termId || term.id === termId)
    .flatMap((term) => term.events.map((event) => ({ ...event, offerGroup: term })));
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const context = await getApiSessionContext(req);
  if (!context) return unauthorized();
  if (!hasAnySessionRole(context.roles, GUIDE_ROLE_CODES)) return forbidden();

  let payload: CreateOstrovInput;
  try {
    payload = (await req.json()) as CreateOstrovInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const event = await createOstrov(payload, context.actorPersonId);
    return NextResponse.json({ ok: true, event }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
