import { Prisma } from "@prisma/client";
import { AppSchoolEventLifecycleStatus, AppSchoolEventRegistrationStatus } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { resolvePersonName } from "@/src/lib/person-name";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function kioskAuthKey(): string {
  return process.env.KIOSK_API_KEY?.trim() ?? "";
}

function isKioskDevBypassEnabled(host: string | null | undefined): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const normalizedHost = (host ?? "").split(":")[0].trim().toLowerCase();
  return normalizedHost === "localhost" || normalizedHost === "127.0.0.1" || normalizedHost === "::1";
}

export function checkKioskKey(provided: string | null | undefined, host?: string | null): boolean {
  if (isKioskDevBypassEnabled(host)) return true;
  const key = kioskAuthKey();
  return !!key && provided?.trim() === key;
}

// ─── Kiosk color palette (per-term, assigned in creation order, never reused) ─

export const KIOSK_COLORS = [
  "#E74C3C", // 1 červená
  "#3498DB", // 2 modrá
  "#2ECC71", // 3 zelená
  "#F39C12", // 4 oranžová
  "#9B59B6", // 5 fialová
  "#1ABC9C", // 6 tyrkysová
  "#E91E63", // 7 růžová
  "#FF5722", // 8 tmavě oranžová
  "#8BC34A", // 9 světle zelená
  "#607D8B", // 10 šedavě modrá
] as const;

export type KioskColor = (typeof KIOSK_COLORS)[number];

/** Assign next available number+color within a term. Call inside a transaction. */
export async function assignKioskSlot(
  tx: Prisma.TransactionClient,
  termId: string,
  excludeEventId?: string,
): Promise<{ kioskDisplayNumber: number; kioskDisplayColor: string }> {
  const siblings = await tx.appSchoolEvent.findMany({
    where: {
      offerGroupId: termId,
      isActive: true,
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
    },
    select: { kioskDisplayNumber: true, kioskDisplayColor: true },
  });

  const usedNumbers = new Set(siblings.map((s) => s.kioskDisplayNumber).filter(Boolean) as number[]);
  const usedColors = new Set(siblings.map((s) => s.kioskDisplayColor).filter(Boolean) as string[]);

  // next number: max + 1, or 1 if none
  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) nextNumber++;

  // next color: first palette color not used in term
  const nextColor =
    KIOSK_COLORS.find((c) => !usedColors.has(c)) ?? KIOSK_COLORS[nextNumber % KIOSK_COLORS.length];

  return { kioskDisplayNumber: nextNumber, kioskDisplayColor: nextColor };
}

// ─── Child identification by chip ─────────────────────────────────────────────

export interface KioskChild {
  id: string;
  displayName: string;
  nickname: string | null;
  schoolGrade: number | null;
  groupKeys: string[]; // "kind::code" pairs
}

function buildChipCandidates(rawChipCode: string): string[] {
  const set = new Set<string>();
  const add = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) set.add(trimmed);
  };
  const addHidFromHex = (hex: string) => {
    if (hex.length !== 8) return;
    const b0 = parseInt(hex.slice(0, 2), 16);
    const b1 = parseInt(hex.slice(2, 4), 16);
    const b2 = parseInt(hex.slice(4, 6), 16);
    const b3 = parseInt(hex.slice(6, 8), 16);
    add(String(b0 + b1 * 256 + b2 * 65536 + b3 * 16777216));
  };

  add(rawChipCode);

  const compact = rawChipCode.trim().replace(/\s+/g, "");
  add(compact);
  add(compact.toUpperCase());

  const numeric = compact.replace(/[^0-9]/g, "");
  add(numeric);
  if (numeric) {
    try {
      add(BigInt(numeric).toString());
    } catch {
      // ignore malformed numeric candidate
    }
  }

  const hexOnly = compact.replace(/^0x/i, "").replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  add(hexOnly);
  addHidFromHex(hexOnly);

  const hexChunks = compact.match(/[0-9A-Fa-f]{8}/g) ?? [];
  for (const chunk of hexChunks) {
    const normalized = chunk.toUpperCase();
    add(normalized);
    addHidFromHex(normalized);
  }

  const numberChunks = compact.match(/\d{8,}/g) ?? [];
  for (const chunk of numberChunks) {
    add(chunk);
    try {
      add(BigInt(chunk).toString());
    } catch {
      // ignore malformed numeric chunk
    }
  }

  return Array.from(set);
}

