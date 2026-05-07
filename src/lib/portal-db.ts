import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { prisma } from "@/src/lib/prisma";
import { resolvePersonName } from "@/src/lib/person-name";

export interface PortalParent {
  id: string;
  name: string;
}

export interface PortalChild {
  id: string;
  name: string;
  displayName: string | null;
  firstName: string | null;
  nickname: string | null;
  rocnik: number | null;
  stupen: 1 | 2 | null;
  smecka: string | null;
}

export interface PortalLodickaRow {
  id: string;
  lodickaId: string;
  kodLodicky: string | null;
  kodOsobniLodicky: string | null;
  predmet: string;
  podpredmet: string;
  oblast: string;
  nazevLodicky: string;
  typ: string | null;
  stupen: string | null;
  rocnikOd: number | null;
  rocnikDo: number | null;
  garantPersonId: string | null;
  garantName: string | null;
  stav: string;
  hodnota: number | null;
  uspech: string;
  poznamka: string;
  datumStavu: string | null;
  history: PortalLodickaHistoryRow[];
}

export interface PortalLodickaCatalogRow {
  lodickaId: string;
  kodLodicky: string | null;
  predmet: string;
  podpredmet: string;
  oblast: string;
  nazevLodicky: string;
  typ: string | null;
  stupen: string | null;
  rocnikOd: number | null;
  rocnikDo: number | null;
  garantPersonId: string | null;
  garantName: string | null;
}

export type PortalOsobniLodickaCurrentRow = [
  childIndex: number,
  id: string,
  lodickaIndex: number,
  kodOsobniLodicky: string | null,
  stav: string,
  hodnota: number | null,
  uspech: string,
  poznamka: string,
  datumStavu: string | null,
  history?: PortalLodickaHistoryRow[],
];

export interface PortalLodickaHistoryRow {
  id: string;
  stav: string;
  hodnota: number | null;
  datumStavu: string | null;
  poznamka: string | null;
  uspech: string | null;
  changedByPersonId: string | null;
  changedByLabel: string | null;
  sourceCreatedByLabel: string | null;
  sourceModifiedByLabel: string | null;
  sourceCreatedAt: string | null;
  sourceModifiedAt: string | null;
  createdAt: string | null;
}

type ParentChildRow = {
  parent_id: string;
  parent_name: string;
  parent_nickname: string | null;
  parent_first_name: string | null;
  has_rodic_role: boolean;
  has_global_child_access: boolean;
  child_id: string | null;
  child_name: string | null;
  child_nickname: string | null;
  child_first_name: string | null;
  child_grade_num: number | null;
  child_rocnik_code: string | null;
  child_stupen_code: string | null;
  child_smecka_name: string | null;
};

type ActiveChildRow = {
  child_id: string;
  child_name: string;
  child_nickname: string | null;
  child_first_name: string | null;
  child_grade_num: number | null;
  child_rocnik_code: string | null;
  child_stupen_code: string | null;
  child_smecka_name: string | null;
};

type LodickaQueryRow = {
  child_id?: string;
  id: string;
  lodicka_id: string;
  kod_lodicky: string | null;
  kod_osobni_lodicky: string | null;
  predmet: string;
  podpredmet: string | null;
  oblast: string;
  nazev_lodicky: string;
  typ: string | null;
  stupen: string | null;
  rocnik_od: number | null;
  rocnik_do: number | null;
  garant_person_id: string | null;
  garant_name: string | null;
  stav: string | null;
  hodnota: number | null;
  uspech: string | null;
  poznamka: string | null;
  datum_stavu: Date | string | null;
  history_json: unknown;
};

type CompactPayloadQueryRow = {
  catalog_items: unknown;
  personal_items: unknown;
  child_ids_with_rows: string[] | null;
};

type ParentCandidate = {
  id: string;
  displayName: string;
  hasRodicRole: boolean;
  children: PortalChild[];
};

type PortalActorAccessInput = {
  email: string;
  personIds: string[];
  roles: string[];
};

export type PortalLodickaStav = 0 | 1 | 2 | 3 | 4;

type PortalSaveLodickaStatusInput = {
  personalLodickaId: string;
  effectiveDate: string;
  status: PortalLodickaStav;
  overwriteSameDate: boolean;
  allowHistorical: boolean;
  invalidateNewer: boolean;
  note?: string | null;
  actorPersonId: string | null;
  actorLabel: string;
};

type PortalSaveLodickaStatusResult =
  | {
      ok: true;
      event: {
        id: string;
        osobniLodickaId: string;
        datumStavu: string;
        zapsanoAt: string;
        stav: PortalLodickaStav;
        zapsalId: string;
        poznamka?: string;
      };
      invalidatedEventIds: string[];
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "FORBIDDEN" | "SAME_DATE_EXISTS" | "HISTORICAL_CONFLICT" | "INVALID_INPUT";
      message: string;
      sameDateCount?: number;
      newerCount?: number;
    };

const GLOBAL_CHILD_ACCESS_ROLES = new Set(["tester", "garant", "pruvodce", "ucitel", "zamestnanec"]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeText(value: string | null | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toHistoryRows(value: unknown): PortalLodickaHistoryRow[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PortalLodickaHistoryRow | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;

      const id = typeof row.id === "string" ? row.id : "";
      if (!id) return null;

      const stav =
        typeof row.stavLabel === "string" && row.stavLabel.trim()
          ? row.stavLabel.trim()
          : typeof row.stav === "string" && row.stav.trim()
            ? row.stav.trim()
            : "Nezahájeno";

      return {
        id,
        stav,
        hodnota: typeof row.hodnota === "number" && Number.isFinite(row.hodnota) ? row.hodnota : null,
        datumStavu: toIso(
          row.datumStavu instanceof Date || typeof row.datumStavu === "string" ? row.datumStavu : null,
        ),
        poznamka: typeof row.poznamka === "string" ? row.poznamka : null,
        uspech: typeof row.uspech === "string" ? row.uspech : null,
        changedByPersonId: typeof row.changedByPersonId === "string" ? row.changedByPersonId : null,
        changedByLabel: typeof row.changedByLabel === "string" ? row.changedByLabel : null,
        sourceCreatedByLabel:
          typeof row.sourceCreatedByLabel === "string" ? row.sourceCreatedByLabel : null,
        sourceModifiedByLabel:
          typeof row.sourceModifiedByLabel === "string" ? row.sourceModifiedByLabel : null,
        sourceCreatedAt: toIso(
          row.sourceCreatedAt instanceof Date || typeof row.sourceCreatedAt === "string"
            ? row.sourceCreatedAt
            : null,
        ),
        sourceModifiedAt: toIso(
          row.sourceModifiedAt instanceof Date || typeof row.sourceModifiedAt === "string"
            ? row.sourceModifiedAt
            : null,
        ),
        createdAt: toIso(
          row.createdAt instanceof Date || typeof row.createdAt === "string" ? row.createdAt : null,
        ),
      };
    })
    .filter((row): row is PortalLodickaHistoryRow => row !== null);
}

