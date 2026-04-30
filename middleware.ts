import NextAuth from "next-auth";
import { authConfig } from "@/src/lib/auth.config";

const { auth } = NextAuth(authConfig);

function collectUserRoles(session: { user?: { roles?: unknown; role?: unknown } } | null): string[] {
  if (!session?.user) return [];
  if (Array.isArray(session.user.roles) && session.user.roles.length > 0) {
    return session.user.roles.map((r) => String(r));
  }
  if (typeof session.user.role === "string" && session.user.role) {
    return [session.user.role];
  }
  return [];
}

function hasRole(roles: string[], allowed: string[]): boolean {
  return roles.some((role) => allowed.includes(role));
}

function isAuthBypassEnabledForHost(host: string): boolean {
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const isTestHost = host === "test-app.svetoplavci.cz" || host === "app-test.svetoplavci.cz";
  if (host === "app.svetoplavci.cz") return false;
  if (process.env.AUTH_BYPASS === "1") return isLocalHost || isTestHost;
  return process.env.NODE_ENV === "development" && process.env.AUTH_BYPASS !== "0" && isLocalHost;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const isTestHost = host === "test-app.svetoplavci.cz" || host === "app-test.svetoplavci.cz";
  const testDefaultPath = "/portal/osobni-lodicky";
  const testAllowedPathPrefixes = ["/vysvedceni", "/portal/osobni-lodicky", "/ostrovy", "/admin"];

  if (isAuthBypassEnabledForHost(host)) {
    return;
  }

  // Veřejné cesty – bez kontroly
  if (pathname === "/" || pathname.startsWith("/auth/")) {
    return;
  }

  // Nepřihlášený uživatel → přihlášení
  if (!session?.user) {
    const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(signInUrl);
  }

  const roles = collectUserRoles(session);

  // test-app: přístup jen pro tester/admin
  if (isTestHost && !hasRole(roles, ["tester", "admin"])) {
    return Response.redirect(new URL("/auth/error?error=NoEnvRole", req.nextUrl.origin));
  }

  // proto-app: přístup jen pro proto/admin
  if (host === "proto-app.svetoplavci.cz" && !hasRole(roles, ["proto", "admin"])) {
    return Response.redirect(new URL("/auth/error?error=NoEnvRole", req.nextUrl.origin));
  }

  // /admin/* – pouze role admin
  if (pathname.startsWith("/admin")) {
    if (!hasRole(roles, ["admin"])) {
      return Response.redirect(new URL("/", req.nextUrl.origin));
    }
  }

  // test-app: držet jen schválené testované části aplikace
  if (
    isTestHost &&
    pathname !== "/" &&
    !pathname.startsWith("/auth/") &&
    !testAllowedPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) {
    return Response.redirect(new URL(testDefaultPath, req.nextUrl.origin));
  }

  // /kiosk/* a /portal/* – přístup pro všechny přihlášené (už ověřeno výše)
});

export const config = {
  matcher: [
    /*
     * Match all paths kromě api, _next/static, _next/image, favicon, veřejných assetů.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
