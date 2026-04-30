import type { DefaultSession } from "next-auth";

type UserRole =
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

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      role: UserRole;
      roles: UserRole[];
      jmeno?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    roles?: UserRole[];
    jmeno?: string;
  }
}
