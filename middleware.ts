import NextAuth from "next-auth";
import { authConfig } from "@/src/lib/auth.config";

const { auth } = NextAuth(authConfig);
const isProtoRuntime = process.env.APP_RUNTIME_MODE === "proto";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Proto režim: veřejný mock/prototyp bez auth a bez backendových závislostí.
  if (isProtoRuntime) {
    if (pathname === "/") {
      return Response.redirect(new URL("/ui-redesign", req.nextUrl.origin));
    }
    if (pathname.startsWith("/ui-redesign")) {
      return;
    }
    return Response.redirect(new URL("/ui-redesign", req.nextUrl.origin));
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

  // /admin/* – pouze role admin
  if (pathname.startsWith("/admin")) {
    if (session.user.role !== "admin") {
      return Response.redirect(new URL("/", req.nextUrl.origin));
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
