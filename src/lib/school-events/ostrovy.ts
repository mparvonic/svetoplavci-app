import { Prisma, type PrismaClient } from "@prisma/client";
import {
  AppSchoolEventAudienceRuleType,
  AppSchoolEventLifecycleStatus,
  AppSchoolEventOfferSelectionMode,
  AppSchoolEventRegistrationStatus,
  AppSchoolEventRegistrationWindowMode,
  AppSchoolEventTargetType,
  AppSchoolEventVisibility,
} from "@prisma/client";

import { enqueueSchoolEventCalendarSyncJobs } from "@/src/lib/calendar/school-event-sync";
import { prisma } from "@/src/lib/prisma";
import { assignKioskSlot } from "@/src/lib/kiosk";
import { upsertSchoolEventRegistration } from "@/src/lib/school-events/registration";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const OSTROVY_EVENT_TYPE_CODE = "OSTROVY";
export const OSTROVY_TIMEZONE = "Europe/Prague";

export const OSTROV_FOCUS_VALUES = [
  "pohybovy",
  "vytvarny",
  "hudebni",
  "badatelsky",
  "online-svet",
] as const;

export type OstrovFocus = (typeof OSTROV_FOCUS_VALUES)[number];

export interface OstrovyAudienceGroupInput {
  kind: string;
  code: string;
}

export interface OstrovyGuideInput {
  personId?: string | null;
  name?: string | null;
}

export interface CreateOstrovyTermInput {
  startsAt: string | Date;
  endsAt: string | Date;
  schoolYearCode?: string | null;
  description?: string | null;
  now?: Date;
}

export interface UpdateOstrovyTermInput {
  startsAt?: string | Date;
  endsAt?: string | Date;
  description?: string | null;
  now?: Date;
}

export type CancelOstrovyTermStrategy = "cancel_with_events" | "move_events";

export interface CancelOstrovyTermInput {
  strategy?: CancelOstrovyTermStrategy;
  targetTermId?: string | null;
  now?: Date;
}

export interface CreateOstrovInput {
  termId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  capacity?: number | null;
  registrationOpensAt?: string | Date | null;
  registrationClosesAt?: string | Date | null;
  audienceGroups?: OstrovyAudienceGroupInput[];
  focus?: OstrovFocus | null;
  thumbnailUrl?: string | null;
  thumbnailSourceImageUrl?: string | null;
  thumbnailSourceUrl?: string | null;
  guides?: OstrovyGuideInput[];
  schoolYearCode?: string | null;
  publish?: boolean;
}

export interface UpdateOstrovInput {
  termId?: string | null;
  title?: string;
  description?: string | null;
  location?: string | null;
  capacity?: number | null;
  registrationOpensAt?: string | Date | null;
  registrationClosesAt?: string | Date | null;
  audienceGroups?: OstrovyAudienceGroupInput[];
  focus?: OstrovFocus | null;
  thumbnailUrl?: string | null;
  thumbnailSourceImageUrl?: string | null;
  thumbnailSourceUrl?: string | null;
  guides?: OstrovyGuideInput[];
}

export interface RegisterOstrovInput {
  eventId: string;
  personId: string;
  actorPersonId?: string | null;
  actorRoles?: string[];
  allowTransfer?: boolean;
  allowGuideException?: boolean;
  exceptionReason?: string | null;
  note?: string | null;
  now?: Date;
  sourceRef?: string | null;
  enqueueCalendarSync?: boolean;
  waitForCalendarSync?: boolean;
}

export interface UnregisterOstrovInput {
  eventId: string;
  personId: string;
  actorPersonId?: string | null;
  actorRoles?: string[];
  allowGuideException?: boolean;
  exceptionReason?: string | null;
  note?: string | null;
  sourceRef?: string | null;
  enqueueCalendarSync?: boolean;
  waitForCalendarSync?: boolean;
}

const ACTIVE_REGISTRATION_STATUSES = [
  AppSchoolEventRegistrationStatus.REGISTERED,
  AppSchoolEventRegistrationStatus.WAITLIST,
];

function isActiveRegistrationStatus(status: AppSchoolEventRegistrationStatus): boolean {
  return (
    status === AppSchoolEventRegistrationStatus.REGISTERED ||
    status === AppSchoolEventRegistrationStatus.WAITLIST
  );
}

function ensureObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function parseDate(input: string | Date, field: string): Date {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${field}.`);
  }
  return date;
}

function shiftNullableDate(value: Date | null, deltaMs: number): Date | null {
  return value ? new Date(value.getTime() + deltaMs) : null;
}

function trimOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertDateRange(startsAt: Date, endsAt: Date): void {
  if (endsAt <= startsAt) {
    throw new Error("endsAt must be after startsAt.");
  }
}

function assertFutureStart(startsAt: Date, now: Date): void {
  if (startsAt <= now) {
    throw new Error("Term cannot start in the past.");
  }
}

function getTimeZoneParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday"),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedTimeToUtcDate(
  parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timeZone: string,
): Date {
  const hour = parts.hour ?? 0;
  const minute = parts.minute ?? 0;
  const second = parts.second ?? 0;
  let utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second);
  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
    utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second) - offset;
  }
  return new Date(utcMs);
}

function addDaysToYmd(parts: { year: number; month: number; day: number }, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function weekdayNumber(weekday: string): number {
  const map = new Map([
    ["Mon", 1],
    ["Tue", 2],
    ["Wed", 3],
    ["Thu", 4],
    ["Fri", 5],
    ["Sat", 6],
    ["Sun", 7],
  ]);
  return map.get(weekday) ?? 1;
}

export function formatPragueDate(date: Date): string {
  const parts = getTimeZoneParts(date, OSTROVY_TIMEZONE);
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

export function defaultOstrovRegistrationWindow(startsAt: Date): { opensAt: Date; closesAt: Date } {
  const event = getTimeZoneParts(startsAt, OSTROVY_TIMEZONE);
  const eventYmd = { year: event.year, month: event.month, day: event.day };
  const daysBackToPreviousMonday = weekdayNumber(event.weekday) - 1 + 7;
  const previousMonday = addDaysToYmd(eventYmd, -daysBackToPreviousMonday);
  const previousFriday = addDaysToYmd(previousMonday, 4);
  return {
    opensAt: zonedTimeToUtcDate({ ...previousMonday, hour: 0, minute: 0 }, OSTROVY_TIMEZONE),
    closesAt: zonedTimeToUtcDate({ ...previousFriday, hour: 18, minute: 0 }, OSTROVY_TIMEZONE),
  };
}

async function resolveSchoolYearId(code: string | null | undefined): Promise<string | null> {
  const trimmed = trimOptional(code);
  if (!trimmed) return null;
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM app_school_year
      WHERE code = ${trimmed}
      LIMIT 1
    `);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function getOstrovyEventTypeId(client: DbClient): Promise<string> {
  const eventType = await client.appSchoolEventType.findUnique({
    where: { code: OSTROVY_EVENT_TYPE_CODE },
    select: { id: true, isActive: true },
  });
  if (!eventType || !eventType.isActive) {
    throw new Error("School event type OSTROVY is not active.");
  }
  return eventType.id;
}

