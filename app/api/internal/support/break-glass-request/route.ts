import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getApiSessionContext, hasAnySessionRole } from "@/src/lib/api/session";
import { logSecurityEvent } from "@/src/lib/security-events";

export const runtime = "nodejs";

type BreakGlassRequestPayload = {
  targetPersonId?: string;
  reason?: string;
  scope?: string;
  requestedMinutes?: number;
};

function normalizeText(value: unknown, maxLength: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, maxLength);
}

export async function POST(req: NextRequest) {
  const context = await getApiSessionContext(req);
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnySessionRole(context.roles, new Set(["admin"]))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: BreakGlassRequestPayload = {};
  try {
    payload = (await req.json()) as BreakGlassRequestPayload;
  } catch {
    payload = {};
  }

  const targetPersonId = normalizeText(payload.targetPersonId, 120);
  const reason = normalizeText(payload.reason, 1000);
  const scope = normalizeText(payload.scope, 240);
  const requestedMinutes = Number(payload.requestedMinutes ?? 30);
  const requestedDurationMinutes = Number.isFinite(requestedMinutes)
    ? Math.max(5, Math.min(Math.round(requestedMinutes), 120))
    : 30;

  if (!targetPersonId || !reason) {
    return NextResponse.json({ error: "Missing targetPersonId or reason." }, { status: 400 });
  }

  const requestId = `BG-${randomUUID()}`;
  const createdAt = new Date().toISOString();

  logSecurityEvent("warn", {
    event: "break_glass_requested",
    message: "Break-glass request logged. Requires out-of-band dual approval.",
    email: context.email,
    roles: context.roles,
    details: {
      requestId,
      createdAt,
      targetPersonId,
      reason,
      scope: scope || "read-only-personal-data",
      requestedDurationMinutes,
      approvalStatus: "pending_manual_dual_approval",
    },
  });

  return NextResponse.json({
    ok: true,
    requestId,
    createdAt,
    approvalStatus: "pending_manual_dual_approval",
    note: "Žádost je auditně zapsána. Schválení musí proběhnout mimo systém dvěma osobami.",
  });
}
