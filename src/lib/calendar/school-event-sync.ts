import { createHash, createSign, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  AppCalendarBehavior,
  AppCalendarSyncJobStatus,
  AppCalendarSyncJobType,
  AppCalendarTarget,
  AppSchoolEventLifecycleStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/src/lib/prisma";

type CalendarTargetType = "student" | "group";

interface SchoolEventSyncPayload {
  kind: "school_event";
  schoolEventId: string;
  sourceRef?: string | null;
}

function asSchoolEventSyncPayload(value: unknown): SchoolEventSyncPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid job payload: expected object.");
  }
  const obj = value as Record<string, unknown>;
  if (obj.kind !== "school_event") {
    throw new Error("Invalid job payload: kind must be 'school_event'.");
  }
  if (typeof obj.schoolEventId !== "string" || !obj.schoolEventId.trim()) {
    throw new Error("Invalid job payload: missing schoolEventId.");
  }
  return {
    kind: "school_event",
    schoolEventId: obj.schoolEventId.trim(),
    sourceRef: typeof obj.sourceRef === "string" ? obj.sourceRef : null,
  };
}

interface EnqueueTarget {
  targetType: CalendarTargetType;
  targetId: string;
  providerConfigId: string;
}

export interface EnqueueSchoolEventSyncParams {
  schoolEventId: string;
  sourceRef?: string | null;
  priority?: number;
  runAfter?: Date;
}

export interface EnqueueSchoolEventSyncResult {
  schoolEventId: string;
  matchedTargets: number;
  jobsCreated: number;
  jobsSkippedAsDuplicate: number;
  reason?: string;
}

interface GoogleCredentials {
  clientEmail: string;
  privateKey: string;
}

interface CalendarWriteTarget {
  targetType: CalendarTargetType;
  studentCalendarId: string | null;
  groupCalendarId: string | null;
  calendarId: string;
  providerConfig: {
    id: string;
    impersonatedUserEmail: string;
    serviceAccountEmail: string;
    metadata: unknown;
  };
}

interface CalendarSyncExecutionResult {
  operation: "upsert" | "cancel";
  sourceType: string;
  sourceKey: string;
  googleEventId: string | null;
}

function asJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizePrivateKey(privateKey: string): string {
  return privateKey.includes("\\n") ? privateKey.replace(/\\n/g, "\n") : privateKey;
}

function sha256(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function stableLessonSourceKey(lessonId: number | null, lessonDate: Date | null): string | null {
  if (!lessonId) return null;
  const datePart = lessonDate ? lessonDate.toISOString().slice(0, 10) : "na";
  return `lesson:${lessonId}:${datePart}`;
}

function extractPrivateKeyFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata as Record<string, unknown>;
  const raw =
    value.privateKey ??
    value.private_key ??
    value.serviceAccountPrivateKey ??
    value.googlePrivateKey ??
    null;
  if (!raw) return null;
  return normalizePrivateKey(String(raw));
}