function termName(startsAt: Date): string {
  return `Ostrovy ${formatPragueDate(startsAt)}`;
}

async function findCollidingTerm(
  client: DbClient,
  startsAt: Date,
  endsAt: Date,
  ignoreTermId?: string | null,
): Promise<{ id: string; name: string } | null> {
  const row = await client.appSchoolEventOfferGroup.findFirst({
    where: {
      isActive: true,
      id: ignoreTermId ? { not: ignoreTermId } : undefined,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      OR: [
        { name: { startsWith: "Ostrovy" } },
        { code: { startsWith: "ostrovy-" } },
        {
          events: {
            some: {
              eventType: { code: OSTROVY_EVENT_TYPE_CODE },
              isActive: true,
            },
          },
        },
      ],
    },
    select: { id: true, name: true },
  });
  return row;
}

async function getActiveOstrovyEventsForTerm(client: DbClient, termId: string) {
  return client.appSchoolEvent.findMany({
    where: {
      offerGroupId: termId,
      eventType: { code: OSTROVY_EVENT_TYPE_CODE },
      isActive: true,
    },
    select: { id: true },
  });
}

async function enqueueChangedEvents(eventIds: string[], sourceRef: string): Promise<void> {
  await Promise.all(
    eventIds.map((schoolEventId) =>
      enqueueSchoolEventCalendarSyncJobs({ schoolEventId, sourceRef, priority: 80 }).catch(() => null),
    ),
  );
}

function sanitizeAudienceGroups(groups: OstrovyAudienceGroupInput[] | undefined): OstrovyAudienceGroupInput[] {
  const unique = new Map<string, OstrovyAudienceGroupInput>();
  for (const group of groups ?? []) {
    const kind = group.kind.trim().toLowerCase();
    const code = group.code.trim();
    if (!kind || !code) continue;
    unique.set(`${kind}:${code.toLowerCase()}`, { kind, code });
  }
  return [...unique.values()];
}

function parseFocus(value: OstrovFocus | null | undefined): OstrovFocus | null {
  if (!value) return null;
  return (OSTROV_FOCUS_VALUES as readonly string[]).includes(value) ? value : null;
}

function sanitizeGuides(guides: OstrovyGuideInput[] | undefined): Array<{ personId: string | null; name: string | null }> {
  return (guides ?? [])
    .map((guide) => ({
      personId: trimOptional(guide.personId),
      name: trimOptional(guide.name),
    }))
    .filter((guide) => guide.personId || guide.name);
}

function buildOstrovMetadata(
  current: unknown,
  input: {
    focus?: OstrovFocus | null;
    thumbnailUrl?: string | null;
    thumbnailSourceImageUrl?: string | null;
    thumbnailSourceUrl?: string | null;
    guides?: OstrovyGuideInput[];
    audienceGroups?: OstrovyAudienceGroupInput[];
  },
): Prisma.InputJsonValue {
  const base = ensureObject(current);
  const existingOstrovy = ensureObject(base.ostrovy);
  const nextOstrovy: Record<string, unknown> = {
    ...existingOstrovy,
    module: "ostrovy",
    kind: "single",
  };

  if ("focus" in input) nextOstrovy.focus = parseFocus(input.focus);
  if ("thumbnailUrl" in input) nextOstrovy.thumbnailUrl = trimOptional(input.thumbnailUrl);
  if ("thumbnailSourceImageUrl" in input) nextOstrovy.thumbnailSourceImageUrl = trimOptional(input.thumbnailSourceImageUrl);
  if ("thumbnailSourceUrl" in input) nextOstrovy.thumbnailSourceUrl = trimOptional(input.thumbnailSourceUrl);
  if ("guides" in input) nextOstrovy.guides = sanitizeGuides(input.guides);
  if ("audienceGroups" in input) nextOstrovy.audienceGroups = sanitizeAudienceGroups(input.audienceGroups);

  return jsonValue({
    ...base,
    ostrovy: nextOstrovy,
  });
}

