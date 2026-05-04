import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getApiSessionContext } from "@/src/lib/api/session";
import { logSecurityEvent } from "@/src/lib/security-events";

export const runtime = "nodejs";

type SupportTicketPayload = {
  title?: string;
  description?: string;
  endpoint?: string;
  errorCode?: string;
  requestId?: string;
};

function normalizeText(value: unknown, maxLength: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, maxLength);
}

function toHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(req: NextRequest) {
  const context = await getApiSessionContext(req);
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SupportTicketPayload = {};
  try {
    payload = (await req.json()) as SupportTicketPayload;
  } catch {
    payload = {};
  }

  const title = normalizeText(payload.title, 180);
  const description = normalizeText(payload.description, 4000);
  const endpoint = normalizeText(payload.endpoint, 240);
  const errorCode = normalizeText(payload.errorCode, 120);
  const requestId = normalizeText(payload.requestId, 120);

  if (!title || !description) {
    return NextResponse.json({ error: "Missing title or description." }, { status: 400 });
  }

  const ticketId = `SUP-${randomUUID()}`;
  const createdAt = new Date().toISOString();

  logSecurityEvent("info", {
    event: "support_ticket_created",
    message: "Support ticket created by user.",
    email: context.email,
    roles: context.roles,
    pathname: endpoint || "/",
    details: {
      ticketId,
      createdAt,
      title,
      errorCode: errorCode || null,
      requestId: requestId || null,
      descriptionLength: description.length,
      descriptionHash: toHash(description),
    },
  });

  return NextResponse.json({
    ok: true,
    ticketId,
    createdAt,
    status: "logged",
    message: "Ticket byl přijat a zapsán do support logu.",
  });
}
