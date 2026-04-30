import { NextRequest, NextResponse } from "next/server";

import { DEV_AUTH_COOKIE_NAME, getDevAuthUsers, isDevAuthBypassEnabled } from "@/src/lib/dev-auth";

function getDevAuthRedirect(req: NextRequest): URL {
  const redirectTo = new URL(req.headers.get("referer") || "/", req.url);
  if (!redirectTo.pathname.startsWith("/auth/")) {
    return redirectTo;
  }

  const callbackUrl = redirectTo.searchParams.get("callbackUrl");
  if (callbackUrl) {
    const callbackTarget = new URL(callbackUrl, req.url);
    if (callbackTarget.origin === new URL(req.url).origin && !callbackTarget.pathname.startsWith("/auth/")) {
      return callbackTarget;
    }
  }

  return new URL("/", req.url);
}

export async function POST(req: NextRequest) {
  if (!isDevAuthBypassEnabled()) {
    return NextResponse.json({ error: "Dev auth bypass is disabled." }, { status: 404 });
  }

  const formData = await req.formData();
  const personId = String(formData.get("personId") ?? "").trim();
  const redirectTo = getDevAuthRedirect(req);

  const response = NextResponse.redirect(redirectTo, { status: 303 });
  if (!personId) {
    response.cookies.delete(DEV_AUTH_COOKIE_NAME);
    return response;
  }

  const users = await getDevAuthUsers();
  const selected = users.find((user) => user.personId === personId);
  if (!selected) {
    return NextResponse.json({ error: "Unknown dev user." }, { status: 400 });
  }

  response.cookies.set(DEV_AUTH_COOKIE_NAME, selected.personId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