async function replaceAudienceGroups(
  tx: Prisma.TransactionClient,
  schoolEventId: string,
  audienceGroups: OstrovyAudienceGroupInput[],
): Promise<void> {
  await tx.appSchoolEventAudienceRule.deleteMany({
    where: {
      schoolEventId,
      ruleType: AppSchoolEventAudienceRuleType.GROUP,
    },
  });
  await tx.appSchoolEventTarget.deleteMany({
    where: {
      schoolEventId,
      targetType: AppSchoolEventTargetType.GROUP,
    },
  });

  if (audienceGroups.length === 0) return;

  await tx.appSchoolEventAudienceRule.createMany({
    data: audienceGroups.map((group) => ({
      schoolEventId,
      ruleType: AppSchoolEventAudienceRuleType.GROUP,
      groupKind: group.kind,
      groupCode: group.code,
      metadata: jsonValue({ module: "ostrovy" }),
    })),
  });
  await tx.appSchoolEventTarget.createMany({
    data: audienceGroups.map((group) => ({
      schoolEventId,
      targetType: AppSchoolEventTargetType.GROUP,
      groupKind: group.kind,
      groupCode: group.code,
      metadata: jsonValue({ module: "ostrovy" }),
    })),
  });
}

export async function createOstrovyTerm(input: CreateOstrovyTermInput, actorPersonId?: string | null) {
  const startsAt = parseDate(input.startsAt, "startsAt");
  const endsAt = parseDate(input.endsAt, "endsAt");
  const now = input.now ?? new Date();
  assertDateRange(startsAt, endsAt);
  assertFutureStart(startsAt, now);

  const schoolYearId = await resolveSchoolYearId(input.schoolYearCode ?? null);

  return prisma.$transaction(async (tx) => {
    const collision = await findCollidingTerm(tx, startsAt, endsAt);
    if (collision) {
      throw new Error(`Term collides with existing Ostrovy term '${collision.name}'.`);
    }

    const date = formatPragueDate(startsAt);
    return tx.appSchoolEventOfferGroup.create({
      data: {
        schoolYearId,
        code: `ostrovy-${date}`,
        name: termName(startsAt),
        description: trimOptional(input.description),
        startsAt,
        endsAt,
        selectionMode: AppSchoolEventOfferSelectionMode.AT_MOST_ONE,
        maxSelectionsPerPerson: 1,
        allowNoSelection: true,
        metadata: jsonValue({
          module: "ostrovy",
          kind: "single",
          termDate: date,
          createdByPersonId: actorPersonId ?? null,
        }),
      },
    });
  });
}

export async function updateOstrovyTerm(
  termId: string,
  input: UpdateOstrovyTermInput,
  actorPersonId?: string | null,
) {
  const current = await prisma.appSchoolEventOfferGroup.findUnique({
    where: { id: termId },
    select: { id: true, startsAt: true, endsAt: true, metadata: true },
  });
  if (!current) throw new Error("Term not found.");

  const startsAt = input.startsAt ? parseDate(input.startsAt, "startsAt") : current.startsAt;
  const startDeltaMs = current.startsAt && input.startsAt && startsAt
    ? startsAt.getTime() - current.startsAt.getTime()
    : 0;
  const endsAt = input.endsAt
    ? parseDate(input.endsAt, "endsAt")
    : current.endsAt && input.startsAt
      ? shiftNullableDate(current.endsAt, startDeltaMs)
      : current.endsAt;
  const now = input.now ?? new Date();
  if (!startsAt || !endsAt) throw new Error("Term does not have a valid time range.");
  assertDateRange(startsAt, endsAt);
  assertFutureStart(startsAt, now);

  const changedEventIds = await prisma.$transaction(async (tx) => {
    const collision = await findCollidingTerm(tx, startsAt, endsAt, termId);
    if (collision) {
      throw new Error(`Term collides with existing Ostrovy term '${collision.name}'.`);
    }

    const date = formatPragueDate(startsAt);
    const events = await getActiveOstrovyEventsForTerm(tx, termId);

    await tx.appSchoolEventOfferGroup.update({
      where: { id: termId },
      data: {
        name: termName(startsAt),
        description: input.description === undefined ? undefined : trimOptional(input.description),
        startsAt,
        endsAt,
        metadata: jsonValue({
          ...ensureObject(current.metadata),
          module: "ostrovy",
          kind: "single",
          termDate: date,
          updatedByPersonId: actorPersonId ?? null,
        }),
      },
    });

    await tx.appSchoolEvent.updateMany({
      where: {
        offerGroupId: termId,
        eventType: { code: OSTROVY_EVENT_TYPE_CODE },
        isActive: true,
      },
      data: {
        startsAt,
        endsAt,
        timeOverrideLock: true,
        updatedByPersonId: actorPersonId ?? undefined,
      },
    });

    if (startDeltaMs !== 0 && events.length > 0) {
      const policies = await tx.appSchoolEventRegistrationPolicy.findMany({
        where: {
          schoolEventId: { in: events.map((event) => event.id) },
        },
        select: {
          id: true,
          opensAt: true,
          closesAt: true,
          unregisterClosesAt: true,
        },
      });

      for (const policy of policies) {
        await tx.appSchoolEventRegistrationPolicy.update({
          where: { id: policy.id },
          data: {
            opensAt: shiftNullableDate(policy.opensAt, startDeltaMs),
            closesAt: shiftNullableDate(policy.closesAt, startDeltaMs),
            unregisterClosesAt: shiftNullableDate(policy.unregisterClosesAt, startDeltaMs),
          },
        });
      }
    }

    return events.map((event) => event.id);
  });

  await enqueueChangedEvents(changedEventIds, "ostrovy:term-update");
  return getOstrovyTerm(termId);
}

