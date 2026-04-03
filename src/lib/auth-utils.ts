import { getApprovedLoginProfileByEmail } from "@/src/lib/user-directory";

export type UserRole =
  | "admin"
  | "zamestnanec"
  | "ucitel"
  | "rodic"
  | "zak"
  | "tester"
  | "proto";

export interface UserRecord {
  email: string;
  role: UserRole;
  roles: UserRole[];
  jmeno: string;
}

/**
 * Načte uživatele z interního user directory modelu.
 * Přístup je povolen jen pokud je e-mail navázaný na osobu přes approved link.
 */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const profile = await getApprovedLoginProfileByEmail(email);
  if (!profile) return null;
  return {
    email: profile.email,
    role: profile.primaryRole,
    roles: profile.roles,
    jmeno: profile.jmeno ?? profile.email,
  };
}