function dedupeChildren(children: PortalChild[]): PortalChild[] {
  const unique = new Map<string, PortalChild>();
  for (const child of children) {
    const existing = unique.get(child.id);
    if (!existing) {
      unique.set(child.id, child);
      continue;
    }

    unique.set(child.id, {
      id: existing.id,
      name: existing.name,
      displayName: existing.displayName ?? child.displayName,
      firstName: existing.firstName ?? child.firstName,
      nickname: existing.nickname ?? child.nickname,
      rocnik: existing.rocnik ?? child.rocnik,
      stupen: existing.stupen ?? child.stupen,
      smecka: existing.smecka ?? child.smecka,
    });
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "cs"));
}

function parseRocnik(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return rounded >= 1 && rounded <= 9 ? rounded : null;
  }

  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (!match) return null;
    const parsed = Number(match[0]);
    if (!Number.isFinite(parsed)) return null;
    return parsed >= 1 && parsed <= 9 ? parsed : null;
  }

  return null;
}

function parseStupen(value: string | null | undefined, rocnik: number | null): 1 | 2 | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "1" || normalized.startsWith("1.")) return 1;
  if (normalized === "2" || normalized.startsWith("2.")) return 2;
  if (rocnik === null) return null;
  return rocnik <= 5 ? 1 : 2;
}

function pickParentCandidate(candidates: ParentCandidate[]): ParentCandidate | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    if (a.hasRodicRole !== b.hasRodicRole) return a.hasRodicRole ? -1 : 1;
    if (a.children.length !== b.children.length) return b.children.length - a.children.length;
    return a.displayName.localeCompare(b.displayName, "cs");
  });
  return sorted[0] ?? null;
}

