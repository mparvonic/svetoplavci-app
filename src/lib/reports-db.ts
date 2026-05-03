import { prisma } from "@/src/lib/prisma";
import {
  getPortalParentAndChildrenForActor,
  type PortalChild,
  type PortalParent,
} from "@/src/lib/portal-db";

type ReportActorAccessInput = {
  email: string;
  personIds: string[];
  roles: string[];
};

export interface ReportChild {
  rowId: string;
  name: string;
  nickname: string;
  rocnik: string;
  currentYear: string;
  group: string;
}

export interface ReportParent {
  rowId: string;
  name: string;
}

export interface ReportTableRow {
  id: string;
  type: "row";
  href: string;
  name: string;
  index: number;
  createdAt: string;
  updatedAt: string;
  values: Record<string, unknown>;
}

type InternalReportChild = ReportChild & {
  matchNames: string[];
};

type InternalReportContext = {
  parent: ReportParent;
  children: InternalReportChild[];
};

type MirrorRow = {
  codaRowId: string;
  codaCreatedAt: Date | null;
  codaUpdatedAt: Date | null;
  data: unknown;
};

const PREDMETU_NAME_KEY = "c-6y8osbNwV1";
const OBLASTI_NAME_KEY = "c-H0Dv3JDsqU";

const HODNOCENI_PREDMETU_COLUMNS: Record<string, string> = {
  [PREDMETU_NAME_KEY]: "Jméno",
  "c-UXuyii8itd": "Předmět",
  "c-HFd9pHASFz": "Předmět celkem",
  "c-VpreYM7lLn": "Body celkem",
  "c-FQEmOP1h7p": "Norma",
  "c-cbGW-UNRmI": "Hodnocení",
};

const HODNOCENI_OBLASTI_COLUMNS: Record<string, string> = {
  [OBLASTI_NAME_KEY]: "Jméno",
  "c-FbbeJ33EsP": "Předmět",
  "c-HlTyztXbdQ": "Oblast",
  "c-5mVt75lgIO": "Oblast celkem",
  "c-B54-A7-5WI": "Dopočet při přestupu",
  "c-iKucJbAf8_": "Historické lodičky",
  "c-wRu87PvHCi": "Aktuální body",
  "c-D1XChdOh40": "Body celkem",
  "c-6AxGhTQBq5": "Norma",
  "c-LbpmBdYHFo": "Hodnocení",
};

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("cs");
}

function formatRocnik(rocnik: number | null): string {
  return rocnik ? `${rocnik}. ročník` : "";
}

function publicChild(child: InternalReportChild): ReportChild {
  return {
    rowId: child.rowId,
    name: child.name,
    nickname: child.nickname,
    rocnik: child.rocnik,
    currentYear: child.currentYear,
    group: child.group,
  };
}

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
}

function toIso(value: Date | null): string {
  return value ? value.toISOString() : "";
}

function getMappedValue(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return value == null ? "" : String(value);
}

function mirrorRowToReportRow(
  row: MirrorRow,
  columns: Record<string, string>,
  titleKey: string,
  index: number,
): ReportTableRow {
  const rawValues = asRecord(row.data);
  const values: Record<string, unknown> = {};

  for (const [sourceKey, label] of Object.entries(columns)) {
    values[label] = rawValues[sourceKey] ?? "";
  }

  return {
    id: row.codaRowId,
    type: "row",
    href: "",
    name: getMappedValue(values, titleKey) || row.codaRowId,
    index,
    createdAt: toIso(row.codaCreatedAt),
    updatedAt: toIso(row.codaUpdatedAt),
    values,
  };
}

function rowMatchesChild(row: MirrorRow, sourceNameKey: string, matchNames: Set<string>): boolean {
  const data = asRecord(row.data);
  const rowName = normalizeName(data[sourceNameKey] == null ? "" : String(data[sourceNameKey]));
  return rowName.length > 0 && matchNames.has(rowName);
}