export async function findChildByChip(chipCode: string): Promise<KioskChild | null> {
  const trimmed = chipCode.trim();
  if (!trimmed) return null;
  const candidates = buildChipCandidates(trimmed);

  const person = await prisma.appPerson.findFirst({
    where: {
      isActive: true,
      OR: [{ chipUid: { in: candidates } }, { chipHid: { in: candidates } }],
    },
    select: {
      id: true,
      displayName: true,
      nickname: true,
    },
  });
  if (!person) return null;

  // Get current grade from source record
  const gradeRows = await prisma.$queryRaw<Array<{ grade: number | null }>>(Prisma.sql`
    SELECT (sr.payload->>'CurrentGradeNum')::int AS grade
    FROM app_person_source_record sr
    WHERE sr.person_id = ${person.id}
      AND sr.active_source = TRUE
      AND sr.derived_roles @> ARRAY['zak']::text[]
      AND (sr.payload->>'CurrentGradeNum') ~ '^[0-9]+$'
    LIMIT 1
  `);
  const schoolGrade = gradeRows[0]?.grade ?? null;

  // Get current group memberships
  const now = new Date();
  const groupRows = await prisma.$queryRaw<Array<{ kind: string; code: string }>>(Prisma.sql`
    SELECT lower(g.kind::text) AS kind, lower(g.code) AS code
    FROM app_group g
    JOIN app_group_membership gm ON gm.group_id = g.id
    WHERE gm.person_id = ${person.id}
      AND g.is_active = TRUE
      AND (g.valid_from IS NULL OR g.valid_from <= ${now})
      AND (g.valid_to IS NULL OR g.valid_to > ${now})
  `).catch(() => [] as Array<{ kind: string; code: string }>);

  return {
    id: person.id,
    displayName: resolvePersonName({
      nickname: person.nickname,
      displayName: person.displayName,
    }),
    nickname: person.nickname ?? null,
    schoolGrade,
    groupKeys: groupRows.map((r) => `${r.kind}::${r.code}`),
  };
}

// ─── Available islands for a child ───────────────────────────────────────────

export interface KioskOstrov {
  id: string;
  termId: string;
  termName: string;
  termDate: string; // "YYYY-MM-DD"
  title: string;
  description: string | null;
  location: string | null;
  focus: string | null;
  thumbnailUrl: string | null;
  guides: string[];
  registrantNames: string[];
  capacity: number | null;
  occupied: number;
  registrationOpen: boolean;
  unregisterOpen: boolean;
  myRegistrationId: string | null;
  kioskDisplayNumber: number | null;
  kioskDisplayColor: string | null;
}

export interface KioskTermGroup {
  termId: string;
  termName: string;
  termDate: string;
  termStartsAt: string | null;
  registrationOpen: boolean;
  islands: KioskOstrov[];
  myRegistrationId: string | null; // registered island id or null
}

function isWindowOpen(opensAt: Date | null, closesAt: Date | null, now: Date): boolean {
  if (opensAt && now < opensAt) return false;
  if (closesAt && now > closesAt) return false;
  return true;
}

function childMatchesAudienceRule(
  child: KioskChild,
  groupKind: string | null,
  groupCode: string | null,
): boolean {
  if (!groupKind || !groupCode) return false;
  const kind = groupKind.trim().toLowerCase();
  const code = groupCode.trim().toLowerCase();

  if (kind === "rocnik") {
    return child.schoolGrade != null && child.schoolGrade === parseInt(code, 10);
  }
  if (kind === "stupen") {
    const level = parseInt(code, 10);
    if (child.schoolGrade == null) return false;
    return (
      (level === 1 && child.schoolGrade >= 1 && child.schoolGrade <= 5) ||
      (level === 2 && child.schoolGrade >= 6 && child.schoolGrade <= 9)
    );
  }
  // Custom group
  return child.groupKeys.includes(`${kind}::${code}`);
}

function childEligibleForEvent(
  child: KioskChild,
  audienceRules: Array<{ groupKind: string | null; groupCode: string | null }>,
): boolean {
  // No rules = open to all
  if (audienceRules.length === 0) return true;
  // Must match at least one rule
  return audienceRules.some((rule) =>
    childMatchesAudienceRule(child, rule.groupKind, rule.groupCode),
  );
}

