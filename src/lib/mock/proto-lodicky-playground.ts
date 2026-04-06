export type ProtoRoleId = "garant" | "rodic" | "zak" | "spravce";

export type LodickaStav = 0 | 1 | 2 | 3 | 4;

export type ProtoRoleOption = {
  id: ProtoRoleId;
  label: string;
};

export type ProtoActor = {
  id: string;
  jmeno: string;
  email: string;
  roles: ProtoRoleId[];
  linkedStudentId?: string;
};

export type ProtoStudent = {
  id: string;
  jmeno: string;
  prezdivka: string;
  stupen: 1 | 2;
  rocnik: number;
  smecka: string;
};

export type ProtoParentChildLink = {
  parentId: string;
  studentId: string;
};

export type ProtoLodickaCatalogItem = {
  id: string;
  kod: string;
  nazev: string;
  popis: string;
  predmet: string;
  podpředmět?: string;
  oblast: string;
  stupen: 1 | 2;
  odRocniku: number;
  doRocniku: number;
  garantId: string;
  typ: "individualni" | "hromadna";
};

export type ProtoOsobniLodicka = {
  id: string;
  studentId: string;
  lodickaId: string;
};

export type ProtoOsobniLodickaEvent = {
  id: string;
  osobniLodickaId: string;
  datumStavu: string;
  zapsanoAt: string;
  stav: LodickaStav;
  zapsalId: string;
  poznamka?: string;
};

export const LODICKA_STAV_LABEL: Record<LodickaStav, string> = {
  0: "Nezahájeno",
  1: "Rozpracováno",
  2: "S dopomocí",
  3: "Částečně",
  4: "Samostatně",
};

export const PROTO_ROLE_OPTIONS: ProtoRoleOption[] = [
  { id: "garant", label: "Garant" },
  { id: "rodic", label: "Rodič" },
  { id: "zak", label: "Žák" },
  { id: "spravce", label: "Správce" },
];

const GARANTI: ProtoActor[] = [
  { id: "u-garant-kaca", jmeno: "Kateřina Parvonič", email: "katerina.parvonic@svetoplavci.cz", roles: ["garant"] },
  { id: "u-garant-tom", jmeno: "Tomáš Vrbka", email: "tomas.vrbka@svetoplavci.cz", roles: ["garant"] },
  { id: "u-garant-mira", jmeno: "Miroslav Kroupa", email: "miroslav.kroupa@svetoplavci.cz", roles: ["garant"] },
  { id: "u-garant-anet", jmeno: "Aneta Černá", email: "aneta.cerna@svetoplavci.cz", roles: ["garant"] },
  { id: "u-garant-lucie", jmeno: "Lucie Dvořáková", email: "lucie.dvorakova@svetoplavci.cz", roles: ["garant"] },
  { id: "u-garant-petr", jmeno: "Petr Novotný", email: "petr.novotny@svetoplavci.cz", roles: ["garant"] },
];

const RODICE: ProtoActor[] = [
  { id: "u-rodic-miroslav", jmeno: "Miroslav Parvonič", email: "miroslav.parvonic@gmail.com", roles: ["rodic", "spravce"] },
  { id: "u-rodic-anna", jmeno: "Anna Durková", email: "anna.durkova@svetoplavci.cz", roles: ["rodic"] },
  { id: "u-rodic-marie", jmeno: "Marie Mydlilová", email: "marie.mydlilova@svetoplavci.cz", roles: ["rodic"] },
  { id: "u-rodic-zuzana", jmeno: "Zuzana Elsterová", email: "zuzana.elsterova@svetoplavci.cz", roles: ["rodic"] },
  { id: "u-rodic-lenka", jmeno: "Lenka Brychtová", email: "lenka.brychtova@svetoplavci.cz", roles: ["rodic"] },
  { id: "u-rodic-michal", jmeno: "Michal Sicouret", email: "michal.sicouret@svetoplavci.cz", roles: ["rodic"] },
  { id: "u-rodic-klara", jmeno: "Klára Ventura", email: "klara.ventura@svetoplavci.cz", roles: ["rodic"] },
  { id: "u-rodic-jana", jmeno: "Jana Kotašková", email: "jana.kotaskova@svetoplavci.cz", roles: ["rodic"] },
];

const SPRAVCI: ProtoActor[] = [
  { id: "u-spravce-miroslav", jmeno: "Miroslav Parvonič (správce)", email: "miroslav.parvonic@gmail.com", roles: ["spravce"] },
  { id: "u-spravce-barbora", jmeno: "Barbora Nováková", email: "barbora.novakova@svetoplavci.cz", roles: ["spravce"] },
];

const SMECKY_STUPEN_1 = ["Krakeni", "Indiáni", "Pavouci", "Lišky"] as const;
const SMECKY_STUPEN_2 = ["Orli", "Vlci", "Delfíni", "Fénixové"] as const;

