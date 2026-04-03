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
}

type EdookitStudent = Record<string, unknown>;
type EdookitEmployee = Record<string, unknown>;

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
    if (roleNorm.includes("rodi")) derivedRoles.add(CSV_ROLE_PARENT);
    if (roleNorm.includes("administr")) derivedRoles.add(CSV_ROLE_ADMIN);
    if (derivedRoles.size === 0) derivedRoles.add(CSV_ROLE_PARENT);

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

  const person = await prisma.appPerson.upsert({
    where: { dedupKey: record.dedupKey },
    update: {
      displayName: record.displayName,
      firstName: record.firstName,
      middleName: record.middleName,
      lastName: record.lastName,
      ...(record.identifier ? { identifier: record.identifier } : {}),
      ...(record.plus4uId ? { plus4uId: record.plus4uId } : {}),
    },
    create: {
      dedupKey: record.dedupKey,
      displayName: record.displayName,
      firstName: record.firstName,
      middleName: record.middleName,
      lastName: record.lastName,
      identifier: record.identifier,
      plus4uId: record.plus4uId,
    },
  });

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

async function applyRecords(records: NormalizedUserRecord[]): Promise<{
  personsTouched: number;
}> {
  const touchedPersonIds = new Set<string>();
  const touchedIdentityIds = new Set<string>();
  const seenBySource = new Map<SourceType, Set<string>>();

  for (const record of records) {
    if (!seenBySource.has(record.sourceType)) {
      seenBySource.set(record.sourceType, new Set<string>());
    }
    seenBySource.get(record.sourceType)!.add(record.sourceKey);

    const { personId, identityId } = await upsertNormalizedRecord(record);
    touchedPersonIds.add(personId);
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

  for (const identityId of touchedIdentityIds) {
    await reconcileIdentityLinks(identityId);
    await refreshIdentityConflict(identityId);
  }

  return {
    personsTouched: touchedPersonIds.size,
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

    const applied = await applyRecords(allRecords);

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
