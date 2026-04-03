import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import { normalizeEmail } from "@/src/lib/user-directory";

const DEFAULT_INITIAL_SYNC_DATE = "2021-09-01";
const CSV_ROLE_PARENT = "rodic";
const CSV_ROLE_ADMIN = "admin";
const API_ROLE_STUDENT = "zak";
const API_ROLE_EMPLOYEE = "zamestnanec";
const API_READ_ONLY_SOURCE_TYPES = new Set(["edookit_student", "edookit_employee"]);
const CODA_SO_PREZDIVKA = "c--RSuRrZPWK";
const CODA_SO_IDENTIFIKATOR = "c-5nG1glNg-o";
const CODA_SO_ROLE = "c-aI2b_O-scX";
const CODA_SO_KRESTNI = "c-hJKW60xeO1";
const CODA_SO_PRIJMENI = "c-GMLYzGw8ke";
const CODA_SO_JMENO = "c-MzlgfRju0X";

type SourceType = "edookit_student" | "edookit_employee" | "csv_parent";
type SyncMode = "initial" | "daily" | "manual";

interface NormalizedUserRecord {
  sourceType: SourceType;
  sourceKey: string;
  sourcePersonId?: string;
  sourceRecordId?: string;
  organizationIdent?: string;
  dedupKey: string;
  displayName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  identifier?: string;
  plus4uId?: string;
  primaryEmail?: string;
  activeSource: boolean;
  derivedRoles: string[];
  payload: Record<string, unknown>;
}

export interface SyncUsersOptions {
  mode?: SyncMode;
  date?: string;
  includeInactiveSince?: string;
  csvPath?: string;
  mapCodaNicknames?: boolean;
}

export interface CodaNicknameSyncStats {
  rowsTotal: number;
  rowsWithNickname: number;
  rowsMatched: number;
  rowsUnmatched: number;
  personsWithCandidate: number;
  personsUpdated: number;
  personsAlreadySet: number;
  nicknameConflicts: number;
}

export interface CsvParentChildRelationSyncStats {
  parentSourceRows: number;
  parentRowsWithChildren: number;
  childRefsTotal: number;
  childRefsResolved: number;
  childRefsUnmatched: number;
  relationsCreated: number;
  relationsActivated: number;
  relationsDeactivated: number;
  unmatchedChildNames: string[];
}

export interface SyncUsersResult {
  runId: string;
  mode: SyncMode;
  date: string;
  includeInactiveSince: string;
  studentsCount: number;
  employeesCount: number;
  csvCount: number;
  personsTouched: number;
  codaNickname?: CodaNicknameSyncStats;
  csvParentChildRelations?: CsvParentChildRelationSyncStats;
}

type EdookitStudent = Record<string, unknown>;
type EdookitEmployee = Record<string, unknown>;
type StudyModeKey = "denni" | "individualni" | "zahranici" | "unknown";

interface StudentStateProjection {
  sourceType: "edookit_student";
  sourceKey: string;
  currentGradeNum: number | null;
  initialGradeNum: number | null;
  studyModeCode: string | null;
  studyModeKey: StudyModeKey;
  rawHash: string;
}

function isApiReadOnlySourceType(sourceType: SourceType): boolean {
  return API_READ_ONLY_SOURCE_TYPES.has(sourceType);
}

function currentDateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(input: string): string {
  const trimmed = input.trim();
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  throw new Error(`Invalid date format '${input}'. Expected YYYY-MM-DD or YYYYMMDD.`);
}

function normText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function normIdentifier(value: unknown): string {
  return normText(value).toLowerCase().replace(/\s+/g, "");
}

function sha256(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function toInputJsonValue(payload: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
}

function boolFromCsv(value: unknown): boolean {
  const v = normText(value).toLowerCase();
  if (!v) return true;
  if (["1", "true", "ano", "yes"].includes(v)) return true;
  if (["0", "false", "ne", "no"].includes(v)) return false;
  return true;
}

function parseGradeNum(value: unknown): number | null {
  const raw = normText(value);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > 9) return null;
  return parsed;
}

function normalizeStudyModeCode(value: unknown): string | null {
  const raw = normText(value);
  return raw || null;
}

function toObjectPayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isActiveAtDate(unenrolledSinceRaw: unknown, asOfDate: string): boolean {
  const unenrolledSince = normText(unenrolledSinceRaw);
  if (!unenrolledSince) return true;
  const normalized = normalizeDate(unenrolledSince);
  return normalized > asOfDate;
}

