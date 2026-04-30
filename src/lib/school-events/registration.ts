import { Prisma, type PrismaClient } from "@prisma/client";
import {
  AppSchoolEventLifecycleStatus,
  AppSchoolEventOfferSelectionMode,
  AppSchoolEventRegistrationStatus,
  AppSchoolEventRegistrationWindowMode,
} from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import { enqueueSchoolEventCalendarSyncJobs } from "@/src/lib/calendar/school-event-sync";

type DbClient = PrismaClient | Prisma.TransactionClient;

type RegistrationAction = "register" | "unregister";

const EXCEPTION_ALLOWED_ROLES = new Set(["admin", "ucitel", "zamestnanec", "pruvodce", "garant"]);

interface RegistrationAuditEntry {
  at: string;
  action: RegistrationAction;
  actorPersonId: string | null;
  actorRoles: string[];
  statusBefore: AppSchoolEventRegistrationStatus | null;
  statusAfter: AppSchoolEventRegistrationStatus;
  isException: boolean;
  exceptionReason: string | null;
  sourceRef: string | null;
}

export interface UpsertRegistrationParams {
  schoolEventId: string;
  personId: string;
  action: RegistrationAction;
  actorPersonId?: string | null;
  actorRoles?: string[];
  now?: Date;
  note?: string | null;
  sourceRef?: string | null;
  allowGuideException?: boolean;
  exceptionReason?: string | null;
  enqueueCalendarSync?: boolean;
  waitForCalendarSync?: boolean;
}

export interface UpsertRegistrationResult {
  schoolEventId: string;
  personId: string;
  action: RegistrationAction;
  status: AppSchoolEventRegistrationStatus;
  isException: boolean;
  registrationWindowOpen: boolean;
  registrationId: string;
  changedAt: Date;
  syncEnqueue?:
    | Awaited<ReturnType<typeof enqueueSchoolEventCalendarSyncJobs>>
    | { error: string }
    | null;
}

function isExceptionActor(actorRoles: string[] | undefined): boolean {
  if (!actorRoles || actorRoles.length === 0) return false;
  return actorRoles.some((role) => EXCEPTION_ALLOWED_ROLES.has(role.toLowerCase()));
}

function ensureJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function coerceHistory(value: unknown): RegistrationAuditEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && typeof entry === "object") as RegistrationAuditEntry[];
}

function addAuditEntry(
  metadata: unknown,
  entry: RegistrationAuditEntry,
): Prisma.InputJsonValue {
  const object = ensureJsonObject(metadata);
  const history = coerceHistory(object.history);
  return JSON.parse(
    JSON.stringify({
      ...object,
      history: [...history, entry],
      lastSourceRef: entry.sourceRef,
    }),
  ) as Prisma.InputJsonValue;
}

function parseOffset(base: Date, offsetMinutes: number | null | undefined): Date | null {
  if (offsetMinutes == null) return null;
  return new Date(base.getTime() + offsetMinutes * 60 * 1000);
}

function computeRegistrationWindows(
  policy: {
    isEnabled: boolean;
    windowMode: AppSchoolEventRegistrationWindowMode;
    opensAt: Date | null;
    closesAt: Date | null;
    unregisterClosesAt: Date | null;
    opensOffsetMinutes: number | null;
    closesOffsetMinutes: number | null;
    unregisterOffsetMinutes: number | null;
  } | null,
  eventStartsAt: Date,
): {
  isEnabled: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  unregisterClosesAt: Date | null;
} {
  if (!policy) {
    return {
      isEnabled: false,
      opensAt: null,
      closesAt: null,
      unregisterClosesAt: null,
    };
  }
  if (!policy.isEnabled) {
    return {
      isEnabled: false,
      opensAt: null,
      closesAt: null,
      unregisterClosesAt: null,
    };
  }

  if (policy.windowMode === AppSchoolEventRegistrationWindowMode.ABSOLUTE) {
    return {
      isEnabled: true,
      opensAt: policy.opensAt,
      closesAt: policy.closesAt,
      unregisterClosesAt: policy.unregisterClosesAt ?? policy.closesAt,
    };
  }

  return {
    isEnabled: true,
    opensAt: parseOffset(eventStartsAt, policy.opensOffsetMinutes),
    closesAt: parseOffset(eventStartsAt, policy.closesOffsetMinutes),
    unregisterClosesAt:
      parseOffset(eventStartsAt, policy.unregisterOffsetMinutes) ??
      parseOffset(eventStartsAt, policy.closesOffsetMinutes),
  };
}