export async function cancelOstrovyTerm(
  termId: string,
  input: CancelOstrovyTermInput,
  actorPersonId?: string | null,
) {
  const now = input.now ?? new Date();
  const changedEventIds = await prisma.$transaction(async (tx) => {
    const term = await tx.appSchoolEventOfferGroup.findUnique({
      where: { id: termId },
      select: { id: true, startsAt: true, endsAt: true, metadata: true },
    });
    if (!term) throw new Error("Term not found.");

    const events = await getActiveOstrovyEventsForTerm(tx, termId);
    if (events.length === 0) {
      await tx.appSchoolEventOfferGroup.update({
        where: { id: termId },
        data: { isActive: false },
      });
      return [];
    }

    if (input.strategy === "move_events") {
      const targetTermId = trimOptional(input.targetTermId);
      if (!targetTermId) throw new Error("targetTermId is required for move_events.");
      if (targetTermId === termId) throw new Error("targetTermId must differ from canceled term.");

      const target = await tx.appSchoolEventOfferGroup.findUnique({
        where: { id: targetTermId },
        select: { id: true, startsAt: true, endsAt: true, isActive: true },
      });
      if (!target || !target.isActive || !target.startsAt || !target.endsAt) {
        throw new Error("Target term is not active or does not have a valid time range.");
      }

      await tx.appSchoolEvent.updateMany({
        where: {
          offerGroupId: termId,
          eventType: { code: OSTROVY_EVENT_TYPE_CODE },
          isActive: true,
        },
        data: {
          offerGroupId: target.id,
          startsAt: target.startsAt,
          endsAt: target.endsAt,
          timeOverrideLock: true,
          updatedByPersonId: actorPersonId ?? undefined,
        },
      });
      await tx.appSchoolEventOfferGroup.update({
        where: { id: termId },
        data: { isActive: false },
      });
      return events.map((event) => event.id);
    }

    if (input.strategy !== "cancel_with_events") {
      throw new Error("Term contains Ostrovy. Use strategy cancel_with_events or move_events.");
    }

    const eventIds = events.map((event) => event.id);
    await tx.appSchoolEventRegistration.updateMany({
      where: {
        schoolEventId: { in: eventIds },
        status: { in: ACTIVE_REGISTRATION_STATUSES },
      },
      data: {
        status: AppSchoolEventRegistrationStatus.CANCELED_BY_GUIDE,
        changedByPersonId: actorPersonId ?? undefined,
        changedAt: now,
      },
    });
    await tx.appSchoolEvent.updateMany({
      where: { id: { in: eventIds } },
      data: {
        lifecycleStatus: AppSchoolEventLifecycleStatus.CANCELED,
        isActive: false,
        canceledAt: now,
        updatedByPersonId: actorPersonId ?? undefined,
      },
    });
    await tx.appSchoolEventOfferGroup.update({
      where: { id: termId },
      data: { isActive: false },
    });
    return eventIds;
  });

  await enqueueChangedEvents(changedEventIds, "ostrovy:term-cancel");
  return { ok: true, changedEventIds };
}

export async function createOstrov(input: CreateOstrovInput, actorPersonId?: string | null) {
  const title = input.title.trim();
  if (!title) throw new Error("title is required.");
  const capacity = input.capacity == null ? null : Math.trunc(input.capacity);
  if (capacity != null && capacity <= 0) throw new Error("capacity must be a positive number.");

  const audienceGroups = sanitizeAudienceGroups(input.audienceGroups);
  const schoolYearId = await resolveSchoolYearId(input.schoolYearCode ?? null);

  const created = await prisma.$transaction(async (tx) => {
    const eventTypeId = await getOstrovyEventTypeId(tx);
    const term = await tx.appSchoolEventOfferGroup.findUnique({
      where: { id: input.termId },
      select: { id: true, startsAt: true, endsAt: true, isActive: true, schoolYearId: true },
    });
    if (!term || !term.isActive || !term.startsAt || !term.endsAt) {
      throw new Error("Term is not active or does not have a valid time range.");
    }

    const defaultWindow = defaultOstrovRegistrationWindow(term.startsAt);
    const opensAt = input.registrationOpensAt
      ? parseDate(input.registrationOpensAt, "registrationOpensAt")
      : defaultWindow.opensAt;
    const closesAt = input.registrationClosesAt
      ? parseDate(input.registrationClosesAt, "registrationClosesAt")
      : defaultWindow.closesAt;
    assertDateRange(opensAt, closesAt);

    const event = await tx.appSchoolEvent.create({
      data: {
        schoolYearId: term.schoolYearId ?? schoolYearId,
        eventTypeId,
        offerGroupId: term.id,
        title,
        description: trimOptional(input.description),
        location: trimOptional(input.location),
        startsAt: term.startsAt,
        endsAt: term.endsAt,
        allDay: false,
        timezone: OSTROVY_TIMEZONE,
        visibility: AppSchoolEventVisibility.INVITE_ONLY,
        lifecycleStatus: input.publish === false
          ? AppSchoolEventLifecycleStatus.DRAFT
          : AppSchoolEventLifecycleStatus.PUBLISHED,
        publishedAt: input.publish === false ? null : new Date(),
        source: "app",
        metadata: buildOstrovMetadata(null, {
          focus: input.focus ?? null,
          thumbnailUrl: input.thumbnailUrl ?? null,
          thumbnailSourceImageUrl: input.thumbnailSourceImageUrl ?? null,
          thumbnailSourceUrl: input.thumbnailSourceUrl ?? null,
          guides: input.guides ?? [],
          audienceGroups,
        }),
        createdByPersonId: actorPersonId ?? undefined,
        updatedByPersonId: actorPersonId ?? undefined,
        registrationPolicy: {
          create: {
            isEnabled: true,
            windowMode: AppSchoolEventRegistrationWindowMode.ABSOLUTE,
            opensAt,
            closesAt,
            unregisterClosesAt: closesAt,
            capacity,
            allowWaitlist: false,
            allowGuideException: true,
            metadata: jsonValue({ module: "ostrovy" }),
          },
        },
      },
      select: { id: true },
    });

    await replaceAudienceGroups(tx, event.id, audienceGroups);

    const slot = await assignKioskSlot(tx, term.id);
    await tx.appSchoolEvent.update({
      where: { id: event.id },
      data: { kioskDisplayNumber: slot.kioskDisplayNumber, kioskDisplayColor: slot.kioskDisplayColor },
    });

    return event;
  });

  await enqueueChangedEvents([created.id], "ostrovy:event-create");
  return getOstrov(created.id);
}