function buildPersonDedupKey(input: {
  plus4uId?: string;
  identifier?: string;
  sourceType: SourceType;
  organizationIdent?: string;
  sourcePersonId?: string;
  sourceRecordId?: string;
  sourceKey: string;
}): string {
  const plus4u = normText(input.plus4uId);
  if (plus4u) return `plus4u:${plus4u.toLowerCase()}`;

  const identifier = normIdentifier(input.identifier);
  if (identifier) return `ident:${identifier}`;

  const personIdPart = normText(input.sourcePersonId) || normText(input.sourceRecordId);
  if (personIdPart) {
    const org = normText(input.organizationIdent) || "na";
    return `${input.sourceType}:${org}:${personIdPart}`;
  }

  return `${input.sourceType}:hash:${sha256(input.sourceKey).slice(0, 24)}`;
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function pickNameParts(input: {
  firstName?: string;
  lastName?: string;
  displayName: string;
}): { firstPart: string; lastPart: string } {
  const displayName = normalizeSpaces(input.displayName);
  const displayParts = displayName ? displayName.split(" ").filter(Boolean) : [];

  const firstPart =
    normalizeSpaces(input.firstName ?? "") || displayParts[0] || "Uzivatel";

  let lastPart = normalizeSpaces(input.lastName ?? "");
  if (!lastPart && displayParts.length > 1) {
    lastPart = displayParts[displayParts.length - 1];
  }

  return { firstPart, lastPart };
}

function nicknameCandidates(firstPart: string, lastPart: string): string[] {
  if (!lastPart) {
    return [`${firstPart}.`];
  }
  const candidates: string[] = [];
  for (let len = 1; len <= lastPart.length; len += 1) {
    candidates.push(`${firstPart} ${lastPart.slice(0, len)}.`);
  }
  return candidates;
}

function normalizeNickname(value: string): string {
  return normalizeSpaces(value).toLocaleLowerCase("cs-CZ");
}

function normalizeNameMatch(value: string): string {
  return normalizeSpaces(value)
    .toLocaleLowerCase("cs-CZ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mergeUniqueMap(map: Map<string, string | null>, key: string, value: string): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, value);
    return;
  }
  if (existing !== value) {
    map.set(key, null);
  }
}

function resolveUniqueMap(map: Map<string, string | null>, key: string): string | null {
  const found = map.get(key);
  if (found === undefined || found === null) return null;
  return found;
}

function roleContainsRodic(rawRole: unknown): boolean {
  const value = normText(rawRole);
  if (!value) return false;
  return value
    .split(",")
    .map((part) => normalizeSpaces(part).toLocaleLowerCase("cs-CZ"))
    .some((part) => part === "rodič" || part === "rodic");
}

async function buildUniqueNickname(input: {
  personId: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
}): Promise<string> {
  const { firstPart, lastPart } = pickNameParts(input);
  const existingNicknames = await prisma.appPerson.findMany({
    where: {
      id: {
        not: input.personId,
      },
      nickname: {
        not: null,
      },
    },
    select: {
      nickname: true,
    },
  });

  const used = new Set(
    existingNicknames
      .map((row) => row.nickname)
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizeNickname(value))
  );

  for (const candidate of nicknameCandidates(firstPart, lastPart)) {
    if (!used.has(normalizeNickname(candidate))) {
      return candidate;
    }
  }

  // If the full surname prefix is still not unique (same first+surname exists),
  // continue with numeric suffix to preserve uniqueness.
  let counter = 2;
  while (true) {
    const candidate = lastPart
      ? `${firstPart} ${lastPart}. ${counter}`
      : `${firstPart}. ${counter}`;
    if (!used.has(normalizeNickname(candidate))) {
      return candidate;
    }
    counter += 1;
  }
}

