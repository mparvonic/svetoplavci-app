export type UserRole = "admin" | "ucitel" | "rodic" | "zak";

export interface UserRecord {
  email: string;
  role: UserRole;
  jmeno: string;
}

/**
 * Rezerva pro případné budoucí napojení na samostatnou tabulku uživatelů.
 * Aktuálně vždy vrací null – všechny role se odvozují z Coda (Seznam osob).
 */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  void email;
  return null;
}
