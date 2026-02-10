import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { getUserByEmail } from "@/src/lib/auth-utils";
import { findParentByEmail } from "@/src/lib/coda";

/**
 * Edge-kompatibilní konfigurace NextAuth (bez Nodemailer/Node.js modulů).
 * Používá se v middleware. Plná konfigurace včetně Email provideru je v auth.ts.
 */
export const authConfig = {
  trustHost: true, // Potřebné pro dev i proxy; jinak ClientFetchError / UntrustedHost
  // Bez secret Auth.js vrací 500 a klient zobrazí „server configuration“. V produkci vždy nastav AUTH_SECRET/NEXTAUTH_SECRET.
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
    maxAge: 30 * 24 * 60 * 60, // 30 dní
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user?.email;
      if (!email) return false;

      // 1) Mock / interní tabulka (admin, učit el, žák…)
      const userRecord = await getUserByEmail(email);
      if (userRecord) {
        if (process.env.NODE_ENV === "development") {
          console.log("[auth] signIn: email", email, "→ userRecord (mock)", userRecord.role);
        }
        return true;
      }

      // 2) Coda tabulka Seznam osob – rodič (Role obsahuje „Rodič“, Aktivní, Kontaktní maily obsahuje email)
      const parent = await findParentByEmail(email);
      if (parent) {
        if (process.env.NODE_ENV === "development") {
          console.log("[auth] signIn: email", email, "→ parent (Coda)", parent.name);
        }
        return true;
      }

      if (process.env.NODE_ENV === "development") {
        console.log("[auth] signIn: email", email, "→ NoRole (není v mock ani Coda)");
      }
      return "/auth/signin?error=NoRole";
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const userRecord = await getUserByEmail(user.email);
        if (userRecord) {
          token.role = userRecord.role;
          token.jmeno = userRecord.jmeno;
          return token;
        }
        const parent = await findParentByEmail(user.email);
        if (parent) {
          token.role = "rodic";
          token.jmeno = parent.name;
        }
      }
      return token;
    },
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
      // Neplatný nebo chybějící url (např. po signOut) → úvodní stránka
      if (url == null || url === "" || url === "undefined") {
        return baseUrl + "/";
      }
      // Po magickém odkazu bývá callbackUrl = stránka přihlášení; po úspěchu má jít uživatel na úvod.
      // Při odhlášení kvůli nečinnosti necháme přesměrovat na přihlášení s reason=inactivity.
      try {
        const target = new URL(url, baseUrl);
        if (target.pathname === "/auth/signin" || url.startsWith(baseUrl + "/auth/signin")) {
          if (target.searchParams.get("reason") === "inactivity") {
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
