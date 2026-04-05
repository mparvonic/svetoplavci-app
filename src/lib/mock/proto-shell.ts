export type ProtoRoleId =
  | "rodic"
  | "dite"
  | "pruvodce"
  | "spravce_aplikace"
  | "spravce_site";

export type ProtoNavItem = {
  id: string;
  label: string;
};

export type ProtoDashboardMetric = {
  id: string;
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
};

export type ProtoRoleDashboard = {
  id: ProtoRoleId;
  label: string;
  description: string;
  nav: ProtoNavItem[];
  metrics: ProtoDashboardMetric[];
};

export type ProtoLodickaRow = {
  id: string;
  zak: string;
  rocnik: string;
  predmet: string;
  oblast: string;
  lodicka: string;
  stav: 0 | 1 | 2 | 3 | 4;
  garant: string;
  updatedAt: string;
};

export type ProtoAkceRow = {
  id: string;
  nazev: string;
  plavba: string;
  datum: string;
  cas: string;
  misto: string;
  kapacita: number;
  zapsano: number;
  otevreno: boolean;
};

export type ProtoLodickaHistoryEvent = {
  id: string;
  lodickaId: string;
  datumStavu: string;
  zapsanoAt: string;
  stav: 0 | 1 | 2 | 3 | 4;
  zapsal: string;
  poznamka?: string;
};

export const PROTO_ROLES: ProtoRoleDashboard[] = [
  {
    id: "rodic",
    label: "Rodič",
    description: "Přehled dítěte, lodičky, akce a komunikace.",
    nav: [
      { id: "dashboard", label: "Přehled" },
      { id: "lodicky", label: "Lodičky" },
      { id: "akce", label: "Akce" },
      { id: "portfolio", label: "Portfolio" },
    ],
    metrics: [
      { id: "deti", label: "Děti v účtu", value: "2", trend: "flat" },
      { id: "lodicky", label: "Aktivní lodičky", value: "184", trend: "up" },
      { id: "akce", label: "Akce tento týden", value: "4", trend: "flat" },
    ],
  },
  {
    id: "dite",
    label: "Dítě",
    description: "Osobní lodičky, zápisy na ostrovy a portfolio.",
    nav: [
      { id: "dashboard", label: "Moje paluba" },
      { id: "lodicky", label: "Moje lodičky" },
      { id: "akce", label: "Ostrovy" },
      { id: "portfolio", label: "Portfolio" },
    ],
    metrics: [
      { id: "body", label: "Body v plavbě", value: "62", trend: "up" },
      { id: "hotovo", label: "Lodičky samostatně", value: "28", trend: "up" },
      { id: "zapisy", label: "Zápisy tento měsíc", value: "3", trend: "flat" },
    ],
  },
  {
    id: "pruvodce",
    label: "Průvodce",
    description: "Správa lodiček, akcí, hodnocení a skupin.",
    nav: [
      { id: "dashboard", label: "Přehled průvodce" },
      { id: "lodicky", label: "Lodičky" },
      { id: "akce", label: "Akce / Ostrovy" },
      { id: "tridy", label: "Smečky a posádky" },
    ],
    metrics: [
      { id: "cekaji", label: "Čeká na hodnocení", value: "17", trend: "down" },
      { id: "zmeny", label: "Změny dnes", value: "43", trend: "up" },
      { id: "triangly", label: "Triangly do 14 dnů", value: "6", trend: "flat" },
    ],
  },
  {
    id: "spravce_aplikace",
    label: "Správce aplikace",
    description: "Konfigurace školního roku, rolí a modulů.",
    nav: [
      { id: "dashboard", label: "Provoz" },
      { id: "uzivatele", label: "Uživatelé" },
      { id: "skolni_rok", label: "Školní rok" },
      { id: "integrace", label: "Integrace" },
    ],
    metrics: [
      { id: "sync", label: "Poslední sync", value: "06:25", trend: "flat" },
      { id: "chyby", label: "Chyby synchronizace", value: "0", trend: "down" },
      { id: "fronta", label: "Fronta úloh", value: "3", trend: "flat" },
    ],
  },
  {
    id: "spravce_site",
    label: "Správce sítě",
    description: "Přehled zařízení, síťových pravidel a vazeb na půjčovnu.",
    nav: [
      { id: "dashboard", label: "Síťový přehled" },
      { id: "zarizeni", label: "Zařízení" },
      { id: "pujcovna", label: "Půjčovna" },
      { id: "pravidla", label: "Pravidla přístupu" },
    ],
    metrics: [
      { id: "online", label: "Online zařízení", value: "61", trend: "up" },
      { id: "blok", label: "Blokovaná zařízení", value: "4", trend: "flat" },
      { id: "incident", label: "Incidenty dnes", value: "0", trend: "down" },
    ],
  },
];

