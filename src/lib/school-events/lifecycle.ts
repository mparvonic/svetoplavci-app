import { Prisma, type PrismaClient } from "@prisma/client";
import {
  AppSchoolEventAudienceRuleType,
  AppSchoolEventLifecycleStatus,
  AppSchoolEventSnapshotReason,
} from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import { enqueueSchoolEventCalendarSyncJobs } from "@/src/lib/calendar/school-event-sync";

type DbClient = PrismaClient | Prisma.TransactionClient;

interface ResolvedAudienceMember {
  personId: string;
  sourceRuleId: string | null;
}

interface ResolvedAudience {
  members: ResolvedAudienceMember[];
  usedRuleCount: number;
  fallbackToLegacyTargets: boolean;
}

export interface SnapshotParams {
  schoolEventId: string;
  reason: AppSchoolEventSnapshotReason;
  snapshotAt?: Date;
  sourceRef?: string | null;
  createdByPersonId?: string | null;
}

export interface SnapshotResult {
  batchId: string;
  schoolEventId: string;
  reason: AppSchoolEventSnapshotReason;
  snapshotAt: Date;
  participantsCount: number;
}

export interface PublishSchoolEventParams {
  schoolEventId: string;
  actorPersonId?: string | null;
  sourceRef?: string | null;
  snapshotAt?: Date;
}

export interface CloseRegistrationParams {
  schoolEventId: string;
  actorPersonId?: string | null;
  sourceRef?: string | null;
  snapshotAt?: Date;
}

const ACTIVE_STATUS_SET = new Set<string>([
  AppSchoolEventLifecycleStatus.DRAFT,
  AppSchoolEventLifecycleStatus.PUBLISHED,
  AppSchoolEventLifecycleStatus.REGISTRATION_CLOSED,
]);

function mergeUniqueIntoMap(map: Map<string, string | null>, personIds: string[], sourceRuleId: string | null) {
  for (const personId of personIds) {
    if (!personId) continue;
    if (!map.has(personId)) {
      map.set(personId, sourceRuleId);
    }
  }
}

async function resolvePersonRule(client: DbClient, personId: string | null): Promise<string[]> {
  if (!personId) return [];
  const person = await client.appPerson.findFirst({
    where: { id: personId, isActive: true },
    select: { id: true },
  });
  return person ? [person.id] : [];
}

async function resolveRoleRule(client: DbClient, roleCode: string | null, at: Date): Promise<string[]> {
  if (!roleCode) return [];
  const rows = await client.$queryRaw<Array<{ person_id: string }>>(Prisma.sql`
    SELECT DISTINCT ra.person_id
    FROM app_role_assignment ra
    JOIN app_person p ON p.id = ra.person_id
    WHERE lower(ra.role) = lower(${roleCode})
      AND ra.is_active = TRUE
      AND p.is_active = TRUE
      AND (ra.valid_from IS NULL OR ra.valid_from <= ${at})
      AND (ra.valid_to IS NULL OR ra.valid_to > ${at})
  `);
  return rows.map((row) => row.person_id);
}

function parseSchoolLevelCode(groupCode: string | null): number | null {
  if (!groupCode || !/^\d+$/.test(groupCode.trim())) return null;
  return Number(groupCode);
}

async function resolveSchoolLevelGroup(
  client: DbClient,
  groupKind: string | null,
  groupCode: string | null,
): Promise<string[]> {
  const kind = groupKind?.trim().toLowerCase();
  if (kind !== "rocnik" && kind !== "stupen") return [];
  const code = parseSchoolLevelCode(groupCode);
  if (code == null) return [];

  const rows = await client.$queryRaw<Array<{ person_id: string }>>(Prisma.sql`
    WITH student_grades AS (
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
    SELECT DISTINCT person_id
    FROM student_grades
    WHERE (
      ${kind} = 'rocnik'
      AND rocnik = ${code}
    ) OR (
      ${kind} = 'stupen'
      AND (
        (${code} = 1 AND rocnik BETWEEN 1 AND 5)
        OR (${code} = 2 AND rocnik BETWEEN 6 AND 9)
      )
    )
  `);

  return rows.map((row) => row.person_id);
}

