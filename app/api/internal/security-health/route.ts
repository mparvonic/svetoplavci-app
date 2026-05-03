import { NextRequest, NextResponse } from "next/server";

import { hasAnySessionRole, getApiSessionContext } from "@/src/lib/api/session";
import {
  getRequestHost,
  getStagingAllowedEmailsFromEnv,
  isAuthBypassForcedOn,
  isBypassAllowedForHost,
  isProductionHost,
  isStagingHost,
} from "@/src/lib/environment-access";

export const runtime = "nodejs";

function hasValidBearerToken(req: NextRequest): boolean {
  const expected = process.env.INTERNAL_SECURITY_HEALTH_TOKEN?.trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  const host = getRequestHost(req);
  const context = await getApiSessionContext(req);
  const isAdmin = !!context && hasAnySessionRole(context.roles, new Set(["admin"]));

  if (!isAdmin && !hasValidBearerToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bypassForcedOn = isAuthBypassForcedOn();
  const protectedHost = isProductionHost(host) || isStagingHost(host);
  const bypassBlockedByHostRule = !isBypassAllowedForHost(host);
  const stagingAllowlistSize = getStagingAllowedEmailsFromEnv().size;

  return NextResponse.json({
    ok: !protectedHost || !bypassForcedOn,
    checkedAt: new Date().toISOString(),
    host,
    checks: {
      bypass_off_on_protected_host: !protectedHost || !bypassForcedOn,
      bypass_forced_on: bypassForcedOn,
      bypass_blocked_by_host_rule: bypassBlockedByHostRule,
      staging_tester_gate_on: true,
      staging_allowlist_size: stagingAllowlistSize,
    },
  });
}