export const PROTO_LODICKY_ROWS: ProtoLodickaRow[] = [
  {
    id: "lod-1",
    zak: "Kryštof Parvonič",
    rocnik: "4. ročník",
    predmet: "Samostatná plavba / ČJ",
    oblast: "Čtení a porozumění",
    lodicka: "Práce s delším textem",
    stav: 3,
    garant: "Káča",
    updatedAt: "2026-04-02",
  },
  {
    id: "lod-2",
    zak: "Kryštof Parvonič",
    rocnik: "4. ročník",
    predmet: "Ponorka",
    oblast: "Můj domov",
    lodicka: "Představení ČR",
    stav: 3,
    garant: "Míra",
    updatedAt: "2026-03-30",
  },
  {
    id: "lod-3",
    zak: "Viktorie Parvonič",
    rocnik: "7. ročník",
    predmet: "Samostatná plavba / MA",
    oblast: "Algebra",
    lodicka: "Lineární rovnice",
    stav: 2,
    garant: "Tom",
    updatedAt: "2026-04-01",
  },
  {
    id: "lod-4",
    zak: "Viktorie Parvonič",
    rocnik: "7. ročník",
    predmet: "English Day / AJ",
    oblast: "Writing",
    lodicka: "Short argumentative text",
    stav: 4,
    garant: "Anet",
    updatedAt: "2026-03-27",
  },
];

export const LODICKA_STAV_LABEL: Record<ProtoLodickaRow["stav"], string> = {
  0: "Nezahájeno",
  1: "Rozpracováno",
  2: "S dopomocí",
  3: "Částečně",
  4: "Samostatně",
};

export const PROTO_AKCE_ROWS: ProtoAkceRow[] = [
  {
    id: "akce-1",
    nazev: "Ostrov: Robotika",
    plavba: "4. plavba",
    datum: "2026-04-09",
    cas: "10:00-11:30",
    misto: "Lab 2",
    kapacita: 12,
    zapsano: 10,
    otevreno: true,
  },
  {
    id: "akce-2",
    nazev: "Expedice: Brněnská přehrada",
    plavba: "4. plavba",
    datum: "2026-04-10",
    cas: "08:00-14:00",
    misto: "Brno",
    kapacita: 36,
    zapsano: 36,
    otevreno: false,
  },
  {
    id: "akce-3",
    nazev: "Slavnost: Jarní dílny",
    plavba: "4. plavba",
    datum: "2026-04-16",
    cas: "09:00-12:00",
    misto: "Atrium",
    kapacita: 80,
    zapsano: 42,
    otevreno: true,
  },
];

export const PROTO_LODICKA_HISTORY: ProtoLodickaHistoryEvent[] = [
  {
    id: "hist-1",
    lodickaId: "lod-1",
    datumStavu: "2025-09-10",
    zapsanoAt: "2025-09-10 14:11",
    stav: 1,
    zapsal: "Káča",
  },
  {
    id: "hist-2",
    lodickaId: "lod-1",
    datumStavu: "2025-11-22",
    zapsanoAt: "2025-11-23 08:16",
    stav: 2,
    zapsal: "Káča",
  },
  {
    id: "hist-3",
    lodickaId: "lod-1",
    datumStavu: "2026-04-02",
    zapsanoAt: "2026-04-02 12:41",
    stav: 3,
    zapsal: "Káča",
    poznamka: "Stabilní pokrok, příště navazující úkol bez dopomoci.",
  },
  {
    id: "hist-4",
    lodickaId: "lod-2",
    datumStavu: "2025-10-01",
    zapsanoAt: "2025-10-01 13:05",
    stav: 1,
    zapsal: "Míra",
  },
  {
    id: "hist-5",
    lodickaId: "lod-2",
    datumStavu: "2026-01-18",
    zapsanoAt: "2026-01-19 08:58",
    stav: 2,
    zapsal: "Míra",
  },
  {
    id: "hist-6",
    lodickaId: "lod-2",
    datumStavu: "2026-03-30",
    zapsanoAt: "2026-03-30 10:20",
    stav: 3,
    zapsal: "Míra",
  },
  {
    id: "hist-7",
    lodickaId: "lod-3",
    datumStavu: "2025-09-20",
    zapsanoAt: "2025-09-20 11:02",
    stav: 1,
    zapsal: "Tom",
  },
  {
    id: "hist-8",
    lodickaId: "lod-3",
    datumStavu: "2026-02-03",
    zapsanoAt: "2026-02-03 17:45",
    stav: 2,
    zapsal: "Tom",
  },
  {
    id: "hist-9",
    lodickaId: "lod-4",
    datumStavu: "2025-10-17",
    zapsanoAt: "2025-10-17 09:50",
    stav: 2,
    zapsal: "Anet",
  },
  {
    id: "hist-10",
    lodickaId: "lod-4",
    datumStavu: "2026-01-31",
    zapsanoAt: "2026-01-31 15:22",
    stav: 3,
    zapsal: "Anet",
  },
  {
    id: "hist-11",
    lodickaId: "lod-4",
    datumStavu: "2026-03-27",
    zapsanoAt: "2026-03-27 16:03",
    stav: 4,
    zapsal: "Anet",
    poznamka: "Samostatně a konzistentně.",
  },
];