export async function updateOstrov(
  eventId: string,
  input: UpdateOstrovInput,
  actorPersonId?: string | null,
) {
  const current = await prisma.appSchoolEvent.findFirst({
    where: { id: eventId, eventType: { code: OSTROVY_EVENT_TYPE_CODE } },
    include: { registrationPolicy: true },
  });
  if (!current) throw new Error("Ostrov not found.");

  const title = input.title === undefined ? undefined : input.title.trim();
  if (title !== undefined && !title) throw new Error("title cannot be empty.");
  const capacity = input.capacity === undefined || input.capacity === null ? input.capacity : Math.trunc(input.capacity);
  if (capacity != null && capacity <= 0) throw new Error("capacity must be a positive number.");

  const audienceGroups = input.audienceGroups ? sanitizeAudienceGroups(input.audienceGroups) : undefined;

  const changed = await prisma.$transaction(async (tx) => {
    let startsAt = current.startsAt;
    let endsAt = current.endsAt;
    let offerGroupId: string | null | undefined = undefined;

    if (input.termId) {
      const term = await tx.appSchoolEventOfferGroup.findUnique({
        where: { id: input.termId },
        select: { id: true, startsAt: true, endsAt: true, isActive: true },
      });
      if (!term || !term.isActive || !term.startsAt || !term.endsAt) {
        throw new Error("Target term is not active or does not have a valid time range.");
      }
      startsAt = term.startsAt;
      endsAt = term.endsAt;
      offerGroupId = term.id;
    }

    // When moving to a new term, assign fresh kiosk slot in the target term
    const kioskUpdate = input.termId
      ? await assignKioskSlot(tx, input.termId, eventId)
      : undefined;

    const defaultWindow = defaultOstrovRegistrationWindow(startsAt);
    const opensAt = input.registrationOpensAt === undefined
      ? undefined
      : input.registrationOpensAt
        ? parseDate(input.registrationOpensAt, "registrationOpensAt")
        : defaultWindow.opensAt;
    const closesAt = input.registrationClosesAt === undefined
      ? undefined
      : input.registrationClosesAt
        ? parseDate(input.registrationClosesAt, "registrationClosesAt")
        : defaultWindow.closesAt;
    if (opensAt && closesAt) assertDateRange(opensAt, closesAt);
    if (opensAt && !closesAt && current.registrationPolicy?.closesAt) assertDateRange(opensAt, current.registrationPolicy.closesAt);
    if (!opensAt && closesAt && current.registrationPolicy?.opensAt) assertDateRange(current.registrationPolicy.opensAt, closesAt);

    await tx.appSchoolEvent.update({
      where: { id: eventId },
      data: {
        offerGroupId,
        title,
        description: input.description === undefined ? undefined : trimOptional(input.description),
        location: input.location === undefined ? undefined : trimOptional(input.location),
        startsAt,
        endsAt,
        timeOverrideLock: input.termId ? true : undefined,
        ...(kioskUpdate ?? {}),
        metadata: buildOstrovMetadata(current.metadata, {
          ...(input.focus !== undefined ? { focus: input.focus } : {}),
          ...(input.thumbnailUrl !== undefined ? { thumbnailUrl: input.thumbnailUrl } : {}),
          ...(input.thumbnailSourceImageUrl !== undefined ? { thumbnailSourceImageUrl: input.thumbnailSourceImageUrl } : {}),
          ...(input.thumbnailSourceUrl !== undefined ? { thumbnailSourceUrl: input.thumbnailSourceUrl } : {}),
          ...(input.guides !== undefined ? { guides: input.guides } : {}),
          ...(audienceGroups !== undefined ? { audienceGroups } : {}),
        }),
        updatedByPersonId: actorPersonId ?? undefined,
      },
    });

    await tx.appSchoolEventRegistrationPolicy.upsert({
      where: { schoolEventId: eventId },
      create: {
        schoolEventId: eventId,
        isEnabled: true,
        windowMode: AppSchoolEventRegistrationWindowMode.ABSOLUTE,
        opensAt: opensAt ?? defaultWindow.opensAt,
        closesAt: closesAt ?? defaultWindow.closesAt,
        unregisterClosesAt: closesAt ?? defaultWindow.closesAt,
        capacity: capacity === undefined ? null : capacity,
        allowWaitlist: false,
        allowGuideException: true,
        metadata: jsonValue({ module: "ostrovy" }),
      },
      update: {
        isEnabled: true,
        windowMode: AppSchoolEventRegistrationWindowMode.ABSOLUTE,
        opensAt,
        closesAt,
        unregisterClosesAt: closesAt,
        capacity: capacity === undefined ? undefined : capacity,
        allowWaitlist: false,
        allowGuideException: true,
      },
    });

    if (audienceGroups !== undefined) {
      await replaceAudienceGroups(tx, eventId, audienceGroups);
    }

    return { id: eventId };
  });

  await enqueueChangedEvents([changed.id], "ostrovy:event-update");
  return getOstrov(eventId);
}

export async function cancelOstrov(eventId: string, actorPersonId?: string | null, now = new Date()) {
  await prisma.$transaction(async (tx) => {
    const event = await tx.appSchoolEvent.findFirst({
      where: { id: eventId, eventType: { code: OSTROVY_EVENT_TYPE_CODE } },
      select: { id: true },
    });
    if (!event) throw new Error("Ostrov not found.");

    await tx.appSchoolEventRegistration.updateMany({
      where: {
        schoolEventId: eventId,
        status: { in: ACTIVE_REGISTRATION_STATUSES },
      },
      data: {
        status: AppSchoolEventRegistrationStatus.CANCELED_BY_GUIDE,
        changedByPersonId: actorPersonId ?? undefined,
        changedAt: now,
      },
    });
    await tx.appSchoolEvent.update({
      where: { id: eventId },
      data: {
        lifecycleStatus: AppSchoolEventLifecycleStatus.CANCELED,
        isActive: false,
        canceledAt: now,
        updatedByPersonId: actorPersonId ?? undefined,
      },
    });
  });

  await enqueueChangedEvents([eventId], "ostrovy:event-cancel");
  return { ok: true };
}

