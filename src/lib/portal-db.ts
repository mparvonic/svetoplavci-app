import { prisma } from "@/src/lib/prisma";

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
  predmet: string;
  podpredmet: string;
  oblast: string;
  nazevLodicky: string;
  stav: string;
  uspech: string;
  poznamka: string;
  datumStavu: string | null;
}

type ParentChildRow = {
  parent_id: string;
  parent_name: string;
  has_rodic_role: boolean;
  child_id: string | null;
  child_name: string | null;
  child_grade_num: number | null;
  child_rocnik_code: string | null;
  child_stupen_code: string | null;
  child_smecka_name: string | null;
};

type LodickaQueryRow = {
  id: string;
  predmet: string;
  podpredmet: string | null;
  oblast: string;
  nazev_lodicky: string;
  stav: string | null;
  uspech: string | null;
  poznamka: string | null;
  datum_stavu: Date | string | null;
};

type ParentCandidate = {
  id: string;
  displayName: string;
  hasRodicRole: boolean;
  children: PortalChild[];
};

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

export async function getPortalParentAndChildrenByEmail(email: string): Promise<{
  parent: PortalParent;
  children: PortalChild[];
} | null> {
  const normalizedEmail = normalizeEmail(email);

  const rows = await prisma.$queryRaw<ParentChildRow[]>`
    SELECT
      p.id AS parent_id,
      p.display_name AS parent_name,
      EXISTS (
        SELECT 1
        FROM app_role_assignment ra
        WHERE ra.person_id = p.id
          AND ra.role = 'rodic'
          AND ra.is_active = true
      ) AS has_rodic_role,
      c.id AS child_id,
      c.display_name AS child_name,
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
        displayName: row.parent_name,
        hasRodicRole: row.has_rodic_role,
        children: [],
      };

    if (row.child_id && row.child_name) {
      const rocnik = parseRocnik(row.child_grade_num ?? row.child_rocnik_code);
      candidate.children.push({
        id: row.child_id,
        name: row.child_name,
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

  return {
    parent: {
      id: parentCandidate.id,
      name: parentCandidate.displayName,
    },
    children: parentCandidate.children,
  };
}

export async function getPortalChildLodickyByEmail(email: string, childId: string): Promise<{
  parent: PortalParent;
  child: PortalChild;
  lodicky: PortalLodickaRow[];
} | null> {
  const context = await getPortalParentAndChildrenByEmail(email);
  if (!context) return null;

  const child = context.children.find((item) => item.id === childId);
  if (!child) return null;

  const rows = await prisma.$queryRaw<LodickaQueryRow[]>`
    SELECT
      ol.id AS id,
      pr.nazev AS predmet,
      pp.nazev AS podpredmet,
      ob.nazev AS oblast,
      l.nazev AS nazev_lodicky,
      ol.current_stav_label AS stav,
      ol.uspech AS uspech,
      ol.poznamka AS poznamka,
      ol.datum_stavu AS datum_stavu
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
    WHERE os.person_id = ${child.id}
      AND os.status = 'ACTIVE'
    ORDER BY pr.nazev ASC, pp.nazev ASC NULLS FIRST, ob.nazev ASC, l.nazev ASC
  `;

  const lodicky: PortalLodickaRow[] = rows.map((row) => ({
    id: row.id,
    predmet: normalizeText(row.predmet, "—"),
    podpredmet: normalizeText(row.podpredmet, "—"),
    oblast: normalizeText(row.oblast, "—"),
    nazevLodicky: normalizeText(row.nazev_lodicky, "—"),
    stav: normalizeText(row.stav, "Nezahájeno"),
    uspech: normalizeText(row.uspech, "—"),
    poznamka: normalizeText(row.poznamka, "—"),
    datumStavu: toIso(row.datum_stavu),
  }));

  return {
    parent: context.parent,
    child,
    lodicky,
  };
}
