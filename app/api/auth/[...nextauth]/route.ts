import { NextRequest, NextResponse } from "next/server";

import { handlers } from "@/src/lib/auth";
import { getDevAuthSession, isDevAuthBypassEnabled } from "@/src/lib/dev-auth";

type RouteContext = {
  params: Promise<{
    nextauth?: string[];
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const params = await context.params;
  if (isDevAuthBypassEnabled() && params.nextauth?.[0] === "session") {
    try {
      return NextResponse.json(await getDevAuthSession());
    } catch (error) {
      console.error("[dev-auth] session bypass failed", error);
      return NextResponse.json(null);
    }
  }

  const handler = handlers.GET as unknown as (request: NextRequest, routeContext: RouteContext) => Promise<Response>;
  return handler(req, context);
}

export const POST = handlers.POST;

// Vynucení Node.js runtime – Nodemailer provider používá modul 'stream', který Edge nepodporuje.
export const runtime = "nodejs";