export async function getKioskTermsForChild(child: KioskChild): Promise<KioskTermGroup[]> {
  const now = new Date();

  // Load all active published ostrovy events with open registration windows in active terms
  const events = await prisma.appSchoolEvent.findMany({
    where: {
      isActive: true,
      lifecycleStatus: AppSchoolEventLifecycleStatus.PUBLISHED,
      offerGroup: { isActive: true },
      eventType: { code: "OSTROVY" },
      registrationPolicy: {
        isEnabled: true,
        opensAt: { lte: now },
        closesAt: { gte: now },
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      startsAt: true,
      metadata: true,
      kioskDisplayNumber: true,
      kioskDisplayColor: true,
      offerGroup: {
        select: { id: true, name: true, metadata: true },
      },
      audienceRules: {
        where: { isActive: true, ruleType: "GROUP" },
        select: { groupKind: true, groupCode: true },
      },
      registrationPolicy: {
        select: { opensAt: true, closesAt: true, unregisterClosesAt: true, capacity: true },
      },
      registrations: {
        where: { status: { in: [AppSchoolEventRegistrationStatus.REGISTERED, AppSchoolEventRegistrationStatus.WAITLIST] } },
        select: { id: true, personId: true, status: true },
      },
    },
    orderBy: [{ offerGroup: { startsAt: "asc" } }, { kioskDisplayNumber: "asc" }],
  });

  // Batch-load preferred names (nickname first) for registrants and guides
  const allPersonIds = [
    ...new Set(
      events.flatMap((e) => {
        const rawMeta0 = (e.metadata as Record<string, unknown> | null) ?? {};
        const eventMeta0 = (rawMeta0.ostrovy as Record<string, unknown> | null) ?? rawMeta0;
        const guideIds = Array.isArray(eventMeta0["guides"])
          ? (eventMeta0["guides"] as Array<{ personId?: string | null }>)
              .map((g) => (typeof g.personId === "string" ? g.personId : null))
              .filter((id): id is string => Boolean(id))
          : [];
        return [...e.registrations.map((r) => r.personId), ...guideIds];
      }),
    ),
  ];
  const persons = allPersonIds.length > 0
    ? await prisma.appPerson.findMany({
        where: { id: { in: allPersonIds } },
        select: { id: true, nickname: true, displayName: true },
      })
    : [];
  const personNameById = new Map(
    persons.map((p) => [
      p.id,
      resolvePersonName({
        nickname: p.nickname,
        displayName: p.displayName,
      }),
    ]),
  );

  // Group by term
  const termMap = new Map<string, KioskTermGroup>();

  for (const event of events) {
    if (!event.offerGroup) continue;

    // Eligibility check
    if (!childEligibleForEvent(child, event.audienceRules)) continue;

    const termId = event.offerGroup.id;
    const meta = (event.offerGroup.metadata as Record<string, unknown> | null) ?? {};
    const termDate = typeof meta["termDate"] === "string" ? meta["termDate"] : "";

    const rawMeta0 = (event.metadata as Record<string, unknown> | null) ?? {};
    const eventMeta0 = (rawMeta0.ostrovy as Record<string, unknown> | null) ?? rawMeta0;
    const guestCount = Array.isArray(eventMeta0["guestChildren"]) ? (eventMeta0["guestChildren"] as string[]).length : 0;
    const occupied = event.registrations.length + guestCount;
    const capacity = event.registrationPolicy?.capacity ?? null;
    const regOpen = isWindowOpen(
      event.registrationPolicy?.opensAt ?? null,
      event.registrationPolicy?.closesAt ?? null,
      now,
    );
    const unregOpen = isWindowOpen(
      event.registrationPolicy?.opensAt ?? null,
      event.registrationPolicy?.unregisterClosesAt ?? null,
      now,
    );
    const myReg = event.registrations.find((r) => r.personId === child.id);
    const eventMeta = eventMeta0;

    const island: KioskOstrov = {
      id: event.id,
      termId,
      termName: event.offerGroup.name,
      termDate,
      title: event.title,
      description: event.description ?? null,
      location: event.location ?? null,
      focus: typeof eventMeta["focus"] === "string" ? eventMeta["focus"] : null,
      thumbnailUrl: typeof eventMeta["thumbnailUrl"] === "string" ? eventMeta["thumbnailUrl"] : null,
      guides: Array.isArray(eventMeta["guides"])
        ? (eventMeta["guides"] as Array<{ personId?: string | null; name?: string }>)
            .map((g) => {
              if (typeof g.personId === "string") {
                const preferred = personNameById.get(g.personId);
                if (preferred) return preferred;
              }
              return typeof g.name === "string" ? g.name : "";
            })
            .filter(Boolean)
        : [],
      registrantNames: [
        ...event.registrations.map((r) => personNameById.get(r.personId) ?? ""),
        ...(Array.isArray(eventMeta["guestChildren"]) ? (eventMeta["guestChildren"] as string[]) : []),
      ].filter(Boolean),
      capacity,
      occupied,
      registrationOpen: regOpen,
      unregisterOpen: unregOpen,
      myRegistrationId: myReg ? event.id : null,
      kioskDisplayNumber: event.kioskDisplayNumber,
      kioskDisplayColor: event.kioskDisplayColor,
    };

    if (!termMap.has(termId)) {
      termMap.set(termId, {
        termId,
        termName: event.offerGroup.name,
        termDate,
        termStartsAt: event.startsAt?.toISOString() ?? null,
        registrationOpen: regOpen,
        islands: [],
        myRegistrationId: null,
      });
    }
    const term = termMap.get(termId)!;
    term.islands.push(island);
    if (myReg) term.myRegistrationId = event.id;
    if (regOpen) term.registrationOpen = true;
  }

  return [...termMap.values()];
}
