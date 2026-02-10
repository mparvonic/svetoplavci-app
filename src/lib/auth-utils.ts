/**
 * Helper pro zjištění role uživatele podle emailu.
 * Zatím používá mock data reprezentující Coda tabulku "Uzivatele".
 *
 * Později nahradit voláním Coda API – tabulka "Uzivatele", sloupce: Email, Role, Jmeno.
 * Např. pomocí getTableRows() z @/src/lib/coda a filtrování řádků podle Email.
 */

export type UserRole = "admin" | "ucitel" | "rodic" | "zak";

export interface UserRecord {
  email: string;
  role: UserRole;
  jmeno: string;
}

/** Mock data – reprezentace Coda tabulky "Uzivatele" */
const MOCK_UZIVATELE: UserRecord[] = [
  { email: "admin@skola.cz", role: "admin", jmeno: "Admin Školy" },
  { email: "ucitel@skola.cz", role: "ucitel", jmeno: "Jan Učitel" },
  { email: "rodic@example.cz", role: "rodic", jmeno: "Marie Nováková" },
  { email: "zak@skola.cz", role: "zak", jmeno: "Petr Žák" },
];

/**
 * Vrátí záznam uživatele podle emailu, nebo null pokud není v tabulce.
 * TODO: Napojit na Coda API – doc ID a tabulka "Uzivatele", sloupce Email, Role, Jmeno.
 */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;

  // Mock: hledání v lokálním poli
  const found = MOCK_UZIVATELE.find((u) => u.email.toLowerCase() === normalized);
  return found ?? null;
}
