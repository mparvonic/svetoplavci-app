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

  const [people, activeStudentNicknames] = await Promise.all([
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
      },
    }),
  ]);
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const nicknameCounts = new Map<string, number>();
  for (const person of activeStudentNicknames) {
    const normalized = normalizeName(person.nickname);
    if (!normalized) continue;
    nicknameCounts.set(normalized, (nicknameCounts.get(normalized) ?? 0) + 1);
  }
  const duplicateNicknames = new Set(
    [...nicknameCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([nickname]) => nickname),
  );

  return children.map((child) => {
    const person = peopleById.get(child.id);
    const name = person?.displayName?.trim() || child.name;
    const nickname = person?.nickname?.trim() || "";
    const currentYear = formatRocnik(child.rocnik);
    const normalizedNickname = normalizeName(nickname);
    const matchNames = [
      normalizedNickname && !duplicateNicknames.has(normalizedNickname) ? nickname : "",
      name,
      child.name,
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