const FIRST_NAMES = [
  "Adina", "Albert", "Anežka", "Agáta", "Bohdan", "Cyril", "Denisa", "Eliška", "Filip", "Gabriela",
  "Hana", "Ilona", "Jakub", "Jeremiáš", "Klára", "Lada", "Mariana", "Nela", "Oskar", "Petra",
  "Radim", "Rozárka", "Šimon", "Tereza", "Viktorie", "Vendula", "Yasmínka", "Zora",
] as const;

const LAST_NAMES = [
  "Parvonič", "Durková", "Mydlil", "Elsterová", "Brychta", "Sicouret", "Ventura", "Kotaška", "Svobodová", "Dvořáková",
  "Hladký", "Hájek", "Pumrová", "Volmanová", "Novotný", "Králová", "Mareš", "Procházka", "Krejčí", "Černý",
] as const;

const CORE_STUDENTS: ProtoStudent[] = [
  { id: "s-krystof-parvonic", jmeno: "Kryštof Parvonič", prezdivka: "Kryštof P.", stupen: 1, rocnik: 4, smecka: "Krakeni" },
  { id: "s-viktorie-parvonic", jmeno: "Viktorie Parvonič", prezdivka: "Viktorie P.", stupen: 2, rocnik: 7, smecka: "Orli" },
  { id: "s-vendula-machova", jmeno: "Vendula Machová", prezdivka: "Vendula M.", stupen: 2, rocnik: 8, smecka: "Vlci" },
  { id: "s-jeremias-brychta", jmeno: "Jeremiáš Brychta", prezdivka: "Jeremiáš B.", stupen: 1, rocnik: 5, smecka: "Pavouci" },
  { id: "s-isa-sicouret", jmeno: "Isa Sicouret", prezdivka: "Isa S.", stupen: 1, rocnik: 3, smecka: "Indiáni" },
  { id: "s-theo-sicouret", jmeno: "Theo Sicouret", prezdivka: "Theo S.", stupen: 1, rocnik: 2, smecka: "Indiáni" },
  { id: "s-yasminka-ventura", jmeno: "Yasmínka Ventura", prezdivka: "Yasmínka V.", stupen: 1, rocnik: 2, smecka: "Lišky" },
  { id: "s-anezka-dvorakova", jmeno: "Anežka Dvořáková", prezdivka: "Anežka D.", stupen: 1, rocnik: 5, smecka: "Pavouci" },
];