async function enrichReportChildren(children: PortalChild[]): Promise<InternalReportChild[]> {
  if (children.length === 0) return [];

  const [people, activeStudents] = await Promise.all([
    prisma.appPerson.findMany({
      where: {
        id: { in: children.map((child) => child.id) },
      },
      select: {
        id: true,
        displayName: true,
        nickname: true,
      },
    }),
    prisma.appPerson.findMany({
      where: {
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
      },
      select: {
        nickname: true,
        displayName: true,
      },
    }),
  ]);
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const lookupNameCounts = new Map<string, number>();
  for (const person of activeStudents) {
    for (const value of [person.nickname, person.displayName]) {
      const normalized = normalizeName(value);
      if (!normalized) continue;
      lookupNameCounts.set(normalized, (lookupNameCounts.get(normalized) ?? 0) + 1);
    }
  }
  const duplicateLookupNames = new Set(
    [...lookupNameCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
  );

  return children.map((child) => {
    const person = peopleById.get(child.id);
    const name = child.name;
    const nickname = person?.nickname?.trim() || "";
    const currentYear = formatRocnik(child.rocnik);
    const normalizedNickname = normalizeName(nickname);
    const normalizedName = normalizeName(name);
    const matchNames = [
      normalizedNickname && !duplicateLookupNames.has(normalizedNickname) ? nickname : "",
      normalizedName && !duplicateLookupNames.has(normalizedName) ? name : "",
    ]
      .map(normalizeName)
      .filter(Boolean);

    return {
      rowId: child.id,
      name,
      nickname,
      rocnik: currentYear,
      currentYear,
      group: child.smecka ?? "",
      matchNames: [...new Set(matchNames)],
    };
  });
}

export async function getReportParentAndChildrenForActor(
  input: ReportActorAccessInput,
): Promise<{ parent: ReportParent; children: ReportChild[] } | null> {
  const portalContext = await getPortalParentAndChildrenForActor(input);
  if (!portalContext) return null;

  const children = await enrichReportChildren(portalContext.children);
  return {
    parent: toReportParent(portalContext.parent),
    children: children.map(publicChild),
  };
}

function toReportParent(parent: PortalParent): ReportParent {
  return {
    rowId: parent.id,
    name: parent.name,
  };
}

async function getInternalReportContext(input: ReportActorAccessInput): Promise<InternalReportContext | null> {
  const portalContext = await getPortalParentAndChildrenForActor(input);
  if (!portalContext) return null;
  return {
    parent: toReportParent(portalContext.parent),
    children: await enrichReportChildren(portalContext.children),
  };
}

// ─── Křivka (mirror_krivka) ───────────────────────────────────────────────────

const KRIVKA_COL_ROCNIK = "c-Gnf85M6reH";
const KRIVKA_COL_POLOLETI = "c-5u_BrMxW9w";
const KRIVKA_COL_STEPEN = "c-NXbv0udM99";
const KRIVKA_COL_OBDOBI = "c-opsHmPPnEm";
const KRIVKA_COL_NORMA = "c-ctMybhCUbr";
const KRIVKA_COL_NORMA_ZKRACENA = "c-kRj7A9aitl";

export type CurveResult = {
  rocnik: string;
  stepen_key: string;
  highlight: number | null;
  milestones: (number | null)[];
  milestones2: (number | null)[];
};

function toFloatPct(x: unknown): number | null {
  if (x == null) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const s = String(x).replace(/[ \s%]/g, "").replace(/,/g, ".");
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

function toNum(x: unknown, def: number): number {
  if (x == null) return def;
  if (typeof x === "number") return Number.isFinite(x) ? x : def;
  const s = String(x).replace(/[ \s%]/g, "").replace(/,/g, ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : def;
}

async function getCurveFromMirror(rocnik: string): Promise<CurveResult | null> {
  const allRaw = await prisma.mirrorKrivka.findMany();
  const rows = allRaw as MirrorRow[];
  const normalizedRocnik = rocnik.trim();

  const highlightRow = rows.find((row) => {
    const d = asRecord(row.data);
    return (
      String(d[KRIVKA_COL_ROCNIK] ?? "").trim() === normalizedRocnik &&
      String(d[KRIVKA_COL_POLOLETI] ?? "").trim() === "1. pololetí"
    );
  });
  if (!highlightRow) return null;

  const hd = asRecord(highlightRow.data);
  const stepenKey = String(hd[KRIVKA_COL_STEPEN] ?? "").trim();
  if (!stepenKey) return null;

  const sameStep = rows
    .filter((row) => String(asRecord(row.data)[KRIVKA_COL_STEPEN] ?? "").trim() === stepenKey)
    .sort((a, b) => Number(asRecord(a.data)[KRIVKA_COL_OBDOBI] ?? 0) - Number(asRecord(b.data)[KRIVKA_COL_OBDOBI] ?? 0));

  return {
    rocnik: normalizedRocnik,
    stepen_key: stepenKey,
    highlight: toFloatPct(hd[KRIVKA_COL_NORMA]),
    milestones: sameStep.map((row) => toFloatPct(asRecord(row.data)[KRIVKA_COL_NORMA])),
    milestones2: sameStep.map((row) => toFloatPct(asRecord(row.data)[KRIVKA_COL_NORMA_ZKRACENA])),
  };
}

export type GrafyPredmet = {
  predmet: string;
  hodnoceni: unknown;
  predchozi_hodnoceni: unknown;
  tempo_zmeny: unknown;
  oblasti: Array<{
    oblast: unknown;
    podpredmet: unknown;
    predchozi_body: unknown;
    body_celkem: unknown;
    zbyva_bodu: unknown;
  }>;
};

export async function getChildVysvedceniGrafyForActor(
  input: ReportActorAccessInput,
  childId: string,
): Promise<{ child: ReportChild; curve: CurveResult | null; predmety: GrafyPredmet[] } | null> {
  const vysvedceni = await getChildVysvedceniForActor(input, childId);
  if (!vysvedceni) return null;

  const curve = await getCurveFromMirror(vysvedceni.child.rocnik).catch(() => null);

  const areasBySubject = new Map<string, ReportTableRow[]>();
  for (const row of vysvedceni.oblasti) {
    const subj = String(row.values["Předmět"] ?? "").trim();
    if (!areasBySubject.has(subj)) areasBySubject.set(subj, []);
    areasBySubject.get(subj)!.push(row);
  }

  const predmety: GrafyPredmet[] = vysvedceni.predmetu
    .map((s) => {
      const predmet = String(s.values["Předmět"] ?? "").trim();
      const oblasti = (areasBySubject.get(predmet) ?? [])
        .map((a) => {
          const bodyCelkem = toNum(a.values["Body celkem"], 0);
          const oblastCelkem = toNum(a.values["Oblast celkem"], 0);
          return {
            oblast: a.values["Oblast"],
            podpredmet: a.values["Podpředmět"] ?? "",
            predchozi_body: toNum(a.values["Historické lodičky"], 0),
            body_celkem: bodyCelkem,
            zbyva_bodu: Math.max(0, oblastCelkem - bodyCelkem),
          };
        })
        .sort((a, b) => {
          const pp = String(a.podpredmet || "").localeCompare(String(b.podpredmet || ""), "cs");
          return pp !== 0 ? pp : String(a.oblast || "").localeCompare(String(b.oblast || ""), "cs");
        });
      return {
        predmet,
        hodnoceni: s.values["Hodnocení"],
        predchozi_hodnoceni: s.values["Předchozí hodnocení"] ?? "",
        tempo_zmeny: s.values["Tempo změny"] ?? "",
        oblasti,
      };
    })
    .sort((a, b) => a.predmet.localeCompare(b.predmet, "cs"));

  return { child: vysvedceni.child, curve, predmety };
}

// ─── Vysvědčení (tabulková data) ─────────────────────────────────────────────

export async function getChildVysvedceniForActor(
  input: ReportActorAccessInput,
  childId: string,
): Promise<{ parent: ReportParent; child: ReportChild; predmetu: ReportTableRow[]; oblasti: ReportTableRow[] } | null> {
  const context = await getInternalReportContext(input);
  if (!context) return null;

  const child = context.children.find((item) => item.rowId === childId);
  if (!child) return null;

  const matchNames = new Set(child.matchNames);
  const [predmetuRaw, oblastiRaw] = await Promise.all([
    prisma.mirrorHodnoceniPredmetu.findMany({
      orderBy: [{ codaRowId: "asc" }],
    }),
    prisma.mirrorHodnoceniOblasti.findMany({
      orderBy: [{ codaRowId: "asc" }],
    }),
  ]);

  const predmetu = (predmetuRaw as MirrorRow[])
    .filter((row) => rowMatchesChild(row, PREDMETU_NAME_KEY, matchNames))
    .map((row, index) => mirrorRowToReportRow(row, HODNOCENI_PREDMETU_COLUMNS, "Předmět", index));

  const oblasti = (oblastiRaw as MirrorRow[])
    .filter((row) => rowMatchesChild(row, OBLASTI_NAME_KEY, matchNames))
    .map((row, index) => mirrorRowToReportRow(row, HODNOCENI_OBLASTI_COLUMNS, "Oblast", index));

  return {
    parent: context.parent,
    child: publicChild(child),
    predmetu,
    oblasti,
  };
}
