import NextAuth from "next-auth";
import { getRequiredRolesForPath, hasAnyRole } from "@/src/lib/access-matrix";
import { authConfig } from "@/src/lib/auth.config";
import {
  isAuthBypassForcedOn,
  getStagingAllowedEmailsFromEnv,
  isUnsafeBypassConfigurationForHost,
  isBypassAllowedForHost,
  isStagingHost,
  normalizeHost,
  warnUnsafeBypassConfiguration,
} from "@/src/lib/environment-access";
import { logSecurityEvent, logSecurityEventOnce } from "@/src/lib/security-events";

const { auth } = NextAuth(authConfig);

function collectUserRoles(session: { user?: { roles?: unknown; role?: unknown } } | null): string[] {
  if (!session?.user) return [];
  if (Array.isArray(session.user.roles) && session.user.roles.length > 0) {
    return session.user.roles.map((r) => String(r).toLowerCase());
  }
  if (typeof session.user.role === "string" && session.user.role) {
    return [session.user.role.toLowerCase()];
  }
  return [];
}

function hasRole(roles: string[], allowed: string[]): boolean {
  return roles.some((role) => allowed.includes(role.toLowerCase()));
}

function isAuthBypassEnabledForHost(host: string): boolean {
  if (!isBypassAllowedForHost(host)) return false;
  if (process.env.AUTH_BYPASS === "1") return true;
  return process.env.NODE_ENV === "development" && process.env.AUTH_BYPASS !== "0";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const host = normalizeHost(req.headers.get("host"));
  const isTestHost = isStagingHost(host);
  const testDefaultPath = "/portal/osobni-lodicky";
  const testAllowedPathPrefixes = ["/vysvedceni", "/portal/osobni-lodicky", "/ostrovy", "/admin"];

  if (isAuthBypassForcedOn() && !isBypassAllowedForHost(host)) {
    logSecurityEventOnce("warn", `bypass-attempt:${host}`, {
      event: "auth_bypass_attempt_non_local_host",
      message: "AUTH_BYPASS is enabled on non-local host. Bypass request denied.",
      host,
      pathname,
      details: {
        nodeEnv: process.env.NODE_ENV,
      },
    });
  }

  if (isUnsafeBypassConfigurationForHost(host)) {
    warnUnsafeBypassConfiguration(host);
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return Response.redirect(new URL("/auth/error?error=SecurityConfig", req.nextUrl.origin));
  }

  if (isAuthBypassEnabledForHost(host)) {
    return;
  }

  // Veřejné cesty – bez kontroly
  if (
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/kiosk") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/kiosk/") ||
    pathname === "/api/sync/users" ||
    pathname === "/api/internal/security-health"
  ) {
    return;
  }

  // Nepřihlášený uživatel → přihlášení
  if (!session?.user) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(signInUrl);
  }

  const roles = collectUserRoles(session);
  const normalizedEmail = (session.user.email ?? "").trim().toLowerCase();
  const stagingAllowedEmails = getStagingAllowedEmailsFromEnv();
  const allowByStagingEmail = normalizedEmail && stagingAllowedEmails.has(normalizedEmail);

  // Staging: přístup pouze pro tester/admin nebo explicitní e-mail whitelist.
  if (isTestHost && !hasRole(roles, ["tester", "admin"]) && !allowByStagingEmail) {
    logSecurityEvent("warn", {
      event: "staging_access_denied",
      message: "Staging access denied by tester gate.",
      host,
      pathname,
      email: normalizedEmail || undefined,
      roles,
    });
    return Response.redirect(new URL("/auth/error?error=NoEnvRole", req.nextUrl.origin));
  }

  // proto-app: přístup jen pro proto/admin
  if (host === "proto-app.svetoplavci.cz" && !hasRole(roles, ["proto", "admin"])) {
    return Response.redirect(new URL("/auth/error?error=NoEnvRole", req.nextUrl.origin));
  }

  // /admin/* – pouze role admin
  const requiredRoles = getRequiredRolesForPath(pathname);
  if (requiredRoles && !hasAnyRole(roles, requiredRoles)) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return Response.redirect(new URL("/", req.nextUrl.origin));
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
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
