import { NextRequest, NextResponse } from "next/server";

import { getApiSessionContext } from "@/src/lib/api/session";
import { savePortalLodickaStatusForActor, type PortalLodickaStav } from "@/src/lib/portal-db";

export const runtime = "nodejs";
export const maxDuration = 60;

type SaveStatusPayload = {
  status?: unknown;
  effectiveDate?: unknown;
  overwriteSameDate?: unknown;
  allowHistorical?: unknown;
  invalidateNewer?: unknown;
  note?: unknown;
};

function toBoolean(value: unknown): boolean {
  return value === true;
}

function isLodickaStav(value: unknown): value is PortalLodickaStav {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4;
}

function actorLabelFromContext(context: NonNullable<Awaited<ReturnType<typeof getApiSessionContext>>>): string {
  const displayName = context.session.user?.jmeno ?? context.session.user?.name;
  const label = typeof displayName === "string" ? displayName.trim() : "";
  if (label) return label;
  return context.email.trim() || "Neznámý uživatel";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ personalId: string }> },
) {
  const context = await getApiSessionContext(req);
  if (!context) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  const { personalId } = await params;
  if (!personalId?.trim()) {
    return NextResponse.json({ error: "Chybí personalId" }, { status: 400 });
  }

  let payload: SaveStatusPayload;
  try {
    payload = (await req.json()) as SaveStatusPayload;
  } catch {
    return NextResponse.json({ error: "Neplatný JSON payload." }, { status: 400 });
  }

  if (!isLodickaStav(payload.status)) {
    return NextResponse.json({ error: "Neplatná hodnota stavu lodičky." }, { status: 400 });
  }

  const effectiveDate = typeof payload.effectiveDate === "string" ? payload.effectiveDate.trim() : "";
  if (!effectiveDate) {
    return NextResponse.json({ error: "Chybí datum stavu." }, { status: 400 });
  }

  const note = typeof payload.note === "string" ? payload.note : undefined;

  try {
    const result = await savePortalLodickaStatusForActor(
      {
        email: context.email,
        personIds: context.personIds,
        roles: context.roles,
      },
      {
        personalLodickaId: personalId,
        effectiveDate,
        status: payload.status,
        overwriteSameDate: toBoolean(payload.overwriteSameDate),
        allowHistorical: toBoolean(payload.allowHistorical),
        invalidateNewer: toBoolean(payload.invalidateNewer),
        note,
        actorPersonId: context.actorPersonId,
        actorLabel: actorLabelFromContext(context),
      },
    );

    if (!result.ok) {
      if (result.code === "FORBIDDEN") {
        return NextResponse.json({ error: result.message }, { status: 403 });
      }
      if (result.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.message }, { status: 404 });
      }
      if (result.code === "SAME_DATE_EXISTS" || result.code === "HISTORICAL_CONFLICT") {
        return NextResponse.json(
          {
            error: result.message,
            code: result.code,
            sameDateCount: result.sameDateCount ?? 0,
            newerCount: result.newerCount ?? 0,
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/m01/lodicky/[personalId]/status]", error);
    return NextResponse.json({ error: "Nepodařilo se uložit stav lodičky." }, { status: 500 });
  }
}