async function ensurePersonNickname(person: {
  id: string;
  nickname: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
}): Promise<string> {
  if (person.nickname) return person.nickname;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const nickname = await buildUniqueNickname({
      personId: person.id,
      firstName: person.firstName ?? undefined,
      lastName: person.lastName ?? undefined,
      displayName: person.displayName,
    });

    try {
      const updated = await prisma.appPerson.update({
        where: { id: person.id },
        data: { nickname },
        select: { nickname: true },
      });
      return updated.nickname ?? nickname;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Could not assign unique nickname for person '${person.id}'.`);
}

export async function syncCodaNicknames(): Promise<CodaNicknameSyncStats> {
  const persons = await prisma.appPerson.findMany({
    select: {
      id: true,
      identifier: true,
      firstName: true,
      lastName: true,
      displayName: true,
      nickname: true,
      roles: {
        where: { isActive: true },
        select: { role: true },
      },
    },
  });

  const byIdentifier = new Map<string, string | null>();
  const byDisplayName = new Map<string, string | null>();
  const byParentName = new Map<string, string | null>();
  const personById = new Map(persons.map((p) => [p.id, p]));

  for (const person of persons) {
    const identifierNorm = normIdentifier(person.identifier);
    if (identifierNorm) {
      mergeUniqueMap(byIdentifier, identifierNorm, person.id);
    }

    const displayNameNorm = normalizeNameMatch(person.displayName);
    if (displayNameNorm) {
      mergeUniqueMap(byDisplayName, displayNameNorm, person.id);
    }

    const isParent = person.roles.some((role) => role.role === CSV_ROLE_PARENT);
    if (isParent) {
      const firstNameNorm = normalizeNameMatch(person.firstName ?? "");
      const lastNameNorm = normalizeNameMatch(person.lastName ?? "");
      if (firstNameNorm && lastNameNorm) {
        mergeUniqueMap(byParentName, `${firstNameNorm}|${lastNameNorm}`, person.id);
      }
    }
  }

  const codaRows = await prisma.mirrorSeznamOsob.findMany({
    select: {
      codaRowId: true,
      data: true,
    },
  });

  const personNicknameCounts = new Map<string, Map<string, number>>();
  let rowsWithNickname = 0;
  let rowsMatched = 0;
  let rowsUnmatched = 0;

  for (const row of codaRows) {
    const payload = toObjectPayload(row.data);
    const nickname = normalizeSpaces(normText(payload[CODA_SO_PREZDIVKA]));
    if (!nickname) continue;
    rowsWithNickname += 1;

    const identifierNorm = normIdentifier(payload[CODA_SO_IDENTIFIKATOR]);
    const roleRaw = payload[CODA_SO_ROLE];
    const firstNameNorm = normalizeNameMatch(normText(payload[CODA_SO_KRESTNI]));
    const lastNameNorm = normalizeNameMatch(normText(payload[CODA_SO_PRIJMENI]));
    const displayNameNorm = normalizeNameMatch(normText(payload[CODA_SO_JMENO]));

    let personId = identifierNorm ? resolveUniqueMap(byIdentifier, identifierNorm) : null;
    if (!personId && roleContainsRodic(roleRaw) && firstNameNorm && lastNameNorm) {
      personId = resolveUniqueMap(byParentName, `${firstNameNorm}|${lastNameNorm}`);
    }
    if (!personId && displayNameNorm) {
      personId = resolveUniqueMap(byDisplayName, displayNameNorm);
    }

    if (!personId) {
      rowsUnmatched += 1;
      continue;
    }

    rowsMatched += 1;
    if (!personNicknameCounts.has(personId)) {
      personNicknameCounts.set(personId, new Map());
    }
    const bucket = personNicknameCounts.get(personId)!;
    bucket.set(nickname, (bucket.get(nickname) ?? 0) + 1);
  }

  let personsUpdated = 0;
  let personsAlreadySet = 0;
  let nicknameConflicts = 0;

  for (const [personId, bucket] of personNicknameCounts.entries()) {
    const preferredNickname = [...bucket.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "cs"))
      .at(0)?.[0];

    if (!preferredNickname) continue;

    const currentPerson = personById.get(personId);
    if (!currentPerson) continue;

    if (normalizeNickname(currentPerson.nickname ?? "") === normalizeNickname(preferredNickname)) {
      personsAlreadySet += 1;
      continue;
    }

    try {
      await prisma.appPerson.update({
        where: { id: personId },
        data: { nickname: preferredNickname },
      });
      personsUpdated += 1;
      personById.set(personId, {
        ...currentPerson,
        nickname: preferredNickname,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        nicknameConflicts += 1;
        continue;
      }
      throw error;
    }
  }

  return {
    rowsTotal: codaRows.length,
    rowsWithNickname,
    rowsMatched,
    rowsUnmatched,
    personsWithCandidate: personNicknameCounts.size,
    personsUpdated,
    personsAlreadySet,
    nicknameConflicts,
  };
}

function parseCsv(content: string, delimiter = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function normalizeHeaderName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const wanted = new Set(aliases.map(normalizeHeaderName));
  for (let i = 0; i < headers.length; i += 1) {
    if (wanted.has(normalizeHeaderName(headers[i]))) return i;
  }
  return -1;
}

function readCsvParents(csvPath: string): NormalizedUserRecord[] {
  const raw = readFileSync(csvPath, "utf8");
  const rows = parseCsv(raw, ";");
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const index = {
    id: findColumnIndex(headers, ["ID"]),
    nameFull: findColumnIndex(headers, ["Jméno osoby", "Jmeno osoby", "Full name"]),
    firstName: findColumnIndex(headers, ["Jméno", "Jmeno", "Firstname"]),
    middleName: findColumnIndex(headers, ["Prostřední jméno", "Prostredni jmeno", "Middlename"]),
    lastName: findColumnIndex(headers, ["Příjmení", "Prijmeni", "Lastname"]),
    identifier: findColumnIndex(headers, ["Identifikátor", "Identifikator", "Identifier"]),
    primaryEmail: findColumnIndex(headers, ["Primární e-mail", "Primarni e-mail", "PrimaryEmail", "Primary email"]),
    active: findColumnIndex(headers, ["Aktivní účet", "Aktivni ucet", "Active", "IsActive"]),
    role: findColumnIndex(headers, ["Role uživatele", "Role uzivatele", "Role"]),
    plus4uId: findColumnIndex(headers, ["Plus4U ID", "Plus4UId"]),
  };

  if (index.id < 0) throw new Error("CSV import: missing required column 'ID'.");
  if (index.identifier < 0) throw new Error("CSV import: missing required column 'Identifikátor'.");
  if (index.nameFull < 0 && (index.firstName < 0 || index.lastName < 0)) {
    throw new Error("CSV import: missing required name columns ('Jméno osoby' or 'Jméno' + 'Příjmení').");
  }

  const parsed: NormalizedUserRecord[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.length === 1 && !row[0].trim()) continue;

    const sourceRecordId = index.id >= 0 ? normText(row[index.id]) : "";
    const identifier = index.identifier >= 0 ? normText(row[index.identifier]) : "";
    const firstName = index.firstName >= 0 ? normText(row[index.firstName]) : "";
    const middleName = index.middleName >= 0 ? normText(row[index.middleName]) : "";
    const lastName = index.lastName >= 0 ? normText(row[index.lastName]) : "";
    const fullName = index.nameFull >= 0 ? normText(row[index.nameFull]) : "";
    const displayName = fullName || [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
    if (!displayName) continue;

    const primaryEmailRaw = index.primaryEmail >= 0 ? normText(row[index.primaryEmail]) : "";
    const primaryEmail = primaryEmailRaw ? normalizeEmail(primaryEmailRaw) : "";
    const plus4uId = index.plus4uId >= 0 ? normText(row[index.plus4uId]) : "";
    const roleRaw = index.role >= 0 ? normText(row[index.role]) : "";

    const derivedRoles = new Set<string>();
    const roleNorm = roleRaw.toLowerCase();
    // CSV export is parent-centric: every imported record must always have role "rodic".
    derivedRoles.add(CSV_ROLE_PARENT);
    if (roleNorm.includes("administr")) derivedRoles.add(CSV_ROLE_ADMIN);

    const sourceKey = `csv_parent:${sourceRecordId}`;
    const dedupKey = buildPersonDedupKey({
      plus4uId,
      identifier,
      sourceType: "csv_parent",
      sourceRecordId,
      sourceKey,
    });

    const activeSource = index.active >= 0 ? boolFromCsv(row[index.active]) : true;

    const payload: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      const value = row[idx] ?? "";
      if (value !== "") payload[header] = value;
    });

    parsed.push({
      sourceType: "csv_parent",
      sourceKey,
      sourceRecordId,
      dedupKey,
      displayName,
      firstName: firstName || undefined,
      middleName: middleName || undefined,
      lastName: lastName || undefined,
      identifier: identifier || undefined,
      plus4uId: plus4uId || undefined,
      primaryEmail: primaryEmail || undefined,
      activeSource,
      derivedRoles: [...derivedRoles],
      payload,
    });
  }

  return parsed;
}

function base64BasicAuth(username: string, password: string): string {
  return Buffer.from(`${username}:${password}`).toString("base64");
}

function getEdookitConfig() {
  const baseUrl = process.env.EDOOKIT_BASE_URL;
  const username = process.env.EDOOKIT_API_USERNAME;
  const password = process.env.EDOOKIT_API_PASSWORD;
  if (!baseUrl || !username || !password) {
    throw new Error("Missing EDOOKIT_BASE_URL, EDOOKIT_API_USERNAME or EDOOKIT_API_PASSWORD.");
  }
  return { baseUrl, username, password };
}

async function fetchEdookitArray<T>(
  relativePath: string,
  rootField: "Students" | "Employees"
): Promise<T[]> {
  const { baseUrl, username, password } = getEdookitConfig();
  const url = new URL(relativePath, baseUrl);
  const auth = base64BasicAuth(username, password);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Edookit ${relativePath} failed (${response.status}): ${body.slice(0, 400)}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  const items = json[rootField];
  if (!Array.isArray(items)) {
    throw new Error(`Edookit ${relativePath}: missing '${rootField}' array in response.`);
  }
  return items as T[];
}

function normalizeStudentRecord(row: EdookitStudent, requestedDate: string): NormalizedUserRecord {
  const personId = normText(row.PersonId);
  const organizationIdent = normText(row.OrganizationIdent);
  const identifier = normText(row.Identifier);
  const plus4uId = normText(row.Plus4UId);
  const firstName = normText(row.Firstname);
  const middleName = normText(row.Middlename);
  const lastName = normText(row.Lastname);
  const displayName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || identifier || personId;
  const primaryEmail = normText(row.PrimaryEmail);

  const sourceKey = `edookit_student:${organizationIdent}:${personId}`;
  const dedupKey = buildPersonDedupKey({
    plus4uId,
    identifier,
    sourceType: "edookit_student",
    organizationIdent,
    sourcePersonId: personId,
    sourceKey,
  });

  return {
    sourceType: "edookit_student",
    sourceKey,
    sourcePersonId: personId,
    organizationIdent: organizationIdent || undefined,
    dedupKey,
    displayName,
    firstName: firstName || undefined,
    middleName: middleName || undefined,
    lastName: lastName || undefined,
    identifier: identifier || undefined,
    plus4uId: plus4uId || undefined,
    primaryEmail: primaryEmail ? normalizeEmail(primaryEmail) : undefined,
    activeSource: isActiveAtDate(row.UnenrolledSince, requestedDate),
    derivedRoles: [API_ROLE_STUDENT],
    payload: row,
  };
}

function normalizeEmployeeRecord(row: EdookitEmployee, requestedDate: string): NormalizedUserRecord {
  const personId = normText(row.PersonId);
  const organizationIdent = normText(row.OrganizationIdent);
  const identifier = normText(row.Identifier);
  const plus4uId = normText(row.Plus4UId);
  const firstName = normText(row.Firstname);
  const middleName = normText(row.Middlename);
  const lastName = normText(row.Lastname);
  const displayName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || identifier || personId;
  const primaryEmail = normText(row.PrimaryEmail);

  const sourceKey = `edookit_employee:${organizationIdent}:${personId}`;
  const dedupKey = buildPersonDedupKey({
    plus4uId,
    identifier,
    sourceType: "edookit_employee",
    organizationIdent,
    sourcePersonId: personId,
    sourceKey,
  });

  return {
    sourceType: "edookit_employee",
    sourceKey,
    sourcePersonId: personId,
    organizationIdent: organizationIdent || undefined,
    dedupKey,
    displayName,
    firstName: firstName || undefined,
    middleName: middleName || undefined,
    lastName: lastName || undefined,
    identifier: identifier || undefined,
    plus4uId: plus4uId || undefined,
    primaryEmail: primaryEmail ? normalizeEmail(primaryEmail) : undefined,
    activeSource: isActiveAtDate(row.UnenrolledSince, requestedDate),
    derivedRoles: [API_ROLE_EMPLOYEE],
    payload: row,
  };
}

async function upsertNormalizedRecord(
  record: NormalizedUserRecord
): Promise<{ personId: string; identityId?: string }> {
  const payloadJson = toInputJsonValue(record.payload);

  const personSelect = {
    id: true,
    nickname: true,
    firstName: true,
    lastName: true,
    displayName: true,
    identifier: true,
    plus4uId: true,
  } as const;

  let person = await prisma.appPerson.findUnique({
    where: { dedupKey: record.dedupKey },
    select: personSelect,
  });

  if (!person) {
    person = await prisma.appPerson.create({
      data: {
        dedupKey: record.dedupKey,
        displayName: record.displayName,
        firstName: record.firstName,
        middleName: record.middleName,
        lastName: record.lastName,
        identifier: record.identifier,
        plus4uId: record.plus4uId,
      },
      select: personSelect,
    });
  } else {
    const hasApiReadOnlySource = await prisma.appPersonSourceRecord.findFirst({
      where: {
        personId: person.id,
        sourceType: {
          in: [...API_READ_ONLY_SOURCE_TYPES],
        },
      },
      select: {
        id: true,
      },
    });

    // Data loaded from Edookit API are read-only for non-API sources.
    const allowProfileOverwrite =
      isApiReadOnlySourceType(record.sourceType) || !hasApiReadOnlySource;

    if (allowProfileOverwrite) {
      const nextData: Prisma.AppPersonUpdateInput = {
        displayName: record.displayName,
        firstName: record.firstName,
        middleName: record.middleName,
        lastName: record.lastName,
      };
      if (record.identifier) nextData.identifier = record.identifier;
      if (record.plus4uId) nextData.plus4uId = record.plus4uId;

      person = await prisma.appPerson.update({
        where: { id: person.id },
        data: nextData,
        select: personSelect,
      });
    }
  }

  await ensurePersonNickname(person);

  await prisma.appPersonSourceRecord.upsert({
    where: {
      sourceKey: record.sourceKey,
    },
    update: {
      personId: person.id,
      sourceType: record.sourceType,
      sourcePersonId: record.sourcePersonId,
      sourceRecordId: record.sourceRecordId,
      organizationIdent: record.organizationIdent,
      primaryEmail: record.primaryEmail,
      activeSource: record.activeSource,
      derivedRoles: record.derivedRoles,
      payload: payloadJson,
      sourceHash: sha256(record.payload),
      syncedAt: new Date(),
    },
    create: {
      personId: person.id,
      sourceType: record.sourceType,
      sourceKey: record.sourceKey,
      sourcePersonId: record.sourcePersonId,
      sourceRecordId: record.sourceRecordId,
      organizationIdent: record.organizationIdent,
      primaryEmail: record.primaryEmail,
      activeSource: record.activeSource,
      derivedRoles: record.derivedRoles,
      payload: payloadJson,
      sourceHash: sha256(record.payload),
    },
  });

  if (!record.primaryEmail) {
    return { personId: person.id };
  }

  const identity = await prisma.appLoginIdentity.upsert({
    where: {
      identityType_normalizedValue: {
        identityType: "email",
        normalizedValue: record.primaryEmail,
      },
    },
    update: {
      identityValue: record.primaryEmail,
      isActive: true,
    },
    create: {
      identityType: "email",
      identityValue: record.primaryEmail,
      normalizedValue: record.primaryEmail,
      isActive: true,
    },
  });

  await prisma.appLoginPersonLink.upsert({
    where: {
      identityId_personId: {
        identityId: identity.id,
        personId: person.id,
      },
    },
    update: {},
    create: {
      identityId: identity.id,
      personId: person.id,
      status: "pending",
    },
  });

  return { personId: person.id, identityId: identity.id };
}

async function refreshIdentityConflict(identityId: string): Promise<void> {
  const identity = await prisma.appLoginIdentity.findUnique({
    where: { id: identityId },
    select: { normalizedValue: true },
  });
  if (!identity) return;

  const relevantLinks = await prisma.appLoginPersonLink.findMany({
    where: {
      identityId,
      status: {
        in: ["pending", "approved"],
      },
    },
    select: {
      personId: true,
      status: true,
    },
  });

  const shouldBeOpen =
    relevantLinks.length > 1 && relevantLinks.some((link) => link.status === "pending");
  const openConflict = await prisma.appIdentityConflict.findFirst({
    where: {
      identityId,
      status: "open",
      reason: "MULTI_PERSON_IDENTITY",
    },
  });

  if (shouldBeOpen && !openConflict) {
    await prisma.appIdentityConflict.create({
      data: {
        identityId,
        normalizedValue: identity.normalizedValue,
        reason: "MULTI_PERSON_IDENTITY",
        status: "open",
        details: {
          personIds: relevantLinks.map((l) => l.personId),
        },
      },
    });
    return;
  }

  if (shouldBeOpen && openConflict) {
    await prisma.appIdentityConflict.update({
      where: { id: openConflict.id },
      data: {
        details: {
          personIds: relevantLinks.map((l) => l.personId),
        },
      },
    });
    return;
  }

  if (!shouldBeOpen && openConflict) {
    await prisma.appIdentityConflict.update({
      where: { id: openConflict.id },
      data: {
        status: "resolved",
        resolvedBy: "system",
        resolvedAt: new Date(),
      },
    });
  }
}

async function reconcileIdentityLinks(identityId: string): Promise<void> {
  const links = await prisma.appLoginPersonLink.findMany({
    where: { identityId },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (links.length !== 1) return;

  const only = links[0];
  if (only.status === "approved") return;

  await prisma.appLoginPersonLink.update({
    where: { id: only.id },
    data: {
      status: "approved",
      approvedBy: "system:auto-single-link",
      approvedAt: new Date(),
      reason: null,
    },
  });
}

async function recomputePersonRolesAndActivity(personId: string): Promise<void> {
  const activeSourceRecords = await prisma.appPersonSourceRecord.findMany({
    where: {
      personId,
      activeSource: true,
    },
    select: {
      derivedRoles: true,
    },
  });

  const desiredAutoRoles = new Set<string>();
  for (const sourceRecord of activeSourceRecords) {
    for (const role of sourceRecord.derivedRoles) {
      desiredAutoRoles.add(role);
    }
  }

  const existingAutoRoles = await prisma.appRoleAssignment.findMany({
    where: {
      personId,
      source: "auto",
    },
  });

  for (const roleAssignment of existingAutoRoles) {
    const shouldBeActive = desiredAutoRoles.has(roleAssignment.role);
    if (roleAssignment.isActive !== shouldBeActive) {
      await prisma.appRoleAssignment.update({
        where: { id: roleAssignment.id },
        data: {
          isActive: shouldBeActive,
        },
      });
    }
  }

  for (const role of desiredAutoRoles) {
    const existing = existingAutoRoles.find((r) => r.role === role);
    if (!existing) {
      await prisma.appRoleAssignment.create({
        data: {
          personId,
          role,
          source: "auto",
          isActive: true,
        },
      });
    }
  }

  await prisma.appPerson.update({
    where: { id: personId },
    data: {
      isActive: activeSourceRecords.length > 0,
    },
  });
}

function pickPreferredStudentRecord(
  current: NormalizedUserRecord | undefined,
  incoming: NormalizedUserRecord
): NormalizedUserRecord {
  if (!current) return incoming;

  const score = (record: NormalizedUserRecord): number => {
    const payload = record.payload;
    let value = 0;
    if (record.activeSource) value += 100;
    if (parseGradeNum(payload.CurrentGradeNum) != null) value += 10;
    if (parseGradeNum(payload.InitialGradeNum) != null) value += 5;
    if (normalizeStudyModeCode(payload.UIV_ZPUSOB)) value += 2;
    return value;
  };

  const currentScore = score(current);
  const incomingScore = score(incoming);
  if (incomingScore > currentScore) return incoming;
  if (incomingScore < currentScore) return current;
  return incoming.sourceKey < current.sourceKey ? incoming : current;
}

async function loadStudyModeMap(): Promise<Map<string, StudyModeKey>> {
  const rows = await prisma.appStudyModeMap.findMany({
    where: { isActive: true },
    select: {
      code: true,
      modeKey: true,
    },
  });

  const map = new Map<string, StudyModeKey>();
  for (const row of rows) {
    map.set(row.code, row.modeKey as StudyModeKey);
  }
  return map;
}

async function findSchoolYearIdForDate(dateIso: string): Promise<string | null> {
  const normalized = normalizeDate(dateIso);
  const date = new Date(`${normalized}T00:00:00.000Z`);
  const schoolYear = await prisma.appSchoolYear.findFirst({
    where: {
      startDate: {
        lte: date,
      },
      endDate: {
        gte: date,
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      startDate: "desc",
    },
  });
  return schoolYear?.id ?? null;
}

function projectStudentStateFromPayload(input: {
  sourceKey: string;
  payload: Record<string, unknown>;
  modeByCode: Map<string, StudyModeKey>;
}): StudentStateProjection {
  const currentGradeNum = parseGradeNum(input.payload.CurrentGradeNum);
  const initialGradeNum = parseGradeNum(input.payload.InitialGradeNum);
  const studyModeCode = normalizeStudyModeCode(input.payload.UIV_ZPUSOB);
  const studyModeKey = (studyModeCode ? input.modeByCode.get(studyModeCode) : undefined) ?? "unknown";

  const rawHash = sha256({
    currentGradeNum,
    initialGradeNum,
    studyModeCode,
    studyModeKey,
  });

  return {
    sourceType: "edookit_student",
    sourceKey: input.sourceKey,
    currentGradeNum,
    initialGradeNum,
    studyModeCode,
    studyModeKey,
    rawHash,
  };
}

async function resolveStudentStateProjection(
  personId: string,
  preferredRecord: NormalizedUserRecord | undefined,
  modeByCode: Map<string, StudyModeKey>
): Promise<StudentStateProjection | null> {
  if (preferredRecord?.activeSource) {
    return projectStudentStateFromPayload({
      sourceKey: preferredRecord.sourceKey,
      payload: preferredRecord.payload,
      modeByCode,
    });
  }

  const source = await prisma.appPersonSourceRecord.findFirst({
    where: {
      personId,
      sourceType: "edookit_student",
      activeSource: true,
    },
    select: {
      sourceKey: true,
      payload: true,
    },
    orderBy: [
      {
        syncedAt: "desc",
      },
      {
        sourceKey: "asc",
      },
    ],
  });

  if (!source) return null;

  return projectStudentStateFromPayload({
    sourceKey: source.sourceKey,
    payload: toObjectPayload(source.payload),
    modeByCode,
  });
}

async function syncStudentStateForPerson(input: {
  personId: string;
  preferredRecord?: NormalizedUserRecord;
  modeByCode: Map<string, StudyModeKey>;
  runId: string;
  schoolYearId: string | null;
}): Promise<void> {
  const projection = await resolveStudentStateProjection(
    input.personId,
    input.preferredRecord,
    input.modeByCode
  );

  const openState = await prisma.appStudentState.findFirst({
    where: {
      personId: input.personId,
      effectiveTo: null,
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  });

  const now = new Date();
  if (!projection) {
    if (openState) {
      await prisma.appStudentState.update({
        where: { id: openState.id },
        data: {
          effectiveTo: now,
        },
      });
    }
    return;
  }

  if (openState && openState.rawHash === projection.rawHash) {
    if (openState.sourceKey !== projection.sourceKey || openState.schoolYearId !== input.schoolYearId) {
      await prisma.appStudentState.update({
        where: { id: openState.id },
        data: {
          sourceKey: projection.sourceKey,
          schoolYearId: input.schoolYearId,
          changedBySyncRunId: input.runId,
        },
      });
    }
    return;
  }

  if (openState) {
    await prisma.appStudentState.update({
      where: { id: openState.id },
      data: {
        effectiveTo: now,
      },
    });
  }

  await prisma.appStudentState.create({
    data: {
      personId: input.personId,
      sourceType: projection.sourceType,
      sourceKey: projection.sourceKey,
      effectiveFrom: now,
      effectiveTo: null,
      schoolYearId: input.schoolYearId,
      currentGradeNum: projection.currentGradeNum,
      initialGradeNum: projection.initialGradeNum,
      studyModeCode: projection.studyModeCode,
      studyModeKey: projection.studyModeKey,
      changedBySyncRunId: input.runId,
      rawHash: projection.rawHash,
    },
  });
}

function splitCsvChildrenRaw(value: unknown): string[] {
  const raw = normText(value);
  if (!raw) return [];
  return raw
    .split(/[\n,;]+/)
    .map((part) => normalizeNameMatch(part))
    .filter(Boolean);
}

function readCsvChildrenFromPayload(payload: Record<string, unknown>): string[] {
  const directAliases = new Set(["deti ve skole", "deti"]);
  const fallbackValues: string[] = [];

  for (const [key, value] of Object.entries(payload)) {
    const normalized = normalizeHeaderName(key);
    if (directAliases.has(normalized)) {
      return splitCsvChildrenRaw(value);
    }

    if (normalized.includes("deti") && (normalized.includes("skole") || normalized === "deti")) {
      fallbackValues.push(normText(value));
    }
  }

  if (fallbackValues.length === 0) return [];
  return splitCsvChildrenRaw(fallbackValues.join(", "));
}

function createStudentNameKey(input: { firstName: string; lastName: string }): {
  firstLast: string;
  lastFirst: string;
} {
  const first = normalizeNameMatch(input.firstName);
  const last = normalizeNameMatch(input.lastName);
  if (!first || !last) {
    return { firstLast: "", lastFirst: "" };
  }
  return {
    firstLast: `${first} ${last}`,
    lastFirst: `${last} ${first}`,
  };
}

async function syncCsvParentChildRelations(): Promise<CsvParentChildRelationSyncStats> {
  const students = await prisma.appPerson.findMany({
    where: {
      isActive: true,
      roles: {
        some: {
          role: API_ROLE_STUDENT,
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
    },
  });

  const childByNameKey = new Map<string, string | null>();
  for (const student of students) {
    let firstName = student.firstName ?? "";
    let lastName = student.lastName ?? "";
    if (!firstName || !lastName) {
      const parts = normalizeSpaces(student.displayName).split(" ").filter(Boolean);
      if (!firstName && parts.length > 0) firstName = parts[0];
      if (!lastName && parts.length > 1) lastName = parts[parts.length - 1];
    }

    const keys = createStudentNameKey({
      firstName,
      lastName,
    });
    if (keys.firstLast) mergeUniqueMap(childByNameKey, keys.firstLast, student.id);
    if (keys.lastFirst) mergeUniqueMap(childByNameKey, keys.lastFirst, student.id);
  }

  const parentSources = await prisma.appPersonSourceRecord.findMany({
    where: {
      sourceType: "csv_parent",
      activeSource: true,
    },
    select: {
      personId: true,
      payload: true,
    },
  });

  const desiredPairs = new Set<string>();
  const unmatchedChildCounts = new Map<string, number>();
  let parentRowsWithChildren = 0;
  let childRefsTotal = 0;
  let childRefsResolved = 0;
  let childRefsUnmatched = 0;

  for (const source of parentSources) {
    const payload = toObjectPayload(source.payload);
    const childNames = readCsvChildrenFromPayload(payload);
    if (childNames.length === 0) continue;

    parentRowsWithChildren += 1;
    for (const childName of childNames) {
      childRefsTotal += 1;
      const childId = resolveUniqueMap(childByNameKey, childName);
      if (!childId) {
        childRefsUnmatched += 1;
        unmatchedChildCounts.set(childName, (unmatchedChildCounts.get(childName) ?? 0) + 1);
        continue;
      }

      if (childId === source.personId) continue;
      desiredPairs.add(`${source.personId}|${childId}`);
      childRefsResolved += 1;
    }
  }

  const existingRelations = await prisma.appPersonRelation.findMany({
    where: {
      source: "csv_parent",
      relationType: "parent_of",
    },
    select: {
      id: true,
      parentPersonId: true,
      childPersonId: true,
      isActive: true,
    },
  });

  const existingByKey = new Map(
    existingRelations.map((row) => [`${row.parentPersonId}|${row.childPersonId}`, row] as const)
  );

  let relationsCreated = 0;
  let relationsActivated = 0;
  let relationsDeactivated = 0;

  await prisma.$transaction(async (tx) => {
    for (const key of desiredPairs) {
      const existing = existingByKey.get(key);
      const [parentPersonId, childPersonId] = key.split("|");

      if (!existing) {
        await tx.appPersonRelation.create({
          data: {
            parentPersonId,
            childPersonId,
            relationType: "parent_of",
            source: "csv_parent",
            isActive: true,
          },
        });
        relationsCreated += 1;
        continue;
      }

      if (!existing.isActive) {
        await tx.appPersonRelation.update({
          where: { id: existing.id },
          data: {
            isActive: true,
          },
        });
        relationsActivated += 1;
      }
    }

    for (const relation of existingRelations) {
      const key = `${relation.parentPersonId}|${relation.childPersonId}`;
      if (relation.isActive && !desiredPairs.has(key)) {
        await tx.appPersonRelation.update({
          where: { id: relation.id },
          data: {
            isActive: false,
          },
        });
        relationsDeactivated += 1;
      }
    }
  });

  const unmatchedChildNames = [...unmatchedChildCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "cs"))
    .slice(0, 50)
    .map(([name, count]) => `${name}:${count}`);

  return {
    parentSourceRows: parentSources.length,
    parentRowsWithChildren,
    childRefsTotal,
    childRefsResolved,
    childRefsUnmatched,
    relationsCreated,
    relationsActivated,
    relationsDeactivated,
    unmatchedChildNames,
  };
}

async function applyRecords(input: {
  records: NormalizedUserRecord[];
  runId: string;
  requestedDate: string;
}): Promise<{
  personsTouched: number;
  csvParentChildRelations: CsvParentChildRelationSyncStats;
}> {
  const records = input.records;
  const touchedPersonIds = new Set<string>();
  const touchedIdentityIds = new Set<string>();
  const seenBySource = new Map<SourceType, Set<string>>();
  const studentRecordByPerson = new Map<string, NormalizedUserRecord>();

  for (const record of records) {
    if (!seenBySource.has(record.sourceType)) {
      seenBySource.set(record.sourceType, new Set<string>());
    }
    seenBySource.get(record.sourceType)!.add(record.sourceKey);

    const { personId, identityId } = await upsertNormalizedRecord(record);
    touchedPersonIds.add(personId);
    if (record.sourceType === "edookit_student") {
      const preferred = pickPreferredStudentRecord(studentRecordByPerson.get(personId), record);
      studentRecordByPerson.set(personId, preferred);
    }
    if (identityId) touchedIdentityIds.add(identityId);
  }

  for (const [sourceType, sourceKeys] of seenBySource.entries()) {
    const staleRecords = await prisma.appPersonSourceRecord.findMany({
      where: {
        sourceType,
        activeSource: true,
        sourceKey: {
          notIn: [...sourceKeys],
        },
      },
      select: {
        personId: true,
      },
    });
    if (staleRecords.length > 0) {
      await prisma.appPersonSourceRecord.updateMany({
        where: {
          sourceType,
          activeSource: true,
          sourceKey: {
            notIn: [...sourceKeys],
          },
        },
        data: {
          activeSource: false,
          syncedAt: new Date(),
        },
      });
      staleRecords.forEach((row) => touchedPersonIds.add(row.personId));
    }
  }

  for (const personId of touchedPersonIds) {
    await recomputePersonRolesAndActivity(personId);
  }

  const studyModeMap = await loadStudyModeMap();
  const schoolYearId = await findSchoolYearIdForDate(input.requestedDate);
  for (const personId of touchedPersonIds) {
    await syncStudentStateForPerson({
      personId,
      preferredRecord: studentRecordByPerson.get(personId),
      modeByCode: studyModeMap,
      runId: input.runId,
      schoolYearId,
    });
  }

  for (const identityId of touchedIdentityIds) {
    await reconcileIdentityLinks(identityId);
    await refreshIdentityConflict(identityId);
  }

  const csvParentChildRelations = await syncCsvParentChildRelations();

  return {
    personsTouched: touchedPersonIds.size,
    csvParentChildRelations,
  };
}

export async function syncUsers(options: SyncUsersOptions = {}): Promise<SyncUsersResult> {
  const mode = options.mode ?? "daily";
  const date = normalizeDate(options.date ?? (mode === "initial" ? DEFAULT_INITIAL_SYNC_DATE : currentDateIso()));
  const includeInactiveSince = normalizeDate(options.includeInactiveSince ?? DEFAULT_INITIAL_SYNC_DATE);

  const run = await prisma.appUserSyncRun.create({
    data: {
      source: "edookit",
      runType: mode,
      requestedDate: date,
      includeInactiveSince,
      status: "running",
    },
  });

  try {
    const studentPath = `/api/student-data/v1/list/${date}?include-inactive-since=${includeInactiveSince}`;
    const employeePath = `/api/employee-data/v1/list/${date}?include-inactive-since=${includeInactiveSince}`;

    const [students, employees] = await Promise.all([
      fetchEdookitArray<EdookitStudent>(studentPath, "Students"),
      fetchEdookitArray<EdookitEmployee>(employeePath, "Employees"),
    ]);

    const studentRecords = students.map((row) => normalizeStudentRecord(row, date));
    const employeeRecords = employees.map((row) => normalizeEmployeeRecord(row, date));
    const csvRecords = options.csvPath ? readCsvParents(options.csvPath) : [];
    const allRecords = [...studentRecords, ...employeeRecords, ...csvRecords];

    const applied = await applyRecords({
      records: allRecords,
      runId: run.id,
      requestedDate: date,
    });
    const codaNickname = options.mapCodaNicknames ? await syncCodaNicknames() : undefined;

    await prisma.appUserSyncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        studentsCount: students.length,
        employeesCount: employees.length,
        csvCount: csvRecords.length,
        personsTouched: applied.personsTouched,
        finishedAt: new Date(),
      },
    });

    return {
      runId: run.id,
      mode,
      date,
      includeInactiveSince,
      studentsCount: students.length,
      employeesCount: employees.length,
      csvCount: csvRecords.length,
      personsTouched: applied.personsTouched,
      codaNickname,
      csvParentChildRelations: applied.csvParentChildRelations,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.appUserSyncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: message,
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function getUserSyncRuns(limit = 20) {
  return prisma.appUserSyncRun.findMany({
    orderBy: {
      startedAt: "desc",
    },
    take: limit,
  });
}

export async function getIdentityConflicts(limit = 50) {
  return prisma.appIdentityConflict.findMany({
    where: {
      status: "open",
      reason: "MULTI_PERSON_IDENTITY",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    include: {
      identity: {
        include: {
          personLinks: {
            where: {
              status: {
                in: ["pending", "approved"],
              },
            },
            include: {
              person: {
                include: {
                  roles: {
                    where: {
                      isActive: true,
                    },
                  },
                  sourceRecords: {
                    where: {
                      activeSource: true,
                    },
                    orderBy: {
                      syncedAt: "desc",
                    },
                    take: 1,
                    select: {
                      sourceType: true,
                      primaryEmail: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function resolveIdentityConflict(
  identityId: string,
  approvedPersonIds: string[],
  resolvedBy: string
) {
  const approvedSet = new Set(approvedPersonIds.filter(Boolean));
  if (approvedSet.size === 0) {
    throw new Error("At least one person must be approved.");
  }

  await prisma.$transaction(async (tx) => {
    const links = await tx.appLoginPersonLink.findMany({
      where: { identityId },
      select: { id: true, personId: true },
    });
    if (links.length === 0) {
      throw new Error("Identity links not found.");
    }

    for (const link of links) {
      if (approvedSet.has(link.personId)) {
        await tx.appLoginPersonLink.update({
          where: { id: link.id },
          data: {
            status: "approved",
            approvedBy: resolvedBy,
            approvedAt: new Date(),
            reason: null,
          },
        });
      } else {
        await tx.appLoginPersonLink.update({
          where: { id: link.id },
          data: {
            status: "rejected",
            approvedBy: null,
            approvedAt: null,
            reason: `rejected_by:${resolvedBy}`,
          },
        });
      }
    }
  });

  await refreshIdentityConflict(identityId);
}

export async function approveIdentityLink(identityId: string, personId: string, approvedBy: string) {
  const result = await prisma.appLoginPersonLink.update({
    where: {
      identityId_personId: {
        identityId,
        personId,
      },
    },
    data: {
      status: "approved",
      approvedBy,
      approvedAt: new Date(),
      reason: null,
    },
  });
  await refreshIdentityConflict(identityId);
  return result;
}
