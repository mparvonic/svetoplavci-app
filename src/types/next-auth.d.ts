import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      role: "admin" | "ucitel" | "rodic" | "zak";
      jmeno?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "ucitel" | "rodic" | "zak";
    jmeno?: string;
  }
}
