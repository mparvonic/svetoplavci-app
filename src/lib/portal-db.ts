import { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import { resolvePersonName } from "@/src/lib/person-name";

export interface PortalParent {
  id: string;
  name: string;
}

export interface PortalChild {
  id: string;
  name: string;
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

const GLOBAL_CHILD_ACCESS_ROLES = new Set(["admin", "tester", "garant", "pruvodce", "ucitel", "zamestnanec"]);

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
      SELECT s.current_grade_num
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
      SELECT s.current_grade_num
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
): Promise<{
  parent: PortalParent;
  child: PortalChild;
  lodicky: PortalLodickaRow[];
} | null> {
  const child = context.children.find((item) => item.id === childId);
  if (!child) return null;

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
      ev.history_json AS history_json
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
    WHERE os.person_id = ${child.id}
      AND os.status = 'ACTIVE'
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
  return getPortalChildLodickyFromContext(context, childId);
}

export async function getPortalChildLodickyForActor(
  input: PortalActorAccessInput,
  childId: string,
): Promise<{
  parent: PortalParent;
  child: PortalChild;
  lodicky: PortalLodickaRow[];
} | null> {
  const context = await getPortalParentAndChildrenForActor(input);
  if (!context) return null;
  return getPortalChildLodickyFromContext(context, childId);
}