function parseSchoolLevelCode(groupCode: string | null): number | null {
  if (!groupCode || !/^\d+$/.test(groupCode.trim())) return null;
  return Number(groupCode);
}

type LoadedAudienceRule = {
  ruleType: AppSchoolEventAudienceRuleType;
  personId: string | null;
  roleCode: string | null;
  groupKind: string | null;
  groupCode: string | null;
};

type LoadedAudienceTarget = {
  targetType: AppSchoolEventTargetType;
  personId: string | null;
  groupKind: string | null;
  groupCode: string | null;
};

type LoadedAudienceEvent = {
  audienceRules: LoadedAudienceRule[];
  targets: LoadedAudienceTarget[];
};

type AudienceMatchContext = {
  roles: Set<string>;
  schoolGrade: number | null;
  groupKeys: Set<string>;
};

function normalizeGroupValue(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function groupKey(kind: string | null | undefined, code: string | null | undefined): string | null {
  const normalizedKind = normalizeGroupValue(kind);
  const normalizedCode = normalizeGroupValue(code);
  return normalizedKind && normalizedCode ? `${normalizedKind}::${normalizedCode}` : null;
}

function isSchoolLevelGroupKind(kind: string | null | undefined): boolean {
  const normalized = normalizeGroupValue(kind);
  return normalized === "rocnik" || normalized === "stupen";
}

async function getPersonCurrentGrade(client: DbClient, personId: string): Promise<number | null> {
  const rows = await client.$queryRaw<Array<{ grade: number | null }>>(Prisma.sql`
    SELECT (sr.payload->>'CurrentGradeNum')::int AS grade
    FROM app_person_source_record sr
    JOIN app_person p ON p.id = sr.person_id
    WHERE sr.person_id = ${personId}
      AND sr.active_source = TRUE
      AND sr.derived_roles @> ARRAY['zak']::text[]
      AND p.is_active = TRUE
      AND (sr.payload->>'CurrentGradeNum') ~ '^[0-9]+$'
    LIMIT 1
  `);

  return rows[0]?.grade ?? null;
}

function schoolGradeMatchesGroup(
  schoolGrade: number | null,
  groupKind: string | null,
  groupCode: string | null,
): boolean {
  if (schoolGrade == null) return false;
  const kind = normalizeGroupValue(groupKind);
  const code = parseSchoolLevelCode(groupCode);
  if (code == null) return false;
  if (kind === "rocnik") return schoolGrade === code;
  if (kind !== "stupen") return false;
  return (
    (code === 1 && schoolGrade >= 1 && schoolGrade <= 5) ||
    (code === 2 && schoolGrade >= 6 && schoolGrade <= 9)
  );
}

async function getPersonDbGroupKeys(
  client: DbClient,
  personId: string,
  pairs: Array<{ kind: string; code: string }>,
  at: Date,
): Promise<Set<string>> {
  if (pairs.length === 0) return new Set();

  try {
    const tableRows = await client.$queryRaw<Array<{ ok: boolean }>>(Prisma.sql`
      SELECT (
        to_regclass('public.app_group') IS NOT NULL
        AND to_regclass('public.app_group_membership') IS NOT NULL
      ) AS ok
    `);
    if (!tableRows[0]?.ok) return new Set();

    const rows = await client.$queryRaw<Array<{ kind: string; code: string }>>(Prisma.sql`
      WITH target_groups(kind, code) AS (
        VALUES ${Prisma.join(
          pairs.map((pair) => Prisma.sql`(CAST(${pair.kind} AS text), CAST(${pair.code} AS text))`),
        )}
      )
      SELECT DISTINCT lower(g.kind::text) AS kind, lower(g.code) AS code
      FROM app_group g
      JOIN app_group_membership gm ON gm.group_id = g.id
      JOIN target_groups tg ON lower(g.kind::text) = tg.kind AND lower(g.code) = tg.code
      WHERE gm.person_id = ${personId}
        AND g.is_active = TRUE
        AND (g.valid_from IS NULL OR g.valid_from <= ${at})
        AND (g.valid_to IS NULL OR g.valid_to > ${at})
        AND (gm.valid_from IS NULL OR gm.valid_from <= ${at})
        AND (gm.valid_to IS NULL OR gm.valid_to > ${at})
    `);

    return new Set(rows.map((row) => `${row.kind}::${row.code}`));
  } catch {
    return new Set();
  }
}

async function buildAudienceMatchContext(
  client: DbClient,
  personId: string,
  events: LoadedAudienceEvent[],
  at: Date,
): Promise<AudienceMatchContext> {
  let needsRoles = false;
  let needsSchoolGrade = false;
  const dbGroupPairsByKey = new Map<string, { kind: string; code: string }>();

  for (const event of events) {
    for (const rule of event.audienceRules) {
      if (rule.ruleType === AppSchoolEventAudienceRuleType.ROLE) needsRoles = true;
      if (rule.ruleType === AppSchoolEventAudienceRuleType.GROUP) {
        if (isSchoolLevelGroupKind(rule.groupKind)) {
          needsSchoolGrade = true;
        } else {
          const key = groupKey(rule.groupKind, rule.groupCode);
          if (key) dbGroupPairsByKey.set(key, { kind: normalizeGroupValue(rule.groupKind), code: normalizeGroupValue(rule.groupCode) });
        }
      }
    }
    for (const target of event.targets) {
      if (target.targetType === AppSchoolEventTargetType.GROUP) {
        if (isSchoolLevelGroupKind(target.groupKind)) {
          needsSchoolGrade = true;
        } else {
          const key = groupKey(target.groupKind, target.groupCode);
          if (key) dbGroupPairsByKey.set(key, { kind: normalizeGroupValue(target.groupKind), code: normalizeGroupValue(target.groupCode) });
        }
      }
    }
  }

  const [roleRows, schoolGrade, groupKeys] = await Promise.all([
    needsRoles
      ? client.appRoleAssignment.findMany({
          where: { personId, isActive: true },
          select: { role: true },
        })
      : Promise.resolve([]),
    needsSchoolGrade ? getPersonCurrentGrade(client, personId) : Promise.resolve(null),
    getPersonDbGroupKeys(client, personId, [...dbGroupPairsByKey.values()], at),
  ]);

  return {
    roles: new Set(roleRows.map((row) => row.role.toLowerCase())),
    schoolGrade,
    groupKeys,
  };
}

function personMatchesLoadedGroup(
  context: AudienceMatchContext,
  groupKind: string | null,
  groupCode: string | null,
): boolean {
  if (isSchoolLevelGroupKind(groupKind)) {
    return schoolGradeMatchesGroup(context.schoolGrade, groupKind, groupCode);
  }

  const key = groupKey(groupKind, groupCode);
  return key ? context.groupKeys.has(key) : false;
}

function personMatchesLoadedAudience(
  event: LoadedAudienceEvent,
  context: AudienceMatchContext,
  personId: string,
): boolean {
  if (event.audienceRules.length === 0 && event.targets.length === 0) return true;

  for (const rule of event.audienceRules) {
    if (rule.ruleType === AppSchoolEventAudienceRuleType.PUBLIC) return true;
    if (rule.ruleType === AppSchoolEventAudienceRuleType.PERSON && rule.personId === personId) return true;
    if (
      rule.ruleType === AppSchoolEventAudienceRuleType.ROLE &&
      rule.roleCode &&
      context.roles.has(rule.roleCode.toLowerCase())
    ) {
      return true;
    }
    if (
      rule.ruleType === AppSchoolEventAudienceRuleType.GROUP &&
      personMatchesLoadedGroup(context, rule.groupKind, rule.groupCode)
    ) {
      return true;
    }
  }

  for (const target of event.targets) {
    if (target.targetType === AppSchoolEventTargetType.PERSON && target.personId === personId) return true;
    if (
      target.targetType === AppSchoolEventTargetType.GROUP &&
      personMatchesLoadedGroup(context, target.groupKind, target.groupCode)
    ) {
      return true;
    }
  }

  return false;
}

async function assertCanRegisterToOstrov(client: DbClient, eventId: string, personId: string, now: Date): Promise<void> {
  const [event, student] = await Promise.all([
    client.appSchoolEvent.findFirst({
      where: {
        id: eventId,
        isActive: true,
        eventType: { code: OSTROVY_EVENT_TYPE_CODE },
      },
      select: {
        id: true,
        startsAt: true,
        registrationPolicy: { select: { capacity: true } },
        registrations: {
          where: { status: { in: ACTIVE_REGISTRATION_STATUSES } },
          select: { personId: true, status: true },
        },
        audienceRules: {
          where: { isActive: true },
          select: { ruleType: true, personId: true, roleCode: true, groupKind: true, groupCode: true },
        },
        targets: {
          select: { targetType: true, personId: true, groupKind: true, groupCode: true },
        },
      },
    }),
    client.appPerson.findFirst({
      where: {
        id: personId,
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
      },
      select: { id: true },
    }),
  ]);

  if (!event) throw new Error("Ostrov not found or inactive.");
  if (!student) throw new Error("Selected person is not an active student.");

  const audienceContext = await buildAudienceMatchContext(client, personId, [event], now);
  const matchesAudience = personMatchesLoadedAudience(event, audienceContext, personId);
  if (!matchesAudience) throw new Error("Student is outside the target audience for this Ostrov.");

  const alreadyRegistered = event.registrations.some((registration) => registration.personId === personId);
  const capacity = event.registrationPolicy?.capacity ?? null;
  if (capacity != null && !alreadyRegistered) {
    const occupied = event.registrations.length;
    if (occupied >= capacity) {
      throw new Error("Ostrov capacity is full.");
    }
  }
}

async function findActiveRegistrationInSameTerm(client: DbClient, eventId: string, personId: string) {
  const event = await client.appSchoolEvent.findUnique({
    where: { id: eventId },
    select: { id: true, offerGroupId: true },
  });
  if (!event?.offerGroupId) return null;

  return client.appSchoolEventRegistration.findFirst({
    where: {
      personId,
      status: { in: ACTIVE_REGISTRATION_STATUSES },
      schoolEvent: {
        offerGroupId: event.offerGroupId,
        id: { not: eventId },
        eventType: { code: OSTROVY_EVENT_TYPE_CODE },
      },
    },
    select: {
      schoolEventId: true,
      schoolEvent: { select: { title: true } },
    },
  });
}

export async function registerOstrovStudent(input: RegisterOstrovInput) {
  const now = input.now ?? new Date();
  await assertCanRegisterToOstrov(prisma, input.eventId, input.personId, now);

  const conflicting = await findActiveRegistrationInSameTerm(prisma, input.eventId, input.personId);
  if (conflicting) {
    if (!input.allowTransfer) {
      throw new Error(`Student is already registered in this term: ${conflicting.schoolEvent.title}.`);
    }
    await upsertSchoolEventRegistration({
      schoolEventId: conflicting.schoolEventId,
      personId: input.personId,
      action: "unregister",
      actorPersonId: input.actorPersonId ?? null,
      actorRoles: input.actorRoles ?? [],
      allowGuideException: Boolean(input.allowGuideException),
      exceptionReason: input.exceptionReason ?? null,
      note: input.note ?? null,
      now,
      sourceRef: input.sourceRef ?? "ostrovy:transfer:unregister",
      enqueueCalendarSync: input.enqueueCalendarSync,
      waitForCalendarSync: input.waitForCalendarSync,
    });
  }

  return upsertSchoolEventRegistration({
    schoolEventId: input.eventId,
    personId: input.personId,
    action: "register",
    actorPersonId: input.actorPersonId ?? null,
    actorRoles: input.actorRoles ?? [],
    allowGuideException: Boolean(input.allowGuideException),
    exceptionReason: input.exceptionReason ?? null,
    note: input.note ?? null,
    now,
    sourceRef: input.sourceRef ?? "ostrovy:register",
    enqueueCalendarSync: input.enqueueCalendarSync,
    waitForCalendarSync: input.waitForCalendarSync,
  });
}

export async function unregisterOstrovStudent(input: UnregisterOstrovInput) {
  return upsertSchoolEventRegistration({
    schoolEventId: input.eventId,
    personId: input.personId,
    action: "unregister",
    actorPersonId: input.actorPersonId ?? null,
    actorRoles: input.actorRoles ?? [],
    allowGuideException: Boolean(input.allowGuideException),
    exceptionReason: input.exceptionReason ?? null,
    note: input.note ?? null,
    sourceRef: input.sourceRef ?? "ostrovy:unregister",
    enqueueCalendarSync: input.enqueueCalendarSync,
    waitForCalendarSync: input.waitForCalendarSync,
  });
}

export async function getOstrovyTerm(termId: string) {
  return prisma.appSchoolEventOfferGroup.findUnique({
    where: { id: termId },
    include: {
      events: {
        where: { eventType: { code: OSTROVY_EVENT_TYPE_CODE } },
        include: {
          registrationPolicy: true,
          registrations: {
            where: { status: { in: ACTIVE_REGISTRATION_STATUSES } },
            select: { id: true, personId: true, status: true },
          },
          audienceRules: true,
          targets: true,
        },
        orderBy: [{ title: "asc" }],
      },
    },
  });
}

export async function getOstrov(eventId: string) {
  return prisma.appSchoolEvent.findFirst({
    where: { id: eventId, eventType: { code: OSTROVY_EVENT_TYPE_CODE } },
    include: {
      offerGroup: true,
      registrationPolicy: true,
      registrations: {
        where: { status: { in: ACTIVE_REGISTRATION_STATUSES } },
        include: {
          schoolEvent: { select: { id: true, title: true } },
        },
      },
      audienceRules: true,
      targets: true,
    },
  });
}

export async function listOstrovyTerms(params: {
  from?: string | Date;
  to?: string | Date;
  includeInactive?: boolean;
} = {}) {
  const from = params.from ? parseDate(params.from, "from") : undefined;
  const to = params.to ? parseDate(params.to, "to") : undefined;
  return prisma.appSchoolEventOfferGroup.findMany({
    where: {
      isActive: params.includeInactive ? undefined : true,
      startsAt: to ? { lt: to } : undefined,
      endsAt: from ? { gt: from } : undefined,
      OR: [
        { name: { startsWith: "Ostrovy" } },
        { code: { startsWith: "ostrovy-" } },
        {
          events: {
            some: {
              eventType: { code: OSTROVY_EVENT_TYPE_CODE },
            },
          },
        },
      ],
    },
    include: {
      events: {
        where: { eventType: { code: OSTROVY_EVENT_TYPE_CODE } },
        include: {
          registrationPolicy: true,
          registrations: {
            where: { status: { in: ACTIVE_REGISTRATION_STATUSES } },
            select: { id: true, personId: true, status: true },
          },
          audienceRules: true,
        },
        orderBy: [{ title: "asc" }],
      },
    },
    orderBy: [{ startsAt: "asc" }],
  });
}

export async function listOstrovyForChild(personId: string, params: { from?: string | Date; to?: string | Date } = {}) {
  const from = params.from ? parseDate(params.from, "from") : new Date();
  const to = params.to ? parseDate(params.to, "to") : undefined;
  const events = await prisma.appSchoolEvent.findMany({
    where: {
      isActive: true,
      startsAt: to ? { lt: to, gte: from } : { gte: from },
      eventType: { code: OSTROVY_EVENT_TYPE_CODE },
      lifecycleStatus: {
        in: [
          AppSchoolEventLifecycleStatus.PUBLISHED,
          AppSchoolEventLifecycleStatus.REGISTRATION_CLOSED,
        ],
      },
    },
    include: {
      offerGroup: true,
      registrationPolicy: true,
      registrations: {
        where: {
          OR: [
            { personId },
            { status: { in: ACTIVE_REGISTRATION_STATUSES } },
          ],
        },
        select: { personId: true, status: true },
      },
      audienceRules: true,
      targets: true,
    },
    orderBy: [{ startsAt: "asc" }, { title: "asc" }],
  });

  const now = new Date();
  const audienceContext = await buildAudienceMatchContext(prisma, personId, events, now);
  const enriched = [];
  for (const event of events) {
    const eligible = personMatchesLoadedAudience(event, audienceContext, personId);
    const myRegistration = event.registrations.find((registration) => registration.personId === personId) ?? null;
    const activeRegistrations = event.registrations.filter((registration) =>
      isActiveRegistrationStatus(registration.status),
    );
    const occupied = activeRegistrations.length;
    if (eligible || myRegistration) {
      enriched.push({
        ...event,
        eligible,
        occupied,
        myRegistration,
      });
    }
  }
  return enriched;
}

export async function listOstrovRegistrations(eventId: string) {
  return prisma.appSchoolEventRegistration.findMany({
    where: { schoolEventId: eventId },
    include: {
      schoolEvent: { select: { id: true, title: true, offerGroupId: true } },
    },
    orderBy: [{ changedAt: "desc" }],
  });
}