function loadGoogleCredentials(providerConfig: {
  serviceAccountEmail: string;
  metadata: unknown;
}): GoogleCredentials {
  const fromJsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (fromJsonEnv) {
    const parsed = JSON.parse(fromJsonEnv) as Record<string, unknown>;
    const clientEmail = String(parsed.client_email ?? "").trim();
    const privateKey = normalizePrivateKey(String(parsed.private_key ?? ""));
    if (clientEmail && privateKey) {
      return { clientEmail, privateKey };
    }
  }

  const fromFile = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
  if (fromFile) {
    const parsed = JSON.parse(readFileSync(fromFile, "utf8")) as Record<string, unknown>;
    const clientEmail = String(parsed.client_email ?? "").trim();
    const privateKey = normalizePrivateKey(String(parsed.private_key ?? ""));
    if (clientEmail && privateKey) {
      return { clientEmail, privateKey };
    }
  }

  const privateKeyFromMetadata = extractPrivateKeyFromMetadata(providerConfig.metadata);
  if (privateKeyFromMetadata) {
    return {
      clientEmail: providerConfig.serviceAccountEmail,
      privateKey: privateKeyFromMetadata,
    };
  }

  const privateKeyFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (privateKeyFromEnv) {
    return {
      clientEmail: providerConfig.serviceAccountEmail,
      privateKey: normalizePrivateKey(privateKeyFromEnv),
    };
  }

  throw new Error(
    "Missing Google service account private key. Configure GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
  );
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

async function getGoogleAccessToken(target: CalendarWriteTarget): Promise<string> {
  const credentials = loadGoogleCredentials(target.providerConfig);
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.clientEmail,
    sub: target.providerConfig.impersonatedUserEmail,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(credentials.privateKey, "base64url");
  const assertion = `${signingInput}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token request failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Google token request returned no access_token.");
  }
  return json.access_token;
}

async function googleCalendarRequest<T>(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Calendar API ${method} ${path} failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return null as T;
  }
  return (await response.json()) as T;
}

function eventToGooglePayload(event: {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  timezone: string;
  sourceRef: string | null;
  updatedAt: Date;
  linkedLessonId: number | null;
  linkedLessonDate: Date | null;
  eventType: { calendarBehavior: AppCalendarBehavior };
}): Record<string, unknown> {
  const timezone = event.timezone || "Europe/Prague";
  const lessonSourceKey = stableLessonSourceKey(event.linkedLessonId, event.linkedLessonDate);

  const start = event.allDay
    ? { date: event.startsAt.toISOString().slice(0, 10) }
    : { dateTime: event.startsAt.toISOString(), timeZone: timezone };
  const end = event.allDay
    ? { date: event.endsAt.toISOString().slice(0, 10) }
    : { dateTime: event.endsAt.toISOString(), timeZone: timezone };

  return {
    summary: event.title,
    description: event.description ?? "",
    location: event.location ?? "",
    start,
    end,
    extendedProperties: {
      private: {
        sv_source_type: "school_event",
        sv_source_key: event.id,
        sv_school_event_id: event.id,
        sv_calendar_behavior: event.eventType.calendarBehavior,
        sv_source_ref: event.sourceRef ?? "",
        sv_revision: event.updatedAt.toISOString(),
        ...(lessonSourceKey ? { sv_lesson_source_key: lessonSourceKey } : {}),
      },
    },
  };
}

async function findExistingLinkForEvent(
  tx: Prisma.TransactionClient,
  target: CalendarWriteTarget,
  schoolEventId: string,
): Promise<{
  id: string;
  googleEventId: string;
  sourceType: string;
  sourceKey: string;
  status: string;
} | null> {
  return tx.appCalendarEventLink.findFirst({
    where: {
      sourceType: "school_event",
      sourceKey: schoolEventId,
      studentCalendarId: target.studentCalendarId ?? undefined,
      groupCalendarId: target.groupCalendarId ?? undefined,
    },
    select: {
      id: true,
      googleEventId: true,
      sourceType: true,
      sourceKey: true,
      status: true,
    },
  });
}

async function findLinkedLessonEventIfAny(
  tx: Prisma.TransactionClient,
  target: CalendarWriteTarget,
  event: {
    linkedLessonId: number | null;
    linkedLessonDate: Date | null;
    eventType: { calendarBehavior: AppCalendarBehavior };
  },
): Promise<{ googleEventId: string; sourceType: string; sourceKey: string } | null> {
  if (event.eventType.calendarBehavior !== AppCalendarBehavior.UPDATE_LINKED_LESSON) return null;
  const lessonSourceKey = stableLessonSourceKey(event.linkedLessonId, event.linkedLessonDate);
  if (!lessonSourceKey) return null;

  return tx.appCalendarEventLink.findFirst({
    where: {
      sourceType: "lesson",
      sourceKey: lessonSourceKey,
      studentCalendarId: target.studentCalendarId ?? undefined,
      groupCalendarId: target.groupCalendarId ?? undefined,
      status: "ACTIVE",
    },
    select: {
      googleEventId: true,
      sourceType: true,
      sourceKey: true,
    },
  });
}

async function upsertCalendarEventLink(
  tx: Prisma.TransactionClient,
  target: CalendarWriteTarget,
  input: {
    schoolEventId: string;
    googleEventId: string;
    googleICalUid: string | null;
    googleEtag: string | null;
    sourceRevision: string | null;
    sourceStartsAt: Date;
    sourceEndsAt: Date;
    payloadHash: string;
  },
): Promise<void> {
  const where = target.studentCalendarId
    ? {
        studentCalendarId_sourceType_sourceKey: {
          studentCalendarId: target.studentCalendarId,
          sourceType: "school_event",
          sourceKey: input.schoolEventId,
        },
      }
    : {
        groupCalendarId_sourceType_sourceKey: {
          groupCalendarId: target.groupCalendarId as string,
          sourceType: "school_event",
          sourceKey: input.schoolEventId,
        },
      };

  await tx.appCalendarEventLink.upsert({
    where,
    create: {
      sourceType: "school_event",
      sourceKey: input.schoolEventId,
      sourceRevision: input.sourceRevision ?? undefined,
      sourceStartsAt: input.sourceStartsAt,
      sourceEndsAt: input.sourceEndsAt,
      studentCalendarId: target.studentCalendarId ?? undefined,
      groupCalendarId: target.groupCalendarId ?? undefined,
      schoolEventId: input.schoolEventId,
      googleEventId: input.googleEventId,
      googleICalUid: input.googleICalUid ?? undefined,
      googleEtag: input.googleEtag ?? undefined,
      payloadHash: input.payloadHash,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
    },
    update: {
      sourceRevision: input.sourceRevision ?? undefined,
      sourceStartsAt: input.sourceStartsAt,
      sourceEndsAt: input.sourceEndsAt,
      schoolEventId: input.schoolEventId,
      googleEventId: input.googleEventId,
      googleICalUid: input.googleICalUid ?? undefined,
      googleEtag: input.googleEtag ?? undefined,
      payloadHash: input.payloadHash,
      status: "ACTIVE",
      canceledAt: null,
      lastSyncedAt: new Date(),
    },
  });
}

async function cancelCalendarEventLink(
  tx: Prisma.TransactionClient,
  linkId: string,
): Promise<void> {
  await tx.appCalendarEventLink.update({
    where: { id: linkId },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
      lastSyncedAt: new Date(),
    },
  });
}

async function syncSchoolEventToGoogle(
  payload: SchoolEventSyncPayload,
  target: CalendarWriteTarget,
): Promise<CalendarSyncExecutionResult> {
  const event = await prisma.appSchoolEvent.findUnique({
    where: { id: payload.schoolEventId },
    include: {
      eventType: true,
    },
  });
  if (!event) {
    throw new Error(`Akce '${payload.schoolEventId}' neexistuje.`);
  }

  const existingLink = await prisma.$transaction((tx) =>
    findExistingLinkForEvent(tx, target, payload.schoolEventId),
  );

  const shouldCancel =
    !event.isActive ||
    event.lifecycleStatus === AppSchoolEventLifecycleStatus.CANCELED ||
    event.lifecycleStatus === AppSchoolEventLifecycleStatus.ARCHIVED;

  const accessToken = await getGoogleAccessToken(target);

  if (shouldCancel) {
    if (existingLink) {
      await googleCalendarRequest<void>(
        accessToken,
        "DELETE",
        `/calendars/${encodeURIComponent(target.calendarId)}/events/${encodeURIComponent(existingLink.googleEventId)}`,
      );
      await prisma.$transaction((tx) => cancelCalendarEventLink(tx, existingLink.id));
    }
    return {
      operation: "cancel",
      sourceType: "school_event",
      sourceKey: payload.schoolEventId,
      googleEventId: existingLink?.googleEventId ?? null,
    };
  }

  const googlePayload = eventToGooglePayload(event);
  const payloadHash = sha256(googlePayload);

  const lessonLink =
    event.eventType.calendarBehavior === AppCalendarBehavior.UPDATE_LINKED_LESSON
      ? await prisma.$transaction((tx) => findLinkedLessonEventIfAny(tx, target, event))
      : null;

  const eventIdToUpdate = lessonLink?.googleEventId ?? existingLink?.googleEventId ?? null;
  const googleEvent = eventIdToUpdate
    ? await googleCalendarRequest<{
        id: string;
        iCalUID?: string;
        etag?: string;
      }>(
        accessToken,
        "PUT",
        `/calendars/${encodeURIComponent(target.calendarId)}/events/${encodeURIComponent(eventIdToUpdate)}`,
        googlePayload,
      )
    : await googleCalendarRequest<{
        id: string;
        iCalUID?: string;
        etag?: string;
      }>(
        accessToken,
        "POST",
        `/calendars/${encodeURIComponent(target.calendarId)}/events`,
        googlePayload,
      );

  await prisma.$transaction((tx) =>
    upsertCalendarEventLink(tx, target, {
      schoolEventId: payload.schoolEventId,
      googleEventId: googleEvent.id,
      googleICalUid: googleEvent.iCalUID ?? null,
      googleEtag: googleEvent.etag ?? null,
      sourceRevision: event.updatedAt.toISOString(),
      sourceStartsAt: event.startsAt,
      sourceEndsAt: event.endsAt,
      payloadHash,
    }),
  );

  return {
    operation: "upsert",
    sourceType: lessonLink?.sourceType ?? "school_event",
    sourceKey: lessonLink?.sourceKey ?? payload.schoolEventId,
    googleEventId: googleEvent.id,
  };
}

async function resolveAudiencePersonIds(schoolEventId: string): Promise<string[]> {
  const latestBatch = await prisma.appSchoolEventAudienceSnapshotBatch.findFirst({
    where: { schoolEventId },
    orderBy: [{ snapshotAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      items: {
        select: { personId: true },
      },
    },
  });

  if (latestBatch && latestBatch.items.length > 0) {
    return [...new Set(latestBatch.items.map((item) => item.personId))];
  }

  const directTargets = await prisma.appSchoolEventTarget.findMany({
    where: { schoolEventId, targetType: "PERSON" },
    select: { personId: true },
  });
  const direct = directTargets.map((row) => row.personId).filter(Boolean) as string[];

  const groupTargets = await prisma.appSchoolEventTarget.findMany({
    where: { schoolEventId, targetType: "GROUP" },
    select: { groupKind: true, groupCode: true },
  });

  if (groupTargets.length === 0) {
    return [...new Set(direct)];
  }

  const groupPairs = groupTargets
    .filter((g) => g.groupKind && g.groupCode)
    .map((g) => ({ kind: g.groupKind as string, code: g.groupCode as string }));
  if (groupPairs.length === 0) {
    return [...new Set(direct)];
  }

  const schoolLevelPairs = groupPairs
    .map((pair) => ({ kind: pair.kind.toLowerCase(), code: Number(pair.code) }))
    .filter((pair) => (pair.kind === "rocnik" || pair.kind === "stupen") && Number.isInteger(pair.code));
  const dbGroupPairs = groupPairs.filter((pair) => {
    const kind = pair.kind.toLowerCase();
    return kind !== "rocnik" && kind !== "stupen";
  });

  const peopleFromGroups = dbGroupPairs.length === 0
    ? []
    : await prisma.$queryRaw<Array<{ person_id: string }>>(Prisma.sql`
        SELECT DISTINCT gm.person_id
        FROM app_group_membership gm
        JOIN app_group g ON g.id = gm.group_id
        JOIN app_person p ON p.id = gm.person_id
        WHERE p.is_active = TRUE
          AND g.is_active = TRUE
          AND (gm.valid_from IS NULL OR gm.valid_from <= NOW())
          AND (gm.valid_to IS NULL OR gm.valid_to > NOW())
          AND (g.valid_from IS NULL OR g.valid_from <= NOW())
          AND (g.valid_to IS NULL OR g.valid_to > NOW())
          AND (lower(g.kind::text), lower(g.code)) IN (${Prisma.join(
            dbGroupPairs.map((pair) => Prisma.sql`(${pair.kind.toLowerCase()}, ${pair.code.toLowerCase()})`),
          )})
      `);

  const peopleFromSchoolLevels = schoolLevelPairs.length === 0
    ? []
    : await prisma.$queryRaw<Array<{ person_id: string }>>(Prisma.sql`
        WITH target_groups(kind, code) AS (
          VALUES ${Prisma.join(
            schoolLevelPairs.map((pair) => Prisma.sql`(CAST(${pair.kind} AS text), CAST(${pair.code} AS int))`),
          )}
        ),
        student_grades AS (
          SELECT
            sr.person_id,
            (sr.payload->>'CurrentGradeNum')::int AS rocnik
          FROM app_person_source_record sr
          JOIN app_person p ON p.id = sr.person_id
          WHERE sr.active_source = TRUE
            AND sr.derived_roles @> ARRAY['zak']::text[]
            AND p.is_active = TRUE
            AND (sr.payload->>'CurrentGradeNum') ~ '^[0-9]+$'
        )
        SELECT DISTINCT sg.person_id
        FROM student_grades sg
        JOIN target_groups tg ON (
          (tg.kind = 'rocnik' AND sg.rocnik = tg.code)
          OR (
            tg.kind = 'stupen'
            AND (
              (tg.code = 1 AND sg.rocnik BETWEEN 1 AND 5)
              OR (tg.code = 2 AND sg.rocnik BETWEEN 6 AND 9)
            )
          )
        )
      `);

  return [...new Set([
    ...direct,
    ...peopleFromGroups.map((row) => row.person_id),
    ...peopleFromSchoolLevels.map((row) => row.person_id),
  ])];
}

async function resolveGroupCalendarTargetsForEvent(schoolEventId: string): Promise<EnqueueTarget[]> {
  const ruleGroups = await prisma.appSchoolEventAudienceRule.findMany({
    where: {
      schoolEventId,
      isActive: true,
      ruleType: "GROUP",
    },
    select: { groupKind: true, groupCode: true },
  });

  const targetGroups = await prisma.appSchoolEventTarget.findMany({
    where: {
      schoolEventId,
      targetType: "GROUP",
    },
    select: { groupKind: true, groupCode: true },
  });

  const keySet = new Set<string>();
  for (const row of [...ruleGroups, ...targetGroups]) {
    if (!row.groupKind || !row.groupCode) continue;
    keySet.add(`${row.groupKind.toLowerCase()}::${row.groupCode.toLowerCase()}`);
  }

  if (keySet.size === 0) return [];

  const pairs = [...keySet].map((value) => {
    const [kind, code] = value.split("::");
    return { kind, code };
  });

  const calendars = await prisma.$queryRaw<
    Array<{ id: string; provider_config_id: string }>
  >(Prisma.sql`
    SELECT gc.id, gc.provider_config_id
    FROM app_group_calendar gc
    WHERE gc.is_active = TRUE
      AND gc.sync_enabled = TRUE
      AND (lower(gc.group_kind), lower(gc.group_code)) IN (${Prisma.join(
        pairs.map((pair) => Prisma.sql`(${pair.kind}, ${pair.code})`),
      )})
  `);

  return calendars.map((row) => ({
    targetType: "group",
    targetId: row.id,
    providerConfigId: row.provider_config_id,
  }));
}

async function resolveStudentCalendarTargetsForPeople(personIds: string[]): Promise<EnqueueTarget[]> {
  if (personIds.length === 0) return [];
  const calendars = await prisma.appStudentCalendar.findMany({
    where: {
      personId: { in: personIds },
      isActive: true,
      syncEnabled: true,
    },
    select: {
      id: true,
      providerConfigId: true,
    },
  });
  return calendars.map((row) => ({
    targetType: "student",
    targetId: row.id,
    providerConfigId: row.providerConfigId,
  }));
}

function dedupeTargets(targets: EnqueueTarget[]): EnqueueTarget[] {
  const map = new Map<string, EnqueueTarget>();
  for (const target of targets) {
    const key = `${target.targetType}:${target.targetId}`;
    if (!map.has(key)) map.set(key, target);
  }
  return [...map.values()];
}

async function hasPendingOrRunningJobForTarget(
  target: EnqueueTarget,
  schoolEventId: string,
): Promise<boolean> {
  const where =
    target.targetType === "student"
      ? {
          jobType: AppCalendarSyncJobType.UPSERT_SCHOOL_EVENT,
          status: {
            in: [AppCalendarSyncJobStatus.PENDING, AppCalendarSyncJobStatus.RUNNING],
          },
          studentCalendarId: target.targetId,
          payload: {
            path: ["schoolEventId"],
            equals: schoolEventId,
          },
        }
      : {
          jobType: AppCalendarSyncJobType.UPSERT_SCHOOL_EVENT,
          status: {
            in: [AppCalendarSyncJobStatus.PENDING, AppCalendarSyncJobStatus.RUNNING],
          },
          groupCalendarId: target.targetId,
          payload: {
            path: ["schoolEventId"],
            equals: schoolEventId,
          },
        };

  const existing = await prisma.appCalendarSyncJob.findFirst({
    where,
    select: { id: true },
  });
  return Boolean(existing);
}

export async function enqueueSchoolEventCalendarSyncJobs(
  params: EnqueueSchoolEventSyncParams,
): Promise<EnqueueSchoolEventSyncResult> {
  const event = await prisma.appSchoolEvent.findUnique({
    where: { id: params.schoolEventId },
    include: {
      eventType: true,
    },
  });
  if (!event) {
    throw new Error(`Akce '${params.schoolEventId}' neexistuje.`);
  }

  if (event.eventType.calendarBehavior === AppCalendarBehavior.NONE) {
    return {
      schoolEventId: params.schoolEventId,
      matchedTargets: 0,
      jobsCreated: 0,
      jobsSkippedAsDuplicate: 0,
      reason: "calendar_behavior=NONE",
    };
  }

  const targetDefs: EnqueueTarget[] = [];
  if (event.eventType.calendarTarget === AppCalendarTarget.STUDENT || event.eventType.calendarTarget === AppCalendarTarget.BOTH) {
    const people = await resolveAudiencePersonIds(params.schoolEventId);
    targetDefs.push(...(await resolveStudentCalendarTargetsForPeople(people)));
  }
  if (event.eventType.calendarTarget === AppCalendarTarget.GROUP || event.eventType.calendarTarget === AppCalendarTarget.BOTH) {
    targetDefs.push(...(await resolveGroupCalendarTargetsForEvent(params.schoolEventId)));
  }

  const targets = dedupeTargets(targetDefs);
  let jobsCreated = 0;
  let jobsSkippedAsDuplicate = 0;

  const payload: SchoolEventSyncPayload = {
    kind: "school_event",
    schoolEventId: params.schoolEventId,
    sourceRef: params.sourceRef ?? null,
  };

  for (const target of targets) {
    const duplicate = await hasPendingOrRunningJobForTarget(target, params.schoolEventId);
    if (duplicate) {
      jobsSkippedAsDuplicate += 1;
      continue;
    }

    await prisma.appCalendarSyncJob.create({
      data: {
        providerConfigId: target.providerConfigId,
        studentCalendarId: target.targetType === "student" ? target.targetId : undefined,
        groupCalendarId: target.targetType === "group" ? target.targetId : undefined,
        jobType: AppCalendarSyncJobType.UPSERT_SCHOOL_EVENT,
        status: AppCalendarSyncJobStatus.PENDING,
        priority: params.priority ?? 100,
        runAfter: params.runAfter ?? new Date(),
        payload: asJsonValue(payload),
      },
    });
    jobsCreated += 1;
  }

  return {
    schoolEventId: params.schoolEventId,
    matchedTargets: targets.length,
    jobsCreated,
    jobsSkippedAsDuplicate,
  };
}

interface LeasedJob {
  id: string;
  lockToken: string;
}

async function leaseNextPendingSyncJob(workerName: string): Promise<LeasedJob | null> {
  for (let i = 0; i < 3; i += 1) {
    const candidate = await prisma.appCalendarSyncJob.findFirst({
      where: {
        status: AppCalendarSyncJobStatus.PENDING,
        runAfter: { lte: new Date() },
      },
      orderBy: [{ priority: "asc" }, { runAfter: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!candidate) return null;

    const lockToken = randomUUID();
    const updated = await prisma.appCalendarSyncJob.updateMany({
      where: {
        id: candidate.id,
        status: AppCalendarSyncJobStatus.PENDING,
      },
      data: {
        status: AppCalendarSyncJobStatus.RUNNING,
        startedAt: new Date(),
        attempts: { increment: 1 },
        lockToken,
        lockedBy: workerName,
        lastError: null,
      },
    });

    if (updated.count === 1) {
      return { id: candidate.id, lockToken };
    }
  }
  return null;
}

function nextRetryDelayMs(attempts: number): number {
  const exp = Math.min(2 ** Math.max(attempts - 1, 0), 360);
  return exp * 60 * 1000;
}

async function failJobWithRetry(
  jobId: string,
  lockToken: string,
  attempts: number,
  maxAttempts: number,
  errorMessage: string,
): Promise<"retry" | "failed"> {
  if (attempts >= maxAttempts) {
    await prisma.appCalendarSyncJob.updateMany({
      where: { id: jobId, lockToken, status: AppCalendarSyncJobStatus.RUNNING },
      data: {
        status: AppCalendarSyncJobStatus.FAILED,
        finishedAt: new Date(),
        lastError: errorMessage.slice(0, 2000),
      },
    });
    return "failed";
  }

  const retryAfter = new Date(Date.now() + nextRetryDelayMs(attempts));
  await prisma.appCalendarSyncJob.updateMany({
    where: { id: jobId, lockToken, status: AppCalendarSyncJobStatus.RUNNING },
    data: {
      status: AppCalendarSyncJobStatus.PENDING,
      runAfter: retryAfter,
      lastError: errorMessage.slice(0, 2000),
      lockToken: null,
      lockedBy: null,
      startedAt: null,
    },
  });
  return "retry";
}

async function markJobCompleted(jobId: string, lockToken: string): Promise<void> {
  await prisma.appCalendarSyncJob.updateMany({
    where: { id: jobId, lockToken, status: AppCalendarSyncJobStatus.RUNNING },
    data: {
      status: AppCalendarSyncJobStatus.COMPLETED,
      finishedAt: new Date(),
      lockToken: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

async function getWriteTargetForJob(job: {
  studentCalendarId: string | null;
  groupCalendarId: string | null;
}): Promise<CalendarWriteTarget> {
  if (job.studentCalendarId) {
    const calendar = await prisma.appStudentCalendar.findUnique({
      where: { id: job.studentCalendarId },
      include: {
        providerConfig: true,
      },
    });
    if (!calendar) throw new Error(`Student calendar '${job.studentCalendarId}' neexistuje.`);
    return {
      targetType: "student",
      studentCalendarId: calendar.id,
      groupCalendarId: null,
      calendarId: calendar.calendarId,
      providerConfig: {
        id: calendar.providerConfig.id,
        impersonatedUserEmail: calendar.providerConfig.impersonatedUserEmail,
        serviceAccountEmail: calendar.providerConfig.serviceAccountEmail,
        metadata: calendar.providerConfig.metadata,
      },
    };
  }

  if (job.groupCalendarId) {
    const calendar = await prisma.appGroupCalendar.findUnique({
      where: { id: job.groupCalendarId },
      include: {
        providerConfig: true,
      },
    });
    if (!calendar) throw new Error(`Group calendar '${job.groupCalendarId}' neexistuje.`);
    return {
      targetType: "group",
      studentCalendarId: null,
      groupCalendarId: calendar.id,
      calendarId: calendar.calendarId,
      providerConfig: {
        id: calendar.providerConfig.id,
        impersonatedUserEmail: calendar.providerConfig.impersonatedUserEmail,
        serviceAccountEmail: calendar.providerConfig.serviceAccountEmail,
        metadata: calendar.providerConfig.metadata,
      },
    };
  }

  throw new Error("Sync job nemá cílový kalendář.");
}

export interface ProcessSyncJobsParams {
  limit?: number;
  workerName?: string;
}

export interface ProcessSyncJobsResult {
  workerName: string;
  processed: number;
  completed: number;
  retried: number;
  failed: number;
  details: Array<{
    jobId: string;
    status: "completed" | "retry" | "failed";
    message: string;
  }>;
}

export async function processCalendarSyncJobs(
  params: ProcessSyncJobsParams = {},
): Promise<ProcessSyncJobsResult> {
  const workerName = params.workerName?.trim() || `calendar-worker:${randomUUID().slice(0, 8)}`;
  const limit = Math.max(1, Math.min(params.limit ?? 10, 100));

  let processed = 0;
  let completed = 0;
  let retried = 0;
  let failed = 0;
  const details: ProcessSyncJobsResult["details"] = [];

  while (processed < limit) {
    const leased = await leaseNextPendingSyncJob(workerName);
    if (!leased) break;

    processed += 1;
    const job = await prisma.appCalendarSyncJob.findUnique({
      where: { id: leased.id },
      select: {
        id: true,
        attempts: true,
        maxAttempts: true,
        jobType: true,
        studentCalendarId: true,
        groupCalendarId: true,
        payload: true,
      },
    });
    if (!job) {
      continue;
    }

    try {
      if (job.jobType !== AppCalendarSyncJobType.UPSERT_SCHOOL_EVENT) {
        throw new Error(`Unsupported job type '${job.jobType}'.`);
      }

      const payload = asSchoolEventSyncPayload(job.payload);

      const target = await getWriteTargetForJob(job);
      const execution = await syncSchoolEventToGoogle(payload, target);

      await prisma.appCalendarSyncJob.updateMany({
        where: { id: job.id, lockToken: leased.lockToken, status: AppCalendarSyncJobStatus.RUNNING },
        data: {
          payload: asJsonValue({
            ...(job.payload as Record<string, unknown>),
            lastExecution: {
              executedAt: new Date().toISOString(),
              ...execution,
            },
          }),
        },
      });

      await markJobCompleted(job.id, leased.lockToken);
      completed += 1;
      details.push({
        jobId: job.id,
        status: "completed",
        message: `${execution.operation}:${execution.googleEventId ?? "none"}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result = await failJobWithRetry(
        job.id,
        leased.lockToken,
        job.attempts,
        job.maxAttempts,
        message,
      );
      if (result === "retry") {
        retried += 1;
        details.push({ jobId: job.id, status: "retry", message });
      } else {
        failed += 1;
        details.push({ jobId: job.id, status: "failed", message });
      }
    }
  }

  return {
    workerName,
    processed,
    completed,
    retried,
    failed,
    details,
  };
}

