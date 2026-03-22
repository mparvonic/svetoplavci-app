import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-kompatibilní konfigurace NextAuth (bez Nodemailer/Node.js modulů).
 * Používá se v middleware. signIn + jwt callbacky (s DB lookup) jsou v auth.ts.
 */
export const authConfig = {
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "development"
      ? "dev-secret-pro-localhost-zmen-v-produkci"
      : undefined),
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
        session.user.role = role as "admin" | "ucitel" | "rodic" | "zak";
        session.user.jmeno =
          (typeof token.jmeno === "string" ? token.jmeno : undefined) ??
          session.user.name ??
          undefined;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url == null || url === "" || url === "undefined") {
        return baseUrl + "/";
      }
      try {
        const target = new URL(url, baseUrl);
        if (target.pathname === "/auth/signin" || url.startsWith(baseUrl + "/auth/signin")) {
          const reason = target.searchParams.get("reason");
          const error = target.searchParams.get("error");
          if (reason === "inactivity" || error === "NoRole") {
            return target.origin + target.pathname + target.search;
          }
          return baseUrl + "/";
        }
        return target.origin + target.pathname + target.search;
      } catch {
        return baseUrl + "/";
      }
    },
  },
} satisfies NextAuthConfig;