async function getActiveChildren(
  childIds?: string[],
  preferFirstNameIds: ReadonlySet<string> = new Set<string>(),
): Promise<PortalChild[]> {
  const idFilter =
    childIds && childIds.length > 0
      ? Prisma.sql`AND c.id IN (${Prisma.join(childIds)})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<ActiveChildRow[]>(Prisma.sql`
    SELECT
      c.id AS child_id,
      c.display_name AS child_name,
      c.nickname AS child_nickname,
      c.first_name AS child_first_name,
      ss.current_grade_num AS child_grade_num,
      grp_rocnik.code AS child_rocnik_code,
      grp_stupen.code AS child_stupen_code,
      grp_smecka.name AS child_smecka_name
    FROM app_person c
    JOIN app_role_assignment cra
      ON cra.person_id = c.id
      AND cra.role = 'zak'
      AND cra.is_active = true
    LEFT JOIN LATERAL (
      SELECT
        s.current_grade_num,
        s.study_mode_code,
        s.study_mode_key
      FROM app_student_state s
      WHERE s.person_id = c.id
        AND (s.effective_to IS NULL OR s.effective_to::date >= CURRENT_DATE)
      ORDER BY s.effective_from DESC, s.created_at DESC
      LIMIT 1
    ) ss ON true
    LEFT JOIN LATERAL (
      SELECT g.code
      FROM app_group_membership gm
      JOIN app_group g ON g.id = gm.group_id
      WHERE gm.person_id = c.id
        AND gm.group_kind = 'rocnik'
        AND gm.valid_from <= NOW()
        AND (gm.valid_to IS NULL OR gm.valid_to >= NOW())
        AND g.is_active = true
      ORDER BY gm.valid_from DESC, gm.created_at DESC
      LIMIT 1
    ) grp_rocnik ON true
    LEFT JOIN LATERAL (
      SELECT g.code
      FROM app_group_membership gm
      JOIN app_group g ON g.id = gm.group_id
      WHERE gm.person_id = c.id
        AND gm.group_kind = 'stupen'
        AND gm.valid_from <= NOW()
        AND (gm.valid_to IS NULL OR gm.valid_to >= NOW())
        AND g.is_active = true
      ORDER BY gm.valid_from DESC, gm.created_at DESC
      LIMIT 1
    ) grp_stupen ON true
    LEFT JOIN LATERAL (
      SELECT g.name
      FROM app_group_membership gm
      JOIN app_group g ON g.id = gm.group_id
      WHERE gm.person_id = c.id
        AND gm.group_kind = 'smecka'
        AND gm.valid_from <= NOW()
        AND (gm.valid_to IS NULL OR gm.valid_to >= NOW())
        AND g.is_active = true
      ORDER BY gm.valid_from DESC, gm.created_at DESC
      LIMIT 1
    ) grp_smecka ON true
    WHERE c.is_active = true
      AND (
        ss.study_mode_code = '11'
        OR lower(ss.study_mode_key::text) = 'denni'
      )
      ${idFilter}
    ORDER BY c.display_name
  `);

  return dedupeChildren(
    rows.map((row) => {
      const rocnik = parseRocnik(row.child_grade_num ?? row.child_rocnik_code);
      return {
        id: row.child_id,
        name: resolvePersonName(
          {
            nickname: row.child_nickname,
            displayName: row.child_name,
            firstName: row.child_first_name,
          },
          { preferFirstName: preferFirstNameIds.has(row.child_id) },
        ),
        displayName: row.child_name,
        firstName: row.child_first_name,
        nickname: row.child_nickname,
        rocnik,
        stupen: parseStupen(row.child_stupen_code, rocnik),
        smecka: normalizeOptionalText(row.child_smecka_name),
      };
    })
  );
}

async function getAllActiveChildren(preferFirstNameIds: ReadonlySet<string> = new Set<string>()): Promise<PortalChild[]> {
  return getActiveChildren(undefined, preferFirstNameIds);
}

function normalizeRoles(roles: string[]): string[] {
  return roles.map((role) => role.trim().toLowerCase()).filter(Boolean);
}

async function getPortalActor(personIds: string[], email: string): Promise<PortalParent> {
  const actor = personIds.length > 0
    ? await prisma.appPerson.findFirst({
        where: {
          id: { in: personIds },
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          nickname: true,
          displayName: true,
        },
        orderBy: {
          displayName: "asc",
        },
      })
    : null;

  return {
    id: actor?.id ?? normalizeEmail(email),
    name: actor
      ? resolvePersonName({
          nickname: actor.nickname,
          displayName: actor.displayName,
          firstName: actor.firstName,
        })
      : normalizeEmail(email),
  };
}

async function getAccessibleChildrenByActor(personIds: string[], roles: string[]): Promise<PortalChild[]> {
  const normalizedRoles = normalizeRoles(roles);
  const preferFirstNameIds = new Set<string>();

  if (normalizedRoles.includes("rodic") && personIds.length > 0) {
    const parentChildren = await prisma.appPersonRelation.findMany({
      where: {
        parentPersonId: { in: personIds },
        relationType: "parent_of",
        isActive: true,
        childPerson: {
          is: {
            isActive: true,
            roles: { some: { role: "zak", isActive: true } },
          },
        },
      },
      select: { childPersonId: true },
    });
    for (const link of parentChildren) preferFirstNameIds.add(link.childPersonId);
  }

  if (normalizedRoles.some((role) => GLOBAL_CHILD_ACCESS_ROLES.has(role))) {
    return getAllActiveChildren(preferFirstNameIds);
  }

  if (personIds.length === 0) return [];

  const childIds = new Set<string>();

  if (normalizedRoles.includes("zak")) {
    const directStudents = await prisma.appPerson.findMany({
      where: {
        id: { in: personIds },
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
      },
      select: { id: true },
    });
    for (const student of directStudents) childIds.add(student.id);
  }

  if (normalizedRoles.includes("rodic")) {
    const parentChildren = await prisma.appPersonRelation.findMany({
      where: {
        parentPersonId: { in: personIds },
        relationType: "parent_of",
        isActive: true,
        childPerson: {
          is: {
            isActive: true,
            roles: { some: { role: "zak", isActive: true } },
          },
        },
      },
      select: { childPersonId: true },
    });
    for (const link of parentChildren) childIds.add(link.childPersonId);
  }

  if (childIds.size === 0) return [];
  return getActiveChildren([...childIds], preferFirstNameIds);
}

export async function getPortalParentAndChildrenForActor(input: PortalActorAccessInput): Promise<{
  parent: PortalParent;
  children: PortalChild[];
} | null> {
  const personIds = [...new Set(input.personIds.filter(Boolean))];
  const children = await getAccessibleChildrenByActor(personIds, input.roles);
  if (children.length === 0) return null;

  return {
    parent: await getPortalActor(personIds, input.email),
    children,
  };
}

export async function filterChildrenByGarant(children: PortalChild[], garantPersonId: string): Promise<PortalChild[]> {
  const trimmedGarantId = garantPersonId.trim();
  if (!trimmedGarantId || children.length === 0) return children;

  const childIds = children.map((child) => child.id);
  const rows = await prisma.$queryRaw<Array<{ child_id: string }>>(Prisma.sql`
    SELECT DISTINCT os.person_id AS child_id
    FROM app_m01_osobni_sada_lodicek os
    JOIN app_m01_osobni_lodicka ol
      ON ol.osobni_sada_id = os.id
      AND ol.is_deleted = false
    JOIN app_m01_lodicka l
      ON l.id = ol.lodicka_id
      AND l.is_deleted = false
    WHERE os.status = 'ACTIVE'
      AND os.person_id IN (${Prisma.join(childIds)})
      AND l.garant_person_id = ${trimmedGarantId}
  `);

  const allowed = new Set(rows.map((row) => row.child_id));
  return children.filter((child) => allowed.has(child.id));
}

export async function getPortalParentAndChildrenByEmail(email: string): Promise<{
  parent: PortalParent;
  children: PortalChild[];
} | null> {
  const normalizedEmail = normalizeEmail(email);

  const rows = await prisma.$queryRaw<ParentChildRow[]>`
    SELECT
      p.id AS parent_id,
      p.display_name AS parent_name,
      p.nickname AS parent_nickname,
      p.first_name AS parent_first_name,
      EXISTS (
        SELECT 1
        FROM app_role_assignment ra
        WHERE ra.person_id = p.id
          AND ra.role = 'rodic'
          AND ra.is_active = true
      ) AS has_rodic_role,
      EXISTS (
        SELECT 1
        FROM app_role_assignment ra
        WHERE ra.person_id = p.id
          AND ra.is_active = true
          AND ra.role = 'garant'
      ) AS has_global_child_access,
      c.id AS child_id,
      c.display_name AS child_name,
      c.nickname AS child_nickname,
      c.first_name AS child_first_name,
      ss.current_grade_num AS child_grade_num,
      grp_rocnik.code AS child_rocnik_code,
      grp_stupen.code AS child_stupen_code,
      grp_smecka.name AS child_smecka_name
    FROM app_login_identity li
    JOIN app_login_person_link lpl
      ON lpl.identity_id = li.id
      AND lpl.status = 'approved'
    JOIN app_person p
      ON p.id = lpl.person_id
      AND p.is_active = true
    LEFT JOIN app_person_relation rel
      ON rel.parent_person_id = p.id
      AND rel.relation_type = 'parent_of'
      AND rel.is_active = true
    LEFT JOIN app_person c
      ON c.id = rel.child_person_id
      AND c.is_active = true
    LEFT JOIN LATERAL (
      SELECT
        s.current_grade_num,
        s.study_mode_code,
        s.study_mode_key
      FROM app_student_state s
      WHERE s.person_id = c.id
        AND (s.effective_to IS NULL OR s.effective_to::date >= CURRENT_DATE)
      ORDER BY s.effective_from DESC, s.created_at DESC
      LIMIT 1
    ) ss ON true
    LEFT JOIN LATERAL (
      SELECT g.code
      FROM app_group_membership gm
      JOIN app_group g ON g.id = gm.group_id
      WHERE gm.person_id = c.id
        AND gm.group_kind = 'rocnik'
        AND gm.valid_from <= NOW()
        AND (gm.valid_to IS NULL OR gm.valid_to >= NOW())
        AND g.is_active = true
      ORDER BY gm.valid_from DESC, gm.created_at DESC
      LIMIT 1
    ) grp_rocnik ON true
    LEFT JOIN LATERAL (
      SELECT g.code
      FROM app_group_membership gm
      JOIN app_group g ON g.id = gm.group_id
      WHERE gm.person_id = c.id
        AND gm.group_kind = 'stupen'
        AND gm.valid_from <= NOW()
        AND (gm.valid_to IS NULL OR gm.valid_to >= NOW())
        AND g.is_active = true
      ORDER BY gm.valid_from DESC, gm.created_at DESC
      LIMIT 1
    ) grp_stupen ON true
    LEFT JOIN LATERAL (
      SELECT g.name
      FROM app_group_membership gm
      JOIN app_group g ON g.id = gm.group_id
      WHERE gm.person_id = c.id
        AND gm.group_kind = 'smecka'
        AND gm.valid_from <= NOW()
        AND (gm.valid_to IS NULL OR gm.valid_to >= NOW())
        AND g.is_active = true
      ORDER BY gm.valid_from DESC, gm.created_at DESC
      LIMIT 1
    ) grp_smecka ON true
    WHERE li.identity_type = 'email'
      AND li.normalized_value = ${normalizedEmail}
      AND li.is_active = true
      AND (
        ss.study_mode_code = '11'
        OR lower(ss.study_mode_key::text) = 'denni'
      )
  `;

  if (rows.length === 0) return null;

  const candidatesByParentId = new Map<string, ParentCandidate>();

  for (const row of rows) {
    const candidate =
      candidatesByParentId.get(row.parent_id) ??
      {
        id: row.parent_id,
        displayName: resolvePersonName({
          nickname: row.parent_nickname,
          displayName: row.parent_name,
          firstName: row.parent_first_name,
        }),
        hasRodicRole: row.has_rodic_role,
        children: [],
      };

    if (row.child_id && row.child_name) {
      const rocnik = parseRocnik(row.child_grade_num ?? row.child_rocnik_code);
      candidate.children.push({
        id: row.child_id,
        name: resolvePersonName(
          {
            nickname: row.child_nickname,
            displayName: row.child_name,
            firstName: row.child_first_name,
          },
          { preferFirstName: true },
        ),
        displayName: row.child_name,
        firstName: row.child_first_name,
        nickname: row.child_nickname,
        rocnik,
        stupen: parseStupen(row.child_stupen_code, rocnik),
        smecka: normalizeOptionalText(row.child_smecka_name),
      });
    }

    candidatesByParentId.set(row.parent_id, candidate);
  }

  const parentCandidates = [...candidatesByParentId.values()].map((candidate) => ({
    ...candidate,
    children: dedupeChildren(candidate.children),
  }));

  const parentCandidate = pickParentCandidate(parentCandidates);
  if (!parentCandidate) return null;

  const hasGlobalChildAccess = rows.some((row) => row.has_global_child_access);

  const children = hasGlobalChildAccess
    ? await getAllActiveChildren()
    : parentCandidate.children;

  return {
    parent: {
      id: parentCandidate.id,
      name: parentCandidate.displayName,
    },
    children,
  };
}

async function getPortalChildLodickyFromContext(
  context: { parent: PortalParent; children: PortalChild[] },
  childId: string,
  options?: { includeHistory?: boolean; garantPersonId?: string | null },
): Promise<{
  parent: PortalParent;
  child: PortalChild;
  lodicky: PortalLodickaRow[];
} | null> {
  const child = context.children.find((item) => item.id === childId);
  if (!child) return null;

  const includeHistory = options?.includeHistory === true;
  const garantPersonId = options?.garantPersonId?.trim() ?? "";
  const historySelect = includeHistory
    ? Prisma.sql`ev.history_json AS history_json`
    : Prisma.sql`'[]'::json AS history_json`;
  const historyJoin = includeHistory
    ? Prisma.sql`
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', e.id,
            'stavLabel', e.stav_label,
            'hodnota', e.hodnota,
            'datumStavu', e.datum_stavu,
            'poznamka', e.poznamka,
            'uspech', e.uspech,
            'changedByPersonId', e.changed_by_person_id,
            'changedByLabel', e.changed_by_label,
            'sourceCreatedByLabel', e.source_created_by_label,
            'sourceModifiedByLabel', e.source_modified_by_label,
            'sourceCreatedAt', e.source_created_at,
            'sourceModifiedAt', e.source_modified_at,
            'createdAt', e.created_at
          )
          ORDER BY e.datum_stavu ASC, e.created_at ASC
        ) AS history_json
        FROM app_m01_osobni_lodicka_event e
        WHERE e.osobni_lodicka_id = ol.id
          AND COALESCE(e.is_invalidated, false) = false
      ) ev ON true
    `
    : Prisma.empty;
  const garantFilter = garantPersonId
    ? Prisma.sql`AND l.garant_person_id = ${garantPersonId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<LodickaQueryRow[]>`
    SELECT
      ol.id AS id,
      l.id AS lodicka_id,
      l.kod AS kod_lodicky,
      ol.kod_osobni_lodicky AS kod_osobni_lodicky,
      pr.nazev AS predmet,
      pp.nazev AS podpredmet,
      ob.nazev AS oblast,
      l.nazev AS nazev_lodicky,
      l.typ::text AS typ,
      l.stupen::text AS stupen,
      l.rocnik_od AS rocnik_od,
      l.rocnik_do AS rocnik_do,
      l.garant_person_id AS garant_person_id,
      gp.display_name AS garant_name,
      ol.current_stav_label AS stav,
      ol.current_hodnota AS hodnota,
      ol.uspech AS uspech,
      ol.poznamka AS poznamka,
      ol.datum_stavu AS datum_stavu,
      ${historySelect}
    FROM app_m01_osobni_sada_lodicek os
    JOIN app_m01_osobni_lodicka ol
      ON ol.osobni_sada_id = os.id
      AND ol.is_deleted = false
    JOIN app_m01_lodicka l
      ON l.id = ol.lodicka_id
      AND l.is_deleted = false
    JOIN app_m01_predmet pr
      ON pr.id = l.predmet_id
    LEFT JOIN app_m01_podpredmet pp
      ON pp.id = l.podpredmet_id
    JOIN app_m01_oblast ob
      ON ob.id = l.oblast_id
    LEFT JOIN app_person gp
      ON gp.id = l.garant_person_id
    ${historyJoin}
    WHERE os.person_id = ${child.id}
      AND os.status = 'ACTIVE'
      ${garantFilter}
    ORDER BY pr.nazev ASC, pp.nazev ASC NULLS FIRST, ob.nazev ASC, l.nazev ASC
  `;

  const lodicky: PortalLodickaRow[] = rows.map((row) => ({
    id: row.id,
    lodickaId: row.lodicka_id,
    kodLodicky: normalizeOptionalText(row.kod_lodicky),
    kodOsobniLodicky: normalizeOptionalText(row.kod_osobni_lodicky),
    predmet: normalizeText(row.predmet, "—"),
    podpredmet: normalizeText(row.podpredmet, "—"),
    oblast: normalizeText(row.oblast, "—"),
    nazevLodicky: normalizeText(row.nazev_lodicky, "—"),
    typ: normalizeOptionalText(row.typ),
    stupen: normalizeOptionalText(row.stupen),
    rocnikOd: typeof row.rocnik_od === "number" ? row.rocnik_od : null,
    rocnikDo: typeof row.rocnik_do === "number" ? row.rocnik_do : null,
    garantPersonId: normalizeOptionalText(row.garant_person_id),
    garantName: normalizeOptionalText(row.garant_name),
    stav: normalizeText(row.stav, "Nezahájeno"),
    hodnota: typeof row.hodnota === "number" && Number.isFinite(row.hodnota) ? row.hodnota : null,
    uspech: normalizeText(row.uspech, "—"),
    poznamka: normalizeText(row.poznamka, "—"),
    datumStavu: toIso(row.datum_stavu),
    history: toHistoryRows(row.history_json),
  }));

  return {
    parent: context.parent,
    child,
    lodicky,
  };
}

