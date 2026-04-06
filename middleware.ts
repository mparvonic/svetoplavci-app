import NextAuth from "next-auth";
import { authConfig } from "@/src/lib/auth.config";

const { auth } = NextAuth(authConfig);
const isProtoRuntime = process.env.APP_RUNTIME_MODE === "proto";

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

function isAllowedProtoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith("@svetoplavci.cz") || normalized === "miroslav.parvonic@gmail.com";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const userEmail = session?.user?.email?.toLowerCase();

  // V proto runtime směrovat root na /prototype
  if (isProtoRuntime && pathname === "/") {
    return Response.redirect(new URL("/prototype", req.nextUrl.origin));
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
  if (host === "test-app.svetoplavci.cz" && !hasRole(roles, ["tester", "admin"])) {
    return Response.redirect(new URL("/auth/error?error=NoEnvRole", req.nextUrl.origin));
  }

  // proto-app: přístup jen pro povolené e-maily
  if (host === "proto-app.svetoplavci.cz" && !isAllowedProtoEmail(userEmail)) {
    return Response.redirect(new URL("/auth/error?error=ProtoEmailDenied", req.nextUrl.origin));
  }

  // /admin/* – pouze role admin
  if (pathname.startsWith("/admin")) {
    if (!hasRole(roles, ["admin"])) {
      return Response.redirect(new URL("/", req.nextUrl.origin));
    }
  }

  // V proto runtime povolit jen prototypové stránky
  if (isProtoRuntime) {
    const allowedProtoPaths = ["/ui-redesign", "/prototype", "/proto-shell"];
    if (!allowedProtoPaths.some((basePath) => pathname.startsWith(basePath))) {
      return Response.redirect(new URL("/prototype", req.nextUrl.origin));
    }
  }

  // /kiosk/* a /portal/* – přístup pro všechny přihlášené (už ověřeno výše)
});

export const config = {
  matcher: [
    /*
     * Match all paths kromě api, _next/static, _next/image, favicon, veřejných assetů.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