export async function listCalendarSyncJobsForSchoolEvent(
  schoolEventId: string,
  limit = 200,
): Promise<
  Array<{
    id: string;
    jobType: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    runAfter: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
    studentCalendarId: string | null;
    groupCalendarId: string | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>
> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      job_type: string;
      status: string;
      attempts: number;
      max_attempts: number;
      run_after: Date;
      started_at: Date | null;
      finished_at: Date | null;
      student_calendar_id: string | null;
      group_calendar_id: string | null;
      last_error: string | null;
      created_at: Date;
      updated_at: Date;
    }>
  >(Prisma.sql`
    SELECT
      j.id,
      j.job_type,
      j.status,
      j.attempts,
      j.max_attempts,
      j.run_after,
      j.started_at,
      j.finished_at,
      j.student_calendar_id,
      j.group_calendar_id,
      j.last_error,
      j.created_at,
      j.updated_at
    FROM app_calendar_sync_job j
    WHERE j.job_type = 'UPSERT_SCHOOL_EVENT'
      AND j.payload ->> 'schoolEventId' = ${schoolEventId}
    ORDER BY j.created_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 500))}
  `);

  return rows.map((row) => ({
    id: row.id,
    jobType: row.job_type,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    runAfter: row.run_after,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    studentCalendarId: row.student_calendar_id,
    groupCalendarId: row.group_calendar_id,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