async function resolveGroupRule(
  client: DbClient,
  groupKind: string | null,
  groupCode: string | null,
  at: Date,
): Promise<string[]> {
  if (!groupKind || !groupCode) return [];
  const schoolLevelPersonIds = await resolveSchoolLevelGroup(client, groupKind, groupCode);
  if (schoolLevelPersonIds.length > 0) return schoolLevelPersonIds;

  const rows = await client.$queryRaw<Array<{ person_id: string }>>(Prisma.sql`
    SELECT DISTINCT gm.person_id
    FROM app_group g
    JOIN app_group_membership gm ON gm.group_id = g.id
    JOIN app_person p ON p.id = gm.person_id
    WHERE lower(g.kind::text) = lower(${groupKind})
      AND lower(g.code) = lower(${groupCode})
      AND g.is_active = TRUE
      AND p.is_active = TRUE
      AND (g.valid_from IS NULL OR g.valid_from <= ${at})
      AND (g.valid_to IS NULL OR g.valid_to > ${at})
      AND (gm.valid_from IS NULL OR gm.valid_from <= ${at})
      AND (gm.valid_to IS NULL OR gm.valid_to > ${at})
  `);
  return rows.map((row) => row.person_id);
}

async function resolvePublicRule(client: DbClient): Promise<string[]> {
  const rows = await client.appPerson.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

function ensureObject(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as Record<string, unknown>;
}

function intersection(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const value of a) {
    if (b.has(value)) out.add(value);
  }
  return out;
}

async function evalAudienceExpression(client: DbClient, expression: unknown, at: Date): Promise<Set<string>> {
  const expr = ensureObject(expression);
  if (!expr) return new Set<string>();

  if (Array.isArray(expr.all)) {
    const children = expr.all as unknown[];
    if (children.length === 0) return new Set<string>();
    const evaluated = await Promise.all(children.map((item) => evalAudienceExpression(client, item, at)));
    return evaluated.slice(1).reduce((acc, item) => intersection(acc, item), evaluated[0] ?? new Set<string>());
  }

  if (Array.isArray(expr.any)) {
    const out = new Set<string>();
    for (const child of expr.any as unknown[]) {
      const childSet = await evalAudienceExpression(client, child, at);
      for (const id of childSet) out.add(id);
    }
    return out;
  }

  if (expr.not) {
    const base = await resolvePublicRule(client);
    const excluded = await evalAudienceExpression(client, expr.not, at);
    return new Set(base.filter((personId) => !excluded.has(personId)));
  }

  if (typeof expr.personId === "string") {
    const ids = await resolvePersonRule(client, expr.personId);
    return new Set(ids);
  }

  if (typeof expr.roleCode === "string") {
    const ids = await resolveRoleRule(client, expr.roleCode, at);
    return new Set(ids);
  }

  const group = ensureObject(expr.group);
  if (group && typeof group.kind === "string" && typeof group.code === "string") {
    const ids = await resolveGroupRule(client, group.kind, group.code, at);
    return new Set(ids);
  }

  if (expr.public === true) {
    const ids = await resolvePublicRule(client);
    return new Set(ids);
  }

  return new Set<string>();
}

