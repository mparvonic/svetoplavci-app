export const DESIGN_PACK_META = {
  name: "Svetoplavci Design Pack",
  version: "2026-04-05.3",
  updatedAt: "2026-04-05",
};

export const DESIGN_RULES = [
  "Navigace vlevo, obsah vpravo, vždy jasně aktivní sekce.",
  "Primární CTA je modré, destruktivní akce červené, sekundární akce outline.",
  "Každý datový modul má stejnou strukturu: název, filtry, obsah, akce.",
  "Stavy komponent sjednoceně: načítání, prázdno, chyba, read-only.",
  "Tabulky mají fixní hlavičku a jednoznačné řádkové akce.",
  "Formuláře jsou dělené do kroků nebo logických bloků; validace přímo u pole.",
  "Role uživatele určují viditelnost sekcí, ne vizuální chaos.",
  "Všechny datumy/časy v UI prezentovat lokálně v CET/CEST.",
] as const;

export const DESIGN_COLORS = [
  { name: "Navy 900", hex: "#05204A", usage: "hlavní nadpisy, důraz" },
  { name: "Blue 700", hex: "#0A4DA6", usage: "primární tlačítko, odkazy" },
  { name: "Blue 950", hex: "#002060", usage: "brand CTA" },
  { name: "Red 600", hex: "#DA0100", usage: "destruktivní akce, alert" },
  { name: "Amber 400", hex: "#F6B94C", usage: "upozornění, akcent" },
  { name: "Mint 600", hex: "#059669", usage: "úspěch, potvrzení" },
  { name: "Slate 100", hex: "#F1F5F9", usage: "podklad sekcí" },
  { name: "Blue Gray 200", hex: "#D9E4F2", usage: "border, děliče" },
] as const;

export const UI_CLASSES = {
  pageContainer: "max-w-screen-xl mx-auto px-4",
  sectionTitle: "text-[#002060] font-semibold",
  primaryButton: "bg-[#002060] text-white hover:bg-[#001540]",
  secondaryButton:
    "border border-[#002060] bg-white text-[#002060] hover:bg-[#F2F7FF]",
  dangerButton:
    "border border-[#DA0100] bg-white text-[#DA0100] hover:bg-[#FFF1F1]",
  tableShell: "overflow-hidden rounded-[20px] border border-[#D9E4F2] bg-white",
  tableHead:
    "bg-[#F2F7FF] text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500",
  tableRow: "border-t border-[#EDF2F8] text-sm",
} as const;

export type SmeckaTheme = {
  key: string;
  label: string;
  accent: string;
  accentSoft: string;
  textOnAccent: string;
  border: string;
};

const SMECKA_PRESETS: Record<string, SmeckaTheme> = {
  krakeni: {
    key: "krakeni",
    label: "Krakeni",
    accent: "#0A4DA6",
    accentSoft: "#EAF2FF",
    textOnAccent: "#FFFFFF",
    border: "#CFE0F7",
  },
  indiani: {
    key: "indiani",
    label: "Indiáni",
    accent: "#0E7490",
    accentSoft: "#E6F8FC",
    textOnAccent: "#FFFFFF",
    border: "#BEEAF3",
  },
  pavouci: {
    key: "pavouci",
    label: "Pavouci",
    accent: "#7C3AED",
    accentSoft: "#F1EAFF",
    textOnAccent: "#FFFFFF",
    border: "#DDD0FF",
  },
  lisky: {
    key: "lisky",
    label: "Lišky",
    accent: "#C2410C",
    accentSoft: "#FFF0E9",
    textOnAccent: "#FFFFFF",
    border: "#FFD9C9",
  },
  hoste: {
    key: "hoste",
    label: "Hosté",
    accent: "#475569",
    accentSoft: "#EEF2F7",
    textOnAccent: "#FFFFFF",
    border: "#D7DEE9",
  },
};

const FALLBACK_THEMES: SmeckaTheme[] = [
  {
    key: "fallback-1",
    label: "Fallback 1",
    accent: "#0A4DA6",
    accentSoft: "#EAF2FF",
    textOnAccent: "#FFFFFF",
    border: "#CFE0F7",
  },
  {
    key: "fallback-2",
    label: "Fallback 2",
    accent: "#0E7490",
    accentSoft: "#E6F8FC",
    textOnAccent: "#FFFFFF",
    border: "#BEEAF3",
  },
  {
    key: "fallback-3",
    label: "Fallback 3",
    accent: "#B45309",
    accentSoft: "#FFF5E6",
    textOnAccent: "#FFFFFF",
    border: "#F7DEB7",
  },
  {
    key: "fallback-4",
    label: "Fallback 4",
    accent: "#7C3AED",
    accentSoft: "#F1EAFF",
    textOnAccent: "#FFFFFF",
    border: "#DDD0FF",
  },
];

function normalizeKey(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hash(input: string): number {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) >>> 0;
  }
  return value;
}

export function getSmeckaTheme(name: string): SmeckaTheme {
  const normalized = normalizeKey(name);
  const preset = SMECKA_PRESETS[normalized];
  if (preset) return preset;

  const fallback = FALLBACK_THEMES[hash(normalized) % FALLBACK_THEMES.length];
  return {
    ...fallback,
    key: normalized || fallback.key,
    label: name || fallback.label,
  };
}

export const SMECKA_THEME_PRESETS = Object.values(SMECKA_PRESETS);
