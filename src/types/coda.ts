export interface CodaParent {
  rowId: string;
  name: string;
  email: string;
  contactEmails: string[];
  roles: string[];
  childrenIds: { rowId: string; name: string }[];
}

export interface CodaChild {
  rowId: string;
  name: string;
  nickname: string;
  /** Ročník ze sloupce "Ročník" v Seznam osob (např. "1. ročník", "2. ročník") – pro výběr view tabulky. */
  rocnik: string;
  currentYear: string;
  group: string; // Smečka
}

export type TableId =
  | "table-RuXGEEn2z4"   // Lodičky dítěte
  | "table-1wVyfFAjX2"   // Lodičky po plavbách
  | "table-oCLreazO22"   // Hodnocení předmětů
  | "table-NbDPhMF4ci";  // Hodnocení oblastí

export const TABLE_IDS: Record<string, TableId> = {
  lodicky: "table-RuXGEEn2z4",
  lodickyPoPlavbach: "table-1wVyfFAjX2",
  hodnoceniPredmetu: "table-oCLreazO22",
  hodnoceniOblasti: "table-NbDPhMF4ci",
} as const;
