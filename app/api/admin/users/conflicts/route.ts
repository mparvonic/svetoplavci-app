import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/src/lib/auth";
import { getIdentityConflicts, resolveIdentityConflict } from "@/src/lib/user-sync";

function collectRoles(session: { user?: { role?: unknown; roles?: unknown } } | null): string[] {
  if (!session?.user) return [];
  if (Array.isArray(session.user.roles)) {
    return session.user.roles.map((value) => String(value));
  }
  if (typeof session.user.role === "string" && session.user.role) {
    return [session.user.role];
  }
  return [];
}

function isAdmin(session: { user?: { role?: unknown; roles?: unknown } } | null): boolean {
  return collectRoles(session).includes("admin");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const parsedLimit = limitParam ? Number(limitParam) : 50;
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

  const conflicts = await getIdentityConflicts(limit);
  const response = conflicts.map((conflict) => ({
    id: conflict.id,
    identityId: conflict.identityId,
    normalizedValue: conflict.normalizedValue,
    openedAt: conflict.createdAt,
    details: conflict.details,
    candidates: (conflict.identity?.personLinks ?? []).map((link) => ({
      personId: link.personId,
      status: link.status,
      approvedBy: link.approvedBy,
      approvedAt: link.approvedAt,
      displayName: link.person.displayName,
      roles: link.person.roles.map((role) => role.role),
      source: link.person.sourceRecords[0]?.sourceType ?? null,
      sourceEmail: link.person.sourceRecords[0]?.primaryEmail ?? null,
    })),
  }));

  return NextResponse.json({ conflicts: response });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { identityId?: string; approvedPersonIds?: string[] } = {};
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    payload = {};
  }

  const identityId = payload.identityId?.trim();
  const approvedPersonIds = Array.isArray(payload.approvedPersonIds)
    ? payload.approvedPersonIds.map((value) => String(value).trim()).filter(Boolean)
    : [];

  if (!identityId) {
    return NextResponse.json({ error: "Missing identityId." }, { status: 400 });
  }
  if (approvedPersonIds.length === 0) {
    return NextResponse.json({ error: "Missing approvedPersonIds." }, { status: 400 });
  }

  try {
    await resolveIdentityConflict(identityId, approvedPersonIds, session.user.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