function isInsideWindow(
  now: Date,
  opensAt: Date | null,
  closesAt: Date | null,
): boolean {
  if (opensAt && now < opensAt) return false;
  if (closesAt && now > closesAt) return false;
  return true;
}

async function enforceOfferSelectionRule(
  tx: DbClient,
  event: { id: string; offerGroupId: string | null },
  personId: string,
): Promise<void> {
  if (!event.offerGroupId) return;

  const group = await tx.appSchoolEventOfferGroup.findUnique({
    where: { id: event.offerGroupId },
    select: { id: true, selectionMode: true, maxSelectionsPerPerson: true },
  });
  if (!group) return;

  if (
    group.selectionMode !== AppSchoolEventOfferSelectionMode.AT_MOST_ONE &&
    group.selectionMode !== AppSchoolEventOfferSelectionMode.EXACTLY_ONE
  ) {
    return;
  }

  const rows = await tx.$queryRaw<Array<{ cnt: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS cnt
    FROM app_school_event_registration r
    JOIN app_school_event e ON e.id = r.school_event_id
    WHERE e.offer_group_id = ${event.offerGroupId}
      AND r.person_id = ${personId}
      AND r.school_event_id <> ${event.id}
      AND r.status IN ('REGISTERED', 'WAITLIST')
  `);
  const currentCount = rows[0]?.cnt ?? 0;
  const maxAllowed = Math.max(group.maxSelectionsPerPerson, 1);

  if (currentCount >= maxAllowed) {
    throw new Error(
      `Uživatel už má v nabídce '${event.offerGroupId}' vyčerpaný limit (${currentCount}/${maxAllowed}).`,
    );
  }
}

async function ensureEventForRegistration(tx: DbClient, schoolEventId: string) {
  const event = await tx.appSchoolEvent.findUnique({
    where: { id: schoolEventId },
    select: {
      id: true,
      startsAt: true,
      lifecycleStatus: true,
      registrationPolicy: {
        select: {
          isEnabled: true,
          windowMode: true,
          opensAt: true,
          closesAt: true,
          unregisterClosesAt: true,
          opensOffsetMinutes: true,
          closesOffsetMinutes: true,
          unregisterOffsetMinutes: true,
          allowGuideException: true,
        },
      },
      offerGroupId: true,
    },
  });

  if (!event) {
    throw new Error(`Akce '${schoolEventId}' neexistuje.`);
  }
  if (
    event.lifecycleStatus !== AppSchoolEventLifecycleStatus.PUBLISHED &&
    event.lifecycleStatus !== AppSchoolEventLifecycleStatus.REGISTRATION_CLOSED
  ) {
    throw new Error(
      `Registrace lze měnit jen pro publikovanou akci. Aktuální stav: ${event.lifecycleStatus}.`,
    );
  }

  return event;
}

export async function upsertSchoolEventRegistration(
  params: UpsertRegistrationParams,
): Promise<UpsertRegistrationResult> {
  const now = params.now ?? new Date();
  const actorRoles = (params.actorRoles ?? []).map((role) => String(role).trim()).filter(Boolean);

  const baseResult = await prisma.$transaction(async (tx) => {
    const event = await ensureEventForRegistration(tx, params.schoolEventId);
    const windows = computeRegistrationWindows(event.registrationPolicy, event.startsAt);
    const isRegistrationWindowOpen = isInsideWindow(now, windows.opensAt, windows.closesAt);
    const isUnregisterWindowOpen = isInsideWindow(now, windows.opensAt, windows.unregisterClosesAt);

    const existing = await tx.appSchoolEventRegistration.findUnique({
      where: {
        schoolEventId_personId: {
          schoolEventId: params.schoolEventId,
          personId: params.personId,
        },
      },
      select: {
        id: true,
        status: true,
        metadata: true,
      },
    });

    const wantsException = Boolean(params.allowGuideException);
    const actorCanException = isExceptionActor(actorRoles);
    const eventAllowsException = event.registrationPolicy?.allowGuideException ?? true;
    const canApplyException = wantsException && actorCanException && eventAllowsException;

    if (params.action === "register") {
      if (windows.isEnabled && !isRegistrationWindowOpen && !canApplyException) {
        throw new Error("Registrační okno je uzavřené.");
      }
      if (canApplyException && !params.exceptionReason?.trim()) {
        throw new Error("Výjimka po uzávěrce vyžaduje exceptionReason.");
      }
      await enforceOfferSelectionRule(tx, event, params.personId);
    }

    if (params.action === "unregister") {
      if (windows.isEnabled && !isUnregisterWindowOpen && !canApplyException) {
        throw new Error("Okno pro odhlášení je uzavřené.");
      }
      if (canApplyException && !params.exceptionReason?.trim()) {
        throw new Error("Výjimka po uzávěrce vyžaduje exceptionReason.");
      }
    }

    const statusAfter =
      params.action === "register"
        ? AppSchoolEventRegistrationStatus.REGISTERED
        : canApplyException
          ? AppSchoolEventRegistrationStatus.CANCELED_BY_GUIDE
          : AppSchoolEventRegistrationStatus.UNREGISTERED;

    const auditEntry: RegistrationAuditEntry = {
      at: now.toISOString(),
      action: params.action,
      actorPersonId: params.actorPersonId ?? null,
      actorRoles,
      statusBefore: existing?.status ?? null,
      statusAfter,
      isException: canApplyException,
      exceptionReason: canApplyException ? params.exceptionReason?.trim() ?? null : null,
      sourceRef: params.sourceRef ?? null,
    };

    const saved = await tx.appSchoolEventRegistration.upsert({
      where: {
        schoolEventId_personId: {
          schoolEventId: params.schoolEventId,
          personId: params.personId,
        },
      },
      create: {
        schoolEventId: params.schoolEventId,
        personId: params.personId,
        status: statusAfter,
        isException: canApplyException,
        exceptionReason: canApplyException ? params.exceptionReason?.trim() ?? undefined : undefined,
        note: params.note ?? undefined,
        changedByPersonId: params.actorPersonId ?? undefined,
        changedAt: now,
        metadata: addAuditEntry(null, auditEntry),
      },
      update: {
        status: statusAfter,
        isException: canApplyException,
        exceptionReason: canApplyException ? params.exceptionReason?.trim() ?? undefined : null,
        note: params.note ?? undefined,
        changedByPersonId: params.actorPersonId ?? undefined,
        changedAt: now,
        metadata: addAuditEntry(existing?.metadata ?? null, auditEntry),
      },
      select: {
        id: true,
        status: true,
        isException: true,
        changedAt: true,
      },
    });

    return {
      schoolEventId: params.schoolEventId,
      personId: params.personId,
      action: params.action,
      status: saved.status,
      isException: saved.isException,
      registrationWindowOpen:
        params.action === "register" ? isRegistrationWindowOpen : isUnregisterWindowOpen,
      registrationId: saved.id,
      changedAt: saved.changedAt,
    };
  });

  if (params.enqueueCalendarSync === false) {
    return {
      ...baseResult,
      syncEnqueue: null,
    };
  }

  const enqueueSync = async () => {
    try {
      return await enqueueSchoolEventCalendarSyncJobs({
        schoolEventId: params.schoolEventId,
        sourceRef: params.sourceRef ?? "registration-change",
        priority: 85,
      });
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  if (params.waitForCalendarSync === false) {
    void enqueueSync();
    return {
      ...baseResult,
      syncEnqueue: null,
    };
  }

  const syncEnqueue = await enqueueSync();

  return {
    ...baseResult,
    syncEnqueue,
  };
}

export async function listSchoolEventRegistrations(schoolEventId: string) {
  return prisma.appSchoolEventRegistration.findMany({
    where: { schoolEventId },
    orderBy: [{ changedAt: "desc" }],
    select: {
      id: true,
      personId: true,
      status: true,
      isException: true,
      exceptionReason: true,
      note: true,
      changedByPersonId: true,
      changedAt: true,
      metadata: true,
    },
  });
}