export async function getPortalChildLodickyByEmail(email: string, childId: string): Promise<{
  parent: PortalParent;
  child: PortalChild;
  lodicky: PortalLodickaRow[];
} | null> {
  const context = await getPortalParentAndChildrenByEmail(email);
  if (!context) return null;
  return getPortalChildLodickyFromContext(context, childId, { includeHistory: true });
}

export async function getPortalChildLodickyForActor(
  input: PortalActorAccessInput,
  childId: string,
  options?: { includeHistory?: boolean; garantPersonId?: string | null },
): Promise<{
  parent: PortalParent;
  child: PortalChild;
  lodicky: PortalLodickaRow[];
} | null> {
  const context = await getPortalParentAndChildrenForActor(input);
  if (!context) return null;
  return getPortalChildLodickyFromContext(context, childId, options);
}

export async function getPortalLodickyByActor(
  input: PortalActorAccessInput,
  options?: {
    includeHistory?: boolean;
    garantPersonId?: string | null;
    childIds?: string[];
    context?: { parent: PortalParent; children: PortalChild[] };
  },
): Promise<{
  parent: PortalParent;
  children: PortalChild[];
  lodickyByChild: Record<string, PortalLodickaRow[]>;
} | null> {
  const context = options?.context ?? await getPortalParentAndChildrenForActor(input);
  if (!context) return null;

  const includeHistory = options?.includeHistory === true;
  const garantPersonId = options?.garantPersonId?.trim() ?? "";
  const requestedChildIds = [...new Set((options?.childIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const accessibleChildren =
    requestedChildIds.length > 0
      ? context.children.filter((child) => requestedChildIds.includes(child.id))
      : context.children;
  if (accessibleChildren.length === 0) {
    return {
      parent: context.parent,
      children: [],
      lodickyByChild: {},
    };
  }

  const childIds = accessibleChildren.map((child) => child.id);
  const historySelect = includeHistory
    ? Prisma.sql`ev.history_json AS history_json`
    : Prisma.sql`'[]'::json AS history_json`;
  const historyJoin = includeHistory
    ? Prisma.sql`
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', e.id,
            'stavLabel', e.stav_label,
            'hodnota', e.hodnota,
            'datumStavu', e.datum_stavu,
            'poznamka', e.poznamka,
            'uspech', e.uspech,
            'changedByPersonId', e.changed_by_person_id,
            'changedByLabel', e.changed_by_label,
            'sourceCreatedByLabel', e.source_created_by_label,
            'sourceModifiedByLabel', e.source_modified_by_label,
            'sourceCreatedAt', e.source_created_at,
            'sourceModifiedAt', e.source_modified_at,
            'createdAt', e.created_at
          )
          ORDER BY e.datum_stavu ASC, e.created_at ASC
        ) AS history_json
        FROM app_m01_osobni_lodicka_event e
        WHERE e.osobni_lodicka_id = ol.id
          AND COALESCE(e.is_invalidated, false) = false
      ) ev ON true
    `
    : Prisma.empty;
  const garantFilter = garantPersonId
    ? Prisma.sql`AND l.garant_person_id = ${garantPersonId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<LodickaQueryRow[]>(Prisma.sql`
    SELECT
      os.person_id AS child_id,
      ol.id AS id,
      l.id AS lodicka_id,
      l.kod AS kod_lodicky,
      ol.kod_osobni_lodicky AS kod_osobni_lodicky,
      pr.nazev AS predmet,
      pp.nazev AS podpredmet,
      ob.nazev AS oblast,
      l.nazev AS nazev_lodicky,
      l.typ::text AS typ,
      l.stupen::text AS stupen,
      l.rocnik_od AS rocnik_od,
      l.rocnik_do AS rocnik_do,
      l.garant_person_id AS garant_person_id,
      gp.display_name AS garant_name,
      ol.current_stav_label AS stav,
      ol.current_hodnota AS hodnota,
      ol.uspech AS uspech,
      ol.poznamka AS poznamka,
      ol.datum_stavu AS datum_stavu,
      ${historySelect}
    FROM app_m01_osobni_sada_lodicek os
    JOIN app_m01_osobni_lodicka ol
      ON ol.osobni_sada_id = os.id
      AND ol.is_deleted = false
    JOIN app_m01_lodicka l
      ON l.id = ol.lodicka_id
      AND l.is_deleted = false
    JOIN app_m01_predmet pr
      ON pr.id = l.predmet_id
    LEFT JOIN app_m01_podpredmet pp
      ON pp.id = l.podpredmet_id
    JOIN app_m01_oblast ob
      ON ob.id = l.oblast_id
    LEFT JOIN app_person gp
      ON gp.id = l.garant_person_id
    ${historyJoin}
    WHERE os.person_id IN (${Prisma.join(childIds)})
      AND os.status = 'ACTIVE'
      ${garantFilter}
    ORDER BY os.person_id ASC, pr.nazev ASC, pp.nazev ASC NULLS FIRST, ob.nazev ASC, l.nazev ASC
  `);

  const lodickyByChild: Record<string, PortalLodickaRow[]> = {};
  for (const childId of childIds) lodickyByChild[childId] = [];

  for (const row of rows) {
    const childId = row.child_id ?? "";
    if (!childId || !lodickyByChild[childId]) continue;

    lodickyByChild[childId].push({
      id: row.id,
      lodickaId: row.lodicka_id,
      kodLodicky: normalizeOptionalText(row.kod_lodicky),
      kodOsobniLodicky: normalizeOptionalText(row.kod_osobni_lodicky),
      predmet: normalizeText(row.predmet, "—"),
      podpredmet: normalizeText(row.podpredmet, "—"),
      oblast: normalizeText(row.oblast, "—"),
      nazevLodicky: normalizeText(row.nazev_lodicky, "—"),
      typ: normalizeOptionalText(row.typ),
      stupen: normalizeOptionalText(row.stupen),
      rocnikOd: typeof row.rocnik_od === "number" ? row.rocnik_od : null,
      rocnikDo: typeof row.rocnik_do === "number" ? row.rocnik_do : null,
      garantPersonId: normalizeOptionalText(row.garant_person_id),
      garantName: normalizeOptionalText(row.garant_name),
      stav: normalizeText(row.stav, "Nezahájeno"),
      hodnota: typeof row.hodnota === "number" && Number.isFinite(row.hodnota) ? row.hodnota : null,
      uspech: normalizeText(row.uspech, "—"),
      poznamka: normalizeText(row.poznamka, "—"),
      datumStavu: toIso(row.datum_stavu),
      history: toHistoryRows(row.history_json),
    });
  }

  return {
    parent: context.parent,
    children: garantPersonId
      ? accessibleChildren.filter((child) => (lodickyByChild[child.id]?.length ?? 0) > 0)
      : accessibleChildren,
    lodickyByChild,
  };
}

export async function getPortalLodickyCompactByActor(
  input: PortalActorAccessInput,
  options?: {
    includeHistory?: boolean;
    garantPersonId?: string | null;
    childIds?: string[];
    context?: { parent: PortalParent; children: PortalChild[] };
  },
): Promise<{
  parent: PortalParent;
  children: PortalChild[];
  lodickyCatalog: PortalLodickaCatalogRow[];
  osobniLodicky: PortalOsobniLodickaCurrentRow[];
} | null> {
  const context = options?.context ?? await getPortalParentAndChildrenForActor(input);
  if (!context) return null;

  const includeHistory = options?.includeHistory === true;
  const garantPersonId = options?.garantPersonId?.trim() ?? "";
  const requestedChildIds = [...new Set((options?.childIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const accessibleChildren =
    requestedChildIds.length > 0
      ? context.children.filter((child) => requestedChildIds.includes(child.id))
      : context.children;

  if (accessibleChildren.length === 0) {
    return {
      parent: context.parent,
      children: [],
      lodickyCatalog: [],
      osobniLodicky: [],
    };
  }

  const childIds = accessibleChildren.map((child) => child.id);
  const historyJoin = includeHistory
    ? Prisma.sql`
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', e.id,
            'stavLabel', e.stav_label,
            'hodnota', e.hodnota,
            'datumStavu', e.datum_stavu,
            'poznamka', e.poznamka,
            'uspech', e.uspech,
            'changedByPersonId', e.changed_by_person_id,
            'changedByLabel', e.changed_by_label,
            'sourceCreatedByLabel', e.source_created_by_label,
            'sourceModifiedByLabel', e.source_modified_by_label,
            'sourceCreatedAt', e.source_created_at,
            'sourceModifiedAt', e.source_modified_at,
            'createdAt', e.created_at
          )
          ORDER BY e.datum_stavu ASC, e.created_at ASC
        ) AS history_json
        FROM app_m01_osobni_lodicka_event e
        WHERE e.osobni_lodicka_id = ol.id
          AND COALESCE(e.is_invalidated, false) = false
      ) ev ON true
    `
    : Prisma.empty;
  const garantJoin = garantPersonId
    ? Prisma.sql`
      JOIN app_m01_lodicka lf
        ON lf.id = ol.lodicka_id
        AND lf.is_deleted = false
    `
    : Prisma.empty;
  const garantFilter = garantPersonId
    ? Prisma.sql`AND lf.garant_person_id = ${garantPersonId}`
    : Prisma.empty;
  const personalTuple = includeHistory
    ? Prisma.sql`
      json_build_array(
        pb.child_idx,
        pb.id,
        cb.catalog_idx,
        pb.kod_osobni_lodicky,
        pb.stav,
        pb.hodnota,
        pb.uspech,
        pb.poznamka,
        pb.datum_stavu,
        pb.history_json
      )
    `
    : Prisma.sql`
      json_build_array(
        pb.child_idx,
        pb.id,
        cb.catalog_idx,
        pb.kod_osobni_lodicky,
        pb.stav,
        pb.hodnota,
        pb.uspech,
        pb.poznamka,
        pb.datum_stavu
      )
    `;

  const payloadRows = await prisma.$queryRaw<CompactPayloadQueryRow[]>(Prisma.sql`
    WITH child_input AS (
      SELECT id::text AS child_id, ord::int - 1 AS child_idx
      FROM unnest(ARRAY[${Prisma.join(childIds)}]::text[]) WITH ORDINALITY AS input(id, ord)
    ),
    personal_base AS (
      SELECT
        ci.child_idx,
        os.person_id AS child_id,
        ol.id AS id,
        ol.lodicka_id AS lodicka_id,
        ol.kod_osobni_lodicky AS kod_osobni_lodicky,
        COALESCE(NULLIF(BTRIM(ol.current_stav_label), ''), 'Nezahájeno') AS stav,
        ol.current_hodnota AS hodnota,
        COALESCE(NULLIF(BTRIM(ol.uspech), ''), '—') AS uspech,
        COALESCE(NULLIF(BTRIM(ol.poznamka), ''), '—') AS poznamka,
        ol.datum_stavu AS datum_stavu,
        ${includeHistory ? Prisma.sql`COALESCE(ev.history_json, '[]'::json)` : Prisma.sql`'[]'::json`} AS history_json
      FROM child_input ci
      JOIN app_m01_osobni_sada_lodicek os
        ON os.person_id = ci.child_id
        AND os.status = 'ACTIVE'
      JOIN app_m01_osobni_lodicka ol
        ON ol.osobni_sada_id = os.id
        AND ol.is_deleted = false
      ${garantJoin}
      ${historyJoin}
      WHERE true
        ${garantFilter}
    ),
    catalog_base AS (
      SELECT
        row_number() OVER (ORDER BY pr.nazev ASC, pp.nazev ASC NULLS FIRST, ob.nazev ASC, l.nazev ASC)::int - 1 AS catalog_idx,
        l.id AS lodicka_id,
        l.kod AS kod_lodicky,
        pr.nazev AS predmet,
        pp.nazev AS podpredmet,
        ob.nazev AS oblast,
        l.nazev AS nazev_lodicky,
        l.typ::text AS typ,
        l.stupen::text AS stupen,
        l.rocnik_od AS rocnik_od,
        l.rocnik_do AS rocnik_do,
        l.garant_person_id AS garant_person_id,
        gp.display_name AS garant_name
      FROM (SELECT DISTINCT lodicka_id FROM personal_base) ids
      JOIN app_m01_lodicka l
        ON l.id = ids.lodicka_id
        AND l.is_deleted = false
      JOIN app_m01_predmet pr
        ON pr.id = l.predmet_id
      LEFT JOIN app_m01_podpredmet pp
        ON pp.id = l.podpredmet_id
      JOIN app_m01_oblast ob
        ON ob.id = l.oblast_id
      LEFT JOIN app_person gp
        ON gp.id = l.garant_person_id
    )
    SELECT
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'lodickaId', cb.lodicka_id,
              'kodLodicky', cb.kod_lodicky,
              'predmet', COALESCE(NULLIF(BTRIM(cb.predmet), ''), '—'),
              'podpredmet', COALESCE(NULLIF(BTRIM(cb.podpredmet), ''), '—'),
              'oblast', COALESCE(NULLIF(BTRIM(cb.oblast), ''), '—'),
              'nazevLodicky', COALESCE(NULLIF(BTRIM(cb.nazev_lodicky), ''), '—'),
              'typ', NULLIF(BTRIM(cb.typ), ''),
              'stupen', NULLIF(BTRIM(cb.stupen), ''),
              'rocnikOd', cb.rocnik_od,
              'rocnikDo', cb.rocnik_do,
              'garantPersonId', NULLIF(BTRIM(cb.garant_person_id), ''),
              'garantName', NULLIF(BTRIM(cb.garant_name), '')
            )
            ORDER BY cb.catalog_idx
          )
          FROM catalog_base cb
        ),
        '[]'::json
      ) AS catalog_items,
      COALESCE(
        (
          SELECT json_agg(${personalTuple} ORDER BY pb.child_idx ASC, cb.catalog_idx ASC)
          FROM personal_base pb
          JOIN catalog_base cb
            ON cb.lodicka_id = pb.lodicka_id
        ),
        '[]'::json
      ) AS personal_items,
      COALESCE(
        (
          SELECT array_agg(DISTINCT pb.child_id)
          FROM personal_base pb
          JOIN catalog_base cb
            ON cb.lodicka_id = pb.lodicka_id
        ),
        ARRAY[]::text[]
      ) AS child_ids_with_rows
  `);

  const payload = payloadRows[0];
  const catalogItems = Array.isArray(payload?.catalog_items) ? payload.catalog_items : [];
  const personalItems = Array.isArray(payload?.personal_items) ? payload.personal_items : [];
  const childIdsWithRows = new Set(payload?.child_ids_with_rows ?? []);
  const children = garantPersonId
    ? accessibleChildren.filter((child) => childIdsWithRows.has(child.id))
    : accessibleChildren;
  const childIndexOffset =
    garantPersonId && children.length !== accessibleChildren.length
      ? new Map(children.map((child, index) => [accessibleChildren.findIndex((item) => item.id === child.id), index]))
      : null;

  const lodickyCatalog: PortalLodickaCatalogRow[] = catalogItems.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const lodickaId = typeof row.lodickaId === "string" ? row.lodickaId : "";
    if (!lodickaId) return [];
    return [{
      lodickaId,
      kodLodicky: typeof row.kodLodicky === "string" ? normalizeOptionalText(row.kodLodicky) : null,
      predmet: typeof row.predmet === "string" ? normalizeText(row.predmet, "—") : "—",
      podpredmet: typeof row.podpredmet === "string" ? normalizeText(row.podpredmet, "—") : "—",
      oblast: typeof row.oblast === "string" ? normalizeText(row.oblast, "—") : "—",
      nazevLodicky: typeof row.nazevLodicky === "string" ? normalizeText(row.nazevLodicky, "—") : "—",
      typ: typeof row.typ === "string" ? normalizeOptionalText(row.typ) : null,
      stupen: typeof row.stupen === "string" ? normalizeOptionalText(row.stupen) : null,
      rocnikOd: typeof row.rocnikOd === "number" ? row.rocnikOd : null,
      rocnikDo: typeof row.rocnikDo === "number" ? row.rocnikDo : null,
      garantPersonId: typeof row.garantPersonId === "string" ? normalizeOptionalText(row.garantPersonId) : null,
      garantName: typeof row.garantName === "string" ? normalizeOptionalText(row.garantName) : null,
    }];
  });

  const osobniLodicky: PortalOsobniLodickaCurrentRow[] = personalItems.flatMap((item) => {
    if (!Array.isArray(item)) return [];
    const childIndex = typeof item[0] === "number" ? item[0] : null;
    const id = typeof item[1] === "string" ? item[1] : "";
    const lodickaIndex = typeof item[2] === "number" ? item[2] : null;
    if (childIndex === null || !id || lodickaIndex === null) return [];
    const adjustedChildIndex = childIndexOffset?.get(childIndex) ?? childIndex;
    if (!children[adjustedChildIndex] || !lodickyCatalog[lodickaIndex]) return [];
    const base: PortalOsobniLodickaCurrentRow = [
      adjustedChildIndex,
      id,
      lodickaIndex,
      typeof item[3] === "string" ? normalizeOptionalText(item[3]) : null,
      typeof item[4] === "string" ? normalizeText(item[4], "Nezahájeno") : "Nezahájeno",
      typeof item[5] === "number" && Number.isFinite(item[5]) ? item[5] : null,
      typeof item[6] === "string" ? normalizeText(item[6], "—") : "—",
      typeof item[7] === "string" ? normalizeText(item[7], "—") : "—",
      toIso(item[8] instanceof Date || typeof item[8] === "string" ? item[8] : null),
    ];
    const history = includeHistory ? toHistoryRows(item[9]) : [];
    if (history.length > 0) base.push(history);
    return [base];
  });

  return {
    parent: context.parent,
    children,
    lodickyCatalog,
    osobniLodicky,
  };
}

function formatProtoDateTime(value: Date): string {
  const iso = value.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function statusToLabel(status: PortalLodickaStav): string {
  if (status === 4) return "Samostatně";
  if (status === 3) return "Částečně";
  if (status === 2) return "S dopomocí";
  if (status === 1) return "Zahájeno";
  return "Nezahájeno";
}

function toActorFallbackId(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `db-label-${slug}` : "db-unknown-actor";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getTodayIsoForPrague(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  return `${valueByType.get("year")}-${valueByType.get("month")}-${valueByType.get("day")}`;
}

function parseIsoYearMonth(value: string): [number, number] {
  const [yearRaw, monthRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month) {
    const now = new Date();
    return [now.getFullYear(), now.getMonth() + 1];
  }
  return [year, month];
}

function getSemesterBoundsForDate(value: string): { minDate: string; maxDate: string } {
  const [year, month] = parseIsoYearMonth(value);
  if (month >= 9) {
    return {
      minDate: `${year}-09-01`,
      maxDate: `${year + 1}-01-31`,
    };
  }
  if (month === 1) {
    return {
      minDate: `${year - 1}-09-01`,
      maxDate: `${year}-01-31`,
    };
  }
  return {
    minDate: `${year}-02-01`,
    maxDate: `${year}-08-31`,
  };
}

function isDateInRange(value: string, min: string, max: string): boolean {
  return value >= min && value <= max;
}

export async function savePortalLodickaStatusForActor(
  actor: PortalActorAccessInput,
  input: PortalSaveLodickaStatusInput,
): Promise<PortalSaveLodickaStatusResult> {
  if (!isIsoDate(input.effectiveDate)) {
    return { ok: false, code: "INVALID_INPUT", message: "Neplatné datum stavu." };
  }
  if (![0, 1, 2, 3, 4].includes(input.status)) {
    return { ok: false, code: "INVALID_INPUT", message: "Neplatná hodnota stavu lodičky." };
  }

  const actorRoles = normalizeRoles(actor.roles);
  if (!actorRoles.some((role) => role === "garant" || role === "pruvodce")) {
    return { ok: false, code: "FORBIDDEN", message: "Stav lodičky smí měnit pouze garant." };
  }

  const writableSemester = getSemesterBoundsForDate(getTodayIsoForPrague());
  if (!isDateInRange(input.effectiveDate, writableSemester.minDate, writableSemester.maxDate)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Stav lodičky lze měnit pouze v aktuálním pololetí.",
    };
  }

  const context = await getPortalParentAndChildrenForActor(actor);
  if (!context) {
    return { ok: false, code: "FORBIDDEN", message: "Přístup zamítnut." };
  }

  const targetRows = await prisma.$queryRaw<Array<{
    personal_id: string;
    child_id: string;
    garant_person_id: string | null;
  }>>(Prisma.sql`
    SELECT
      ol.id AS personal_id,
      os.person_id AS child_id,
      l.garant_person_id AS garant_person_id
    FROM app_m01_osobni_lodicka ol
    JOIN app_m01_osobni_sada_lodicek os
      ON os.id = ol.osobni_sada_id
    JOIN app_m01_lodicka l
      ON l.id = ol.lodicka_id
      AND l.is_deleted = false
    WHERE ol.id = ${input.personalLodickaId}
      AND ol.is_deleted = false
      AND os.status = 'ACTIVE'
    LIMIT 1
  `);

  const target = targetRows[0];
  if (!target) {
    return { ok: false, code: "NOT_FOUND", message: "Osobní lodička nebyla nalezena." };
  }

  const accessibleChildIds = new Set(context.children.map((child) => child.id));
  if (!accessibleChildIds.has(target.child_id)) {
    return { ok: false, code: "FORBIDDEN", message: "Tato osobní lodička vám není přiřazena." };
  }

  const actorPersonIds = new Set(
    [...actor.personIds, input.actorPersonId ?? ""].map((id) => id.trim()).filter(Boolean),
  );
  const targetGarantId = target.garant_person_id?.trim() ?? "";
  if (!targetGarantId || !actorPersonIds.has(targetGarantId)) {
    return { ok: false, code: "FORBIDDEN", message: "Stav této lodičky smí měnit pouze její garant." };
  }

  const sameDayRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM app_m01_osobni_lodicka_event
    WHERE osobni_lodicka_id = ${input.personalLodickaId}
      AND COALESCE(is_invalidated, false) = false
      AND DATE(datum_stavu AT TIME ZONE 'UTC') = ${input.effectiveDate}::date
  `);

  const newerRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM app_m01_osobni_lodicka_event
    WHERE osobni_lodicka_id = ${input.personalLodickaId}
      AND COALESCE(is_invalidated, false) = false
      AND DATE(datum_stavu AT TIME ZONE 'UTC') > ${input.effectiveDate}::date
  `);

  if (sameDayRows.length > 0 && !input.overwriteSameDate) {
    return {
      ok: false,
      code: "SAME_DATE_EXISTS",
      message: "Pro dané datum už existuje stav lodičky.",
      sameDateCount: sameDayRows.length,
    };
  }

  if (newerRows.length > 0 && !input.allowHistorical) {
    return {
      ok: false,
      code: "HISTORICAL_CONFLICT",
      message: "Existují novější záznamy. Potvrďte historický zápis.",
      newerCount: newerRows.length,
    };
  }

  const toInvalidate = [
    ...sameDayRows.map((row) => row.id),
    ...(input.invalidateNewer ? newerRows.map((row) => row.id) : []),
  ];
  const note = input.note?.trim() || null;
  const now = new Date();
  const eventId = `evt-manual-${randomUUID()}`;
  const eventDate = new Date(`${input.effectiveDate}T12:00:00.000Z`);
  const statusLabel = statusToLabel(input.status);
  const actorLabel = input.actorLabel.trim() || "Neznámý uživatel";
  const source = "portal_osobni_lodicky_manual_v1";

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO app_m01_osobni_lodicka_event (
        id,
        osobni_lodicka_id,
        stupen,
        stav_label,
        hodnota,
        datum_stavu,
        poznamka,
        uspech,
        changed_by_person_id,
        source,
        source_row_id,
        changed_by_label,
        source_created_by_person_id,
        source_created_by_label,
        source_created_at,
        source_modified_by_person_id,
        source_modified_by_label,
        source_modified_at
      ) VALUES (
        ${eventId},
        ${input.personalLodickaId},
        ${input.status},
        ${statusLabel},
        ${input.status},
        ${eventDate},
        ${note},
        NULL,
        ${input.actorPersonId},
        ${source},
        NULL,
        ${actorLabel},
        ${input.actorPersonId},
        ${actorLabel},
        ${now},
        ${input.actorPersonId},
        ${actorLabel},
        ${now}
      )
    `);

    if (toInvalidate.length > 0) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE app_m01_osobni_lodicka_event
        SET
          is_invalidated = true,
          invalidated_at = ${now},
          invalidated_reason = ${input.invalidateNewer ? "manual_overwrite_same_or_newer" : "manual_overwrite_same_day"},
          invalidated_by_event_id = ${eventId}
        WHERE osobni_lodicka_id = ${input.personalLodickaId}
          AND id IN (${Prisma.join(toInvalidate)})
          AND COALESCE(is_invalidated, false) = false
      `);
    }

    const latestRows = await tx.$queryRaw<Array<{
      id: string;
      stupen: number;
      stav_label: string | null;
      hodnota: number | null;
      datum_stavu: Date | string | null;
      poznamka: string | null;
      uspech: string | null;
    }>>(Prisma.sql`
      SELECT
        id,
        stupen,
        stav_label,
        hodnota,
        datum_stavu,
        poznamka,
        uspech
      FROM app_m01_osobni_lodicka_event
      WHERE osobni_lodicka_id = ${input.personalLodickaId}
        AND COALESCE(is_invalidated, false) = false
      ORDER BY datum_stavu DESC, source_modified_at DESC NULLS LAST, created_at DESC, id DESC
      LIMIT 1
    `);

    const latest = latestRows[0];
    if (!latest) {
      throw new Error("Nepodařilo se určit aktuální stav osobní lodičky po zápisu.");
    }

    await tx.$executeRaw(Prisma.sql`
      UPDATE app_m01_osobni_lodicka
      SET
        current_stupen = ${latest.stupen},
        current_stav_label = ${latest.stav_label},
        current_hodnota = ${latest.hodnota},
        datum_stavu = ${latest.datum_stavu as Date | string | null},
        poznamka = ${latest.poznamka},
        uspech = ${latest.uspech},
        last_event_id = ${latest.id},
        updated_at = ${now}
      WHERE id = ${input.personalLodickaId}
    `);
  });

  const eventWriterId = input.actorPersonId?.trim() || toActorFallbackId(actorLabel);
  const writtenAt = now;

  return {
    ok: true,
    event: {
      id: eventId,
      osobniLodickaId: input.personalLodickaId,
      datumStavu: input.effectiveDate,
      zapsanoAt: formatProtoDateTime(writtenAt),
      stav: input.status,
      zapsalId: eventWriterId,
      poznamka: note ?? undefined,
    },
    invalidatedEventIds: toInvalidate,
  };
}
