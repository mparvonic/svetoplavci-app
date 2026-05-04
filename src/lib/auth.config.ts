import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { getPostLoginDefaultPath } from "@/src/lib/post-login-path";

const resolvedAuthSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === "development" ? "dev-secret-pro-localhost-zmen-v-produkci" : undefined);

/**
 * Edge-kompatibilní konfigurace NextAuth (bez Nodemailer/Node.js modulů).
 * Používá se v middleware. signIn + jwt callbacky (s DB lookup) jsou v auth.ts.
 */
export const authConfig = {
  trustHost: true,
  secret: resolvedAuthSecret,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        const role = token.role ?? "zak";
        session.user.role = role as
          | "admin"
          | "zamestnanec"
          | "ucitel"
          | "pruvodce"
          | "garant"
          | "patron"
          | "druzinar"
          | "editor_hodnoceni"
          | "schvalovatel_hodnoceni"
          | "rodic"
          | "zak"
          | "tester"
          | "proto";
        session.user.roles = Array.isArray(token.roles)
          ? (token.roles as Array<
              | "admin"
              | "zamestnanec"
              | "ucitel"
              | "pruvodce"
              | "garant"
              | "patron"
              | "druzinar"
              | "editor_hodnoceni"
              | "schvalovatel_hodnoceni"
              | "rodic"
              | "zak"
              | "tester"
              | "proto"
            >)
          : [session.user.role];
        session.user.jmeno =
          (typeof token.jmeno === "string" ? token.jmeno : undefined) ??
          session.user.name ??
          undefined;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      const defaultPostLoginPath = getPostLoginDefaultPath();
      if (url == null || url === "" || url === "undefined") {
        return baseUrl + defaultPostLoginPath;
      }
      try {
        const target = new URL(url, baseUrl);
        if (target.pathname === "/auth/signin" || url.startsWith(baseUrl + "/auth/signin")) {
          const reason = target.searchParams.get("reason");
          const error = target.searchParams.get("error");
          if (reason === "inactivity" || error === "NoRole") {
            return target.origin + target.pathname + target.search;
          }
          return baseUrl + defaultPostLoginPath;
        }
        return target.origin + target.pathname + target.search;
      } catch {
        return baseUrl + defaultPostLoginPath;
      }
    },
  },
} satisfies NextAuthConfig;
