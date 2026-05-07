import {
  AlertTriangle,
  CalendarRange,
  KeyRound,
  Link2,
  RefreshCcw,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AdminSectionId =
  | "uzivatele"
  | "vazby"
  | "pristupy"
  | "synchronizace"
  | "kontrola-dat"
  | "skolni-roky";

export type AdminSection = {
  id: AdminSectionId;
  href: string;
  label: string;
  shortLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  icon: LucideIcon;
  mvpItems: string[];
  futureRole: string;
};

export const adminSections: AdminSection[] = [
  {
    id: "uzivatele",
    href: "/admin/uzivatele",
    label: "Uživatelé",
    shortLabel: "Uživatelé",
    eyebrow: "Osoby",
    title: "Správa uživatelů",
    description: "Person-centric správa dětí, rodičů, zaměstnanců a průvodců.",
    status: "Připraveno pro read-only seznam a detail osoby",
    icon: UsersRound,
    mvpItems: [
      "seznam osob s vyhledáváním",
      "filtry podle role, stavu a zdroje dat",
      "detail osoby s rolemi, vazbami a login identitami",
    ],
    futureRole: "spravce_uzivatelu",
  },
  {
    id: "vazby",
    href: "/admin/vazby",
    label: "Vazby rodič-dítě",
    shortLabel: "Vazby",
    eyebrow: "Rodina",
    title: "Vazby rodič-dítě",
    description:
      "Specializovaný workflow pro dohledání, přidání a deaktivaci rodinných vazeb.",
    status: "Připraven read-only přehled vazeb a kontrolních seznamů",
    icon: Link2,
    mvpItems: [
      "vyhledání rodiče a jeho dětí",
      "vyhledání dítěte a jeho rodičů",
      "deaktivace a přidání vazby s důvodem změny",
    ],
    futureRole: "spravce_uzivatelu",
  },
  {
    id: "pristupy",
    href: "/admin/pristupy",
    label: "Přístupy a login",
    shortLabel: "Přístupy",
    eyebrow: "Login",
    title: "Přístupy a oprávnění",
    description:
      "Správa login e-mailů, identit, schválení přístupu a aplikačních rolí.",
    status: "Připraveno pro napojení existujících login konfliktů",
    icon: KeyRound,
    mvpItems: [
      "seznam login identit",
      "schválené a konfliktní vazby identita-osoba",
      "přehled kdo se může přihlásit a proč",
    ],
    futureRole: "spravce_pristupu",
  },
  {
    id: "synchronizace",
    href: "/admin/synchronizace",
    label: "Synchronizace",
    shortLabel: "Sync",
    eyebrow: "Importy",
    title: "Synchronizace a importy",
    description:
      "Edookit sync dětí a zaměstnanců, CSV import rodičů a historie běhů.",
    status: "Připraven read-only přehled běhů a kontrolních signálů",
    icon: RefreshCcw,
    mvpItems: [
      "historie běhů synchronizace/importu",
      "preview změn před spuštěním",
      "kontrolní report po každém běhu",
    ],
    futureRole: "spravce_synchronizace",
  },
  {
    id: "kontrola-dat",
    href: "/admin/kontrola-dat",
    label: "Kontrola dat",
    shortLabel: "Kontrola",
    eyebrow: "Kvalita dat",
    title: "Kontrolní fronta",
    description:
      "Admin inbox pro problémy, které sync/import nedokáže bezpečně vyřešit automaticky.",
    status: "Připraven read-only přehled odvozených problémů",
    icon: AlertTriangle,
    mvpItems: [
      "dítě bez smečky nebo studijní skupiny",
      "dítě bez rodiče nebo rodič bez dítěte",
      "konfliktní e-maily a porušení pravidel členství",
    ],
    futureRole: "spravce_synchronizace",
  },
  {
    id: "skolni-roky",
    href: "/admin/skolni-roky",
    label: "Školní roky",
    shortLabel: "Školní rok",
    eyebrow: "Skupiny",
    title: "Školní roky, smečky a skupiny",
    description:
      "Nastavení školního roku, smeček, studijních skupin a členství dětí i průvodců.",
    status: "Připraven read-only přehled školního roku, skupin a členství",
    icon: CalendarRange,
    mvpItems: [
      "seznam a aktivní školní rok",
      "smečky a studijní skupiny",
      "členství dětí a přiřazení průvodců",
    ],
    futureRole: "spravce_skolniho_roku",
  },
];

export function getAdminSection(id: AdminSectionId): AdminSection {
  const section = adminSections.find((item) => item.id === id);
  if (!section) {
    throw new Error(`Unknown admin section: ${id}`);
  }
  return section;
}