function slug(input: string): string {
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

function buildStudents(total = 96): ProtoStudent[] {
  const students: ProtoStudent[] = [...CORE_STUDENTS];
  const usedNames = new Set(students.map((item) => item.jmeno));
  let index = 0;

  while (students.length < total) {
    const first = FIRST_NAMES[index % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    index += 1;
    if (usedNames.has(name)) continue;
    usedNames.add(name);

    const rocnik = (students.length % 9) + 1;
    const stupen = rocnik <= 5 ? 1 : 2;
    const smeckaList = stupen === 1 ? SMECKY_STUPEN_1 : SMECKY_STUPEN_2;
    const smecka = smeckaList[(students.length + rocnik) % smeckaList.length];

    students.push({
      id: `s-${slug(name)}-${students.length + 1}`,
      jmeno: name,
      prezdivka: `${first} ${last[0]}.`,
      stupen,
      rocnik,
      smecka,
    });
  }

  return students;
}

export const PROTO_STUDENTS: ProtoStudent[] = buildStudents(96);

const STUDENT_ACTORS: ProtoActor[] = PROTO_STUDENTS.map((student) => ({
  id: `u-zak-${student.id}`,
  jmeno: student.jmeno,
  email: `${slug(student.jmeno)}@svetoplavci.cz`,
  roles: ["zak"],
  linkedStudentId: student.id,
}));

export const PROTO_ACTORS: ProtoActor[] = [
  ...GARANTI,
  ...RODICE,
  ...SPRAVCI,
  ...STUDENT_ACTORS,
];

export function getActorsByRole(role: ProtoRoleId): ProtoActor[] {
  return PROTO_ACTORS.filter((actor) => actor.roles.includes(role));
}

const fallbackParentIds = RODICE.map((parent) => parent.id);

export const PROTO_PARENT_CHILD_LINKS: ProtoParentChildLink[] = PROTO_STUDENTS.map((student, index) => ({
  parentId: fallbackParentIds[index % fallbackParentIds.length],
  studentId: student.id,
}));

function upsertParentLink(parentId: string, studentName: string) {
  const student = PROTO_STUDENTS.find((item) => item.jmeno === studentName);
  if (!student) return;
  const exists = PROTO_PARENT_CHILD_LINKS.some(
    (link) => link.parentId === parentId && link.studentId === student.id,
  );
  if (!exists) {
    PROTO_PARENT_CHILD_LINKS.push({ parentId, studentId: student.id });
  }
}

upsertParentLink("u-rodic-miroslav", "Kryštof Parvonič");
upsertParentLink("u-rodic-miroslav", "Viktorie Parvonič");
upsertParentLink("u-rodic-lenka", "Jeremiáš Brychta");
upsertParentLink("u-rodic-michal", "Isa Sicouret");
upsertParentLink("u-rodic-michal", "Theo Sicouret");

const GARANT_IDS = GARANTI.map((actor) => actor.id);

type LodickaBlueprint = {
  predmet: string;
  podpředmět?: string;
  oblast: string;
  stupen: 1 | 2;
  odRocniku: number;
  doRocniku: number;
  titles: string[];
};

const LODICKA_BLUEPRINTS: LodickaBlueprint[] = [
  {
    predmet: "Samostatná plavba",
    podpředmět: "Čeština",
    oblast: "Čtení a porozumění",
    stupen: 1,
    odRocniku: 1,
    doRocniku: 5,
    titles: ["Práce s delším textem", "Hledání hlavní myšlenky", "Práce s argumentem", "Porovnání dvou textů", "Mluvené shrnutí textu"],
  },
  {
    predmet: "Samostatná plavba",
    podpředmět: "Matematika",
    oblast: "Čísla a operace",
    stupen: 1,
    odRocniku: 1,
    doRocniku: 5,
    titles: ["Násobení zpaměti", "Dělení se zbytkem", "Práce s jednotkami", "Řešení slovní úlohy", "Kontrola výsledku"],
  },
  {
    predmet: "Expedice",
    podpředmět: "Velké expedice",
    oblast: "Péče o sebe a druhé",
    stupen: 1,
    odRocniku: 2,
    doRocniku: 5,
    titles: ["Stres", "Domluva ve skupině", "Reflexe po expedici", "Plánování úkolu", "Bezpečnost v terénu"],
  },
  {
    predmet: "Ponorka",
    oblast: "Můj domov",
    stupen: 1,
    odRocniku: 3,
    doRocniku: 5,
    titles: ["Představení státu", "Oblasti státu", "Můj kraj", "Správa státu", "Mapa obce"],
  },
  {
    predmet: "English Day",
    podpředmět: "Angličtina",
    oblast: "Communication",
    stupen: 1,
    odRocniku: 1,
    doRocniku: 5,
    titles: ["Daily routines", "Short conversation", "Picture description", "Vocabulary in context", "Reading short story"],
  },
  {
    predmet: "Samostatná plavba",
    podpředmět: "Matematika",
    oblast: "Algebra",
    stupen: 2,
    odRocniku: 6,
    doRocniku: 9,
    titles: ["Lineární rovnice", "Výrazy a úpravy", "Procenta v praxi", "Funkce a graf", "Rovnice se závorkami"],
  },
  {
    predmet: "Samostatná plavba",
    podpředmět: "Čeština",
    oblast: "Psaní a argumentace",
    stupen: 2,
    odRocniku: 6,
    doRocniku: 9,
    titles: ["Argumentační odstavec", "Reakce na text", "Práce se zdrojem", "Struktura delšího textu", "Jazyková korektura"],
  },
  {
    predmet: "Samostatná plavba",
    podpředmět: "Španělština",
    oblast: "Komunikace",
    stupen: 2,
    odRocniku: 6,
    doRocniku: 9,
    titles: ["Dialog v situaci", "Porozumění krátké nahrávce", "Popis místa", "Tvorba krátkého textu", "Konverzační jistota"],
  },
  {
    predmet: "Badatelna",
    oblast: "Výzkum a prezentace",
    stupen: 2,
    odRocniku: 6,
    doRocniku: 9,
    titles: ["Formulace hypotézy", "Práce s daty", "Prezentace výsledků", "Závěr experimentu", "Reflexe postupu"],
  },
  {
    predmet: "Ostrovy a slavnosti",
    podpředmět: "Slavnosti",
    oblast: "Vlastní tvorba",
    stupen: 2,
    odRocniku: 6,
    doRocniku: 9,
    titles: ["Pohyb v hudbě", "Scénický výstup", "Skupinová režie", "Zpětná vazba spolužákům", "Samostatná role"],
  },
];

export const PROTO_LODICKY_CATALOG: ProtoLodickaCatalogItem[] = LODICKA_BLUEPRINTS.flatMap(
  (blueprint, blueprintIndex) =>
    blueprint.titles.map((nazev, titleIndex) => {
      const id = `l-${blueprintIndex + 1}-${titleIndex + 1}`;
      const predmetCode = slug(blueprint.predmet).slice(0, 3).toUpperCase();
      const podCode = blueprint.podpředmět ? slug(blueprint.podpředmět).slice(0, 2).toUpperCase() : "XX";
      return {
        id,
        kod: `2025-${predmetCode}-${podCode}-${blueprint.doRocniku}-${String(titleIndex + 1).padStart(3, "0")}`,
        nazev,
        popis: `${nazev} (${blueprint.predmet}${blueprint.podpředmět ? ` / ${blueprint.podpředmět}` : ""})`,
        predmet: blueprint.predmet,
        podpředmět: blueprint.podpředmět,
        oblast: blueprint.oblast,
        stupen: blueprint.stupen,
        odRocniku: blueprint.odRocniku,
        doRocniku: blueprint.doRocniku,
        garantId: GARANT_IDS[(blueprintIndex + titleIndex) % GARANT_IDS.length],
        typ: (blueprintIndex + titleIndex) % 3 === 0 ? "hromadna" : "individualni",
      };
    }),
);

export const PROTO_OSOBNI_LODICKY: ProtoOsobniLodicka[] = PROTO_STUDENTS.flatMap((student) =>
  PROTO_LODICKY_CATALOG.filter((lodicka) => lodicka.stupen === student.stupen).map((lodicka) => ({
    id: `${student.id}__${lodicka.id}`,
    studentId: student.id,
    lodickaId: lodicka.id,
  })),
);

const EVENT_DATES = [
  "2025-09-01",
  "2025-10-07",
  "2025-11-14",
  "2026-01-21",
  "2026-03-03",
  "2026-04-02",
] as const;

function clampStatus(input: number): LodickaStav {
  return Math.max(0, Math.min(4, input)) as LodickaStav;
}

export const PROTO_OSOBNI_LODICKA_EVENTS: ProtoOsobniLodickaEvent[] = PROTO_OSOBNI_LODICKY.flatMap(
  (item) => {
    const student = PROTO_STUDENTS.find((s) => s.id === item.studentId);
    const lodicka = PROTO_LODICKY_CATALOG.find((l) => l.id === item.lodickaId);
    if (!student || !lodicka) return [];

    const seed = hash(item.id);
    const baseTarget = clampStatus(((student.rocnik + lodicka.odRocniku + (seed % 5)) % 5) as LodickaStav);
    const steps = 2 + (seed % 4); // 2..5

    const events: ProtoOsobniLodickaEvent[] = [];
    let currentStatus: LodickaStav = 0;

    for (let step = 0; step < steps; step += 1) {
      const date = EVENT_DATES[step];
      if (!date) continue;

      if (step > 0) {
        const diff = baseTarget - currentStatus;
        if (diff > 0) {
          currentStatus = clampStatus(currentStatus + ((seed + step) % 2 === 0 ? 1 : 0));
          if (currentStatus > baseTarget) currentStatus = baseTarget;
        }
      }

      const hour = String(8 + ((seed + step * 7) % 9)).padStart(2, "0");
      const minute = String((seed + step * 13) % 60).padStart(2, "0");
      const zapisujici = step === 0 ? "u-spravce-barbora" : lodicka.garantId;

      events.push({
        id: `evt-${item.id}-${step + 1}`,
        osobniLodickaId: item.id,
        datumStavu: date,
        zapsanoAt: `${date} ${hour}:${minute}`,
        stav: currentStatus,
        zapsalId: zapisujici,
        poznamka:
          step > 0 && step === steps - 1 && currentStatus >= 3
            ? "Stabilní pokrok, navazuje na předchozí plavbu."
            : undefined,
      });
    }

    return events;
  },
);

export const PROTO_QUICK_NAV = [
  { id: "nav-dashboard", label: "Proto shell", href: "/proto-shell" },
  { id: "nav-lodicky", label: "Osobní lodičky", href: "/proto-shell/osobni-lodicky" },
  { id: "nav-users", label: "Správa uživatelů", href: "/proto-shell/sprava-uzivatelu" },
  { id: "nav-ui", label: "UI redesign", href: "/ui-redesign" },
] as const;

export function getTodayIsoForProto(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getActiveSemesterBounds(todayIso: string) {
  return {
    minDate: "2026-02-01",
    maxDate: todayIso,
  };
}

export function getActorLabel(actorId: string): string {
  return PROTO_ACTORS.find((actor) => actor.id === actorId)?.jmeno ?? actorId;
}

export function getParentChildren(parentId: string): ProtoStudent[] {
  const studentIds = PROTO_PARENT_CHILD_LINKS.filter((link) => link.parentId === parentId).map(
    (link) => link.studentId,
  );
  return PROTO_STUDENTS.filter((student) => studentIds.includes(student.id));
}