async function resolveLegacyTargets(client: DbClient, schoolEventId: string, at: Date): Promise<ResolvedAudienceMember[]> {
  const targets = await client.appSchoolEventTarget.findMany({
    where: { schoolEventId },
    select: {
      id: true,
      targetType: true,
      personId: true,
      groupKind: true,
      groupCode: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const people = new Map<string, string | null>();
  for (const target of targets) {
    if (target.targetType === "PERSON") {
      const personIds = await resolvePersonRule(client, target.personId);
      mergeUniqueIntoMap(people, personIds, null);
      continue;
    }
    if (target.targetType === "GROUP") {
      const groupIds = await resolveGroupRule(client, target.groupKind, target.groupCode, at);
      mergeUniqueIntoMap(people, groupIds, null);
    }
  }

  return [...people.entries()].map(([personId, sourceRuleId]) => ({ personId, sourceRuleId }));
}

async function resolveAudienceForEvent(client: DbClient, schoolEventId: string, at: Date): Promise<ResolvedAudience> {
  const rules = await client.appSchoolEventAudienceRule.findMany({
    where: {
      schoolEventId,
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (rules.length === 0) {
    const legacyMembers = await resolveLegacyTargets(client, schoolEventId, at);
    return {
      members: legacyMembers,
      usedRuleCount: 0,
      fallbackToLegacyTargets: true,
    };
  }

  const people = new Map<string, string | null>();
  for (const rule of rules) {
    if (rule.ruleType === AppSchoolEventAudienceRuleType.PERSON) {
      const personIds = await resolvePersonRule(client, rule.personId);
      mergeUniqueIntoMap(people, personIds, rule.id);
      continue;
    }

    if (rule.ruleType === AppSchoolEventAudienceRuleType.ROLE) {
      const personIds = await resolveRoleRule(client, rule.roleCode, at);
      mergeUniqueIntoMap(people, personIds, rule.id);
      continue;
    }

    if (rule.ruleType === AppSchoolEventAudienceRuleType.GROUP) {
      const personIds = await resolveGroupRule(client, rule.groupKind, rule.groupCode, at);
      mergeUniqueIntoMap(people, personIds, rule.id);
      continue;
    }

    if (rule.ruleType === AppSchoolEventAudienceRuleType.PUBLIC) {
      const personIds = await resolvePublicRule(client);
      mergeUniqueIntoMap(people, personIds, rule.id);
      continue;
    }

    if (rule.ruleType === AppSchoolEventAudienceRuleType.EXPRESSION) {
      const expressionIds = await evalAudienceExpression(client, rule.expression, at);
      mergeUniqueIntoMap(people, [...expressionIds], rule.id);
    }
  }

  return {
    members: [...people.entries()].map(([personId, sourceRuleId]) => ({ personId, sourceRuleId })),
    usedRuleCount: rules.length,
    fallbackToLegacyTargets: false,
  };
}

export async function createAudienceSnapshot(params: SnapshotParams): Promise<SnapshotResult> {
  const snapshotAt = params.snapshotAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    const event = await tx.appSchoolEvent.findUnique({
      where: { id: params.schoolEventId },
      select: {
        id: true,
        isActive: true,
        lifecycleStatus: true,
      },
    });

    if (!event) {
      throw new Error(`Akce '${params.schoolEventId}' neexistuje.`);
    }
    if (!event.isActive || !ACTIVE_STATUS_SET.has(event.lifecycleStatus)) {
      throw new Error(`Akce '${params.schoolEventId}' není ve stavu pro snapshot (${event.lifecycleStatus}).`);
    }

    const resolved = await resolveAudienceForEvent(tx, params.schoolEventId, snapshotAt);

    const batch = await tx.appSchoolEventAudienceSnapshotBatch.create({
      data: {
        schoolEventId: params.schoolEventId,
        reason: params.reason,
        snapshotAt,
        sourceRef: params.sourceRef ?? undefined,
        createdByPersonId: params.createdByPersonId ?? undefined,
        metadata: {
          resolvedVia: resolved.fallbackToLegacyTargets ? "legacy_targets_fallback" : "audience_rules",
          usedRuleCount: resolved.usedRuleCount,
          participantsCount: resolved.members.length,
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    if (resolved.members.length > 0) {
      await tx.appSchoolEventAudienceSnapshotItem.createMany({
        data: resolved.members.map((member) => ({
          batchId: batch.id,
          personId: member.personId,
          sourceRuleId: member.sourceRuleId ?? undefined,
        })),
        skipDuplicates: true,
      });
    }

    return {
      batchId: batch.id,
      schoolEventId: params.schoolEventId,
      reason: params.reason,
      snapshotAt,
      participantsCount: resolved.members.length,
    };
  });
}

export async function publishSchoolEvent(params: PublishSchoolEventParams) {
  const snapshotAt = params.snapshotAt ?? new Date();
  const snapshot = await createAudienceSnapshot({
    schoolEventId: params.schoolEventId,
    reason: AppSchoolEventSnapshotReason.PUBLISHED,
    snapshotAt,
    sourceRef: params.sourceRef ?? "api:publish",
    createdByPersonId: params.actorPersonId ?? null,
  });

  const event = await prisma.appSchoolEvent.update({
    where: { id: params.schoolEventId },
    data: {
      lifecycleStatus: AppSchoolEventLifecycleStatus.PUBLISHED,
      publishedAt: snapshotAt,
      updatedByPersonId: params.actorPersonId ?? undefined,
    },
    select: {
      id: true,
      lifecycleStatus: true,
      publishedAt: true,
    },
  });

  let syncEnqueue:
    | Awaited<ReturnType<typeof enqueueSchoolEventCalendarSyncJobs>>
    | { error: string }
    | null = null;
  try {
    syncEnqueue = await enqueueSchoolEventCalendarSyncJobs({
      schoolEventId: params.schoolEventId,
      sourceRef: params.sourceRef ?? "api:publish",
      priority: 70,
    });
  } catch (error) {
    syncEnqueue = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    event,
    snapshot,
    syncEnqueue,
  };
}

export async function closeSchoolEventRegistration(params: CloseRegistrationParams) {
  const current = await prisma.appSchoolEvent.findUnique({
    where: { id: params.schoolEventId },
    select: { id: true, lifecycleStatus: true },
  });
  if (!current) {
    throw new Error(`Akce '${params.schoolEventId}' neexistuje.`);
  }
  if (
    current.lifecycleStatus !== AppSchoolEventLifecycleStatus.PUBLISHED &&
    current.lifecycleStatus !== AppSchoolEventLifecycleStatus.REGISTRATION_CLOSED
  ) {
    throw new Error(
      `Uzávěrku registrace lze provést jen pro publikovanou akci. Aktuální stav: ${current.lifecycleStatus}.`,
    );
  }

  const snapshotAt = params.snapshotAt ?? new Date();
  const snapshot = await createAudienceSnapshot({
    schoolEventId: params.schoolEventId,
    reason: AppSchoolEventSnapshotReason.REGISTRATION_CLOSED,
    snapshotAt,
    sourceRef: params.sourceRef ?? "api:registration-close",
    createdByPersonId: params.actorPersonId ?? null,
  });

  const event = await prisma.appSchoolEvent.update({
    where: { id: params.schoolEventId },
    data: {
      lifecycleStatus: AppSchoolEventLifecycleStatus.REGISTRATION_CLOSED,
      registrationClosedAt: snapshotAt,
      updatedByPersonId: params.actorPersonId ?? undefined,
    },
    select: {
      id: true,
      lifecycleStatus: true,
      registrationClosedAt: true,
    },
  });

  let syncEnqueue:
    | Awaited<ReturnType<typeof enqueueSchoolEventCalendarSyncJobs>>
    | { error: string }
    | null = null;
  try {
    syncEnqueue = await enqueueSchoolEventCalendarSyncJobs({
      schoolEventId: params.schoolEventId,
      sourceRef: params.sourceRef ?? "api:registration-close",
      priority: 75,
    });
  } catch (error) {
    syncEnqueue = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    event,
    snapshot,
    syncEnqueue,
  };
}
