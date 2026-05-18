import { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";

export const LODICKY_MANAGEMENT_ROLES = new Set(["admin", "spravce_flotily", "spravce_lodicek"]);
export const LODICKY_VIEW_ROLES = new Set(["admin", "spravce_flotily", "spravce_lodicek", "pruvodce"]);

export type LodickyManagementFilters = {
  q: string;
  svpVersionId: string;
  scope: "" | "moje" | "vse";
  predmetId: string;
  podpredmetId: string;
  oblastId: string;
  stupen: "" | "I_STUPEN" | "II_STUPEN";
  rocnik: number | null;
  coverage: "" | "bez-ovu" | "ovu-nerelevantni" | "bez-spravce" | "bez-garanta";
  page: number;
};

export type LodickyManagementView = "struktura" | "seznam" | "pristup" | "rvp";

export type RvpManagementFilters = {
  q: string;
  rvpVersionId: string;
};

export type LodickyManagementAccess = {
  roles: string[];
  personIds: string[];
};

export type SvpVersionSummary = {
  id: string;
  label: string;
  versionLabel: string;
  major: number;
  minor: number;
  patch: number;
  zmenaType: string;
  status: string;
  isCurrent: boolean;
  basedOnRvpVersionId: string;
  parentSvpVersionId: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  notes: string | null;
  rvpDatasetVersion: string;
  rvpSourceFormat: string;
  rvpIsActive: boolean;
  lodickyCount: number;
  withoutOvu: number;
  ovuNotApplicable: number;
  withoutSpravce: number;
  withoutGarant: number;
  predmetCount: number;
  oblastCount: number;
};

export type SvpVersionChangeHistoryItem = {
  id: string;
  svpVersionId: string;
  parentSvpVersionId: string | null;
  changeType: string;
  versionLabel: string;
  effectiveFrom: Date;
  changedByName: string | null;
  summary: Prisma.JsonValue | null;
  createdAt: Date;
};

export type SvpDraftSubjectCountChange = {
  subjectKey: string;
  subjectName: string;
  beforeCount: number;
  afterCount: number;
};

export type SvpDraftChangeSummary = {
  type: "minor" | "patch";
  label: string;
  effectiveFrom: Date;
  hasSubjectCountChanges: boolean;
  subjectChanges: SvpDraftSubjectCountChange[];
};

export type RvpVersionSummary = {
  id: string;
  datasetVersion: string;
  sourceFormat: string;
  sourceUrl: string;
  sourceHash: string | null;
  importedAt: Date;
  importedBy: string | null;
  isActive: boolean;
  notes: string | null;
  ovuCount: number;
  uzlovyBodCount: number;
  svpVersionCount: number;
};

export type TaxonomyOption = {
  id: string;
  kod: string | null;
  nazev: string;
  stupen: string;
  poradi?: number | null;
  predmetId?: string | null;
  podpredmetId?: string | null;
  spravcePersonIds?: string[];
  spravciNames?: string | null;
  garantPersonIds?: string[];
  garantiNames?: string | null;
  lodickyCount?: number;
  lodickyPreview?: Array<{
    id: string;
    kod: string;
    nazev: string;
    rocnikOd: number;
    rocnikDo: number;
  }>;
};

export type TaxonomyLodickaOption = {
  id: string;
  kod: string;
  nazev: string;
  popis: string | null;
  stupen: string;
  rocnikOd: number;
  rocnikDo: number;
  predmetId: string;
  podpredmetId: string | null;
  oblastId: string;
  ovuNotApplicable: boolean;
  ovuIds: string[];
};

export type LodickyManagementRow = {
  id: string;
  kod: string;
  nazev: string;
  typ: string;
  stupen: string;
  rocnikOd: number;
  rocnikDo: number;
  predmet: string;
  podpredmet: string | null;
  oblast: string;
  garantName: string | null;
  spravciNames: string | null;
  spravcePersonIds: string[];
  canEditBasic: boolean;
  spravciCount: number;
  ovuCount: number;
  ovuNotApplicable: boolean;
};

export type LodickyManagementRowsResult = {
  rows: LodickyManagementRow[];
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
  };
  counts: {
    total: number;
    withoutOvu: number;
    ovuNotApplicable: number;
    withoutSpravce: number;
    withoutGarant: number;
  };
};

export type LodickyManagementPersonOption = {
  id: string;
  displayName: string;
  legalName: string;
  identifier: string | null;
  email: string | null;
};

export type LodickyManagementOvuOption = {
  id: string;
  kod: string;
  zneni: string;
  uzlovyBod: string | null;
  uzlovyBodKod: string | null;
  uzlovyBodNazev: string | null;
  uzlovyBodRocnik: number | null;
  uzlovyBodStupen: string | null;
  isSelected: boolean;
};

export type LodickyManagementDetail = {
  id: string;
  svpVersionId: string;
  svpStatus: string;
  parentSvpVersionId: string | null;
  svpLabel: string;
  svpBasedOnRvpVersionId: string;
  rvpDatasetVersion: string;
  kod: string;
  nazev: string;
  popis: string | null;
  typ: string;
  stupen: string;
  rocnikOd: number;
  rocnikDo: number;
  predmetId: string;
  podpredmetId: string | null;
  oblastId: string;
  predmet: string;
  podpredmet: string | null;
  oblast: string;
  garantPersonIds: string[];
  spravcePersonIds: string[];
  canEditBasic: boolean;
  ovuIds: string[];
  ovuNotApplicable: boolean;
};

export type LodickyManagementDetailPage = {
  lodicka: LodickyManagementDetail | null;
  canEditFleetFields: boolean;
  canEditBasicFields: boolean;
  spravceOptions: LodickyManagementPersonOption[];
  garantOptions: LodickyManagementPersonOption[];
  predmetOptions: TaxonomyOption[];
  podpredmetOptions: TaxonomyOption[];
  oblastOptions: TaxonomyOption[];
  ovuOptions: LodickyManagementOvuOption[];
};

export type LodickyCreateDefaults = {
  stupen: "I_STUPEN" | "II_STUPEN";
  rocnikOd: number;
  rocnikDo: number;
  predmetId: string;
  podpredmetId: string | null;
  oblastId: string;
};

export type LodickyCreatePage = {
  selectedSvp: SvpVersionSummary | null;
  defaults: LodickyCreateDefaults | null;
  spravceOptions: LodickyManagementPersonOption[];
  garantOptions: LodickyManagementPersonOption[];
  predmetOptions: TaxonomyOption[];
  podpredmetOptions: TaxonomyOption[];
  oblastOptions: TaxonomyOption[];
  ovuOptions: LodickyManagementOvuOption[];
};

export type RvpOvuRow = {
  id: string;
  kod: string;
  zneni: string;
  uzlovyBodKod: string | null;
  uzlovyBodNazev: string | null;
  linkedLodickyCount: number;
};

export type RvpSvpLink = {
  id: string;
  label: string;
  status: string;
  isCurrent: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  lodickyCount: number;
};

type CountRow = {
  total: number;
  without_ovu: number;
  ovu_not_applicable: number;
  without_spravce: number;
  without_garant: number;
};

const LODICKY_PAGE_SIZE = 30;

function normalizeRoles(roles: string[]): string[] {
  return [...new Set(roles.map((role) => role.trim().toLowerCase()).filter(Boolean))];
}

export function canManageLodicky(roles: string[]): boolean {
  return normalizeRoles(roles).some((role) => LODICKY_MANAGEMENT_ROLES.has(role));
}

export function canViewLodickyManagement(roles: string[]): boolean {
  return normalizeRoles(roles).some((role) => LODICKY_VIEW_ROLES.has(role));
}

export function canManageWholeFleet(roles: string[]): boolean {
  const normalized = normalizeRoles(roles);
  return normalized.includes("admin") || normalized.includes("spravce_flotily");
}

export function hasLodickyManagerRole(roles: string[]): boolean {
  return normalizeRoles(roles).includes("spravce_lodicek");
}

function parseOne(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function parseLodickyManagementFilters(
  searchParams: Record<string, string | string[] | undefined>,
): LodickyManagementFilters {
  const rawStupen = parseOne(searchParams.stupen).trim();
  const stupen = rawStupen === "I_STUPEN" || rawStupen === "II_STUPEN" ? rawStupen : "";
  const rawCoverage = parseOne(searchParams.coverage).trim();
  const rawScope = parseOne(searchParams.scope).trim();
  const rawRocnik = Number.parseInt(parseOne(searchParams.rocnik), 10);
  const rawPage = Number.parseInt(parseOne(searchParams.page), 10);

  return {
    q: parseOne(searchParams.q).trim(),
    svpVersionId: parseOne(searchParams.svp).trim(),
    scope: rawScope === "moje" || rawScope === "vse" ? rawScope : "",
    predmetId: stupen ? parseOne(searchParams.predmet).trim() : "",
    podpredmetId: stupen ? parseOne(searchParams.podpredmet).trim() : "",
    oblastId: stupen ? parseOne(searchParams.oblast).trim() : "",
    stupen,
    rocnik: stupen && Number.isInteger(rawRocnik) && rawRocnik >= 1 && rawRocnik <= 9 ? rawRocnik : null,
    coverage:
      rawCoverage === "bez-ovu" ||
      rawCoverage === "ovu-nerelevantni" ||
      rawCoverage === "bez-spravce" ||
      rawCoverage === "bez-garanta"
        ? rawCoverage
        : "",
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function parseRvpManagementFilters(
  searchParams: Record<string, string | string[] | undefined>,
): RvpManagementFilters {
  return {
    q: parseOne(searchParams.q).trim(),
    rvpVersionId: parseOne(searchParams.rvp).trim(),
  };
}

function buildWhere(input: {
  filters: LodickyManagementFilters;
  svpVersionId: string | null;
  access: LodickyManagementAccess;
  restrictToAssigned?: boolean;
}): Prisma.Sql {
  const clauses: Prisma.Sql[] = [Prisma.sql`l.is_deleted = false`];

  if (input.svpVersionId) {
    clauses.push(Prisma.sql`l.svp_version_id = ${input.svpVersionId}`);
  }

  if (input.restrictToAssigned) {
    const personIds = [...new Set(input.access.personIds.map((id) => id.trim()).filter(Boolean))];
    clauses.push(
      personIds.length > 0
        ? Prisma.sql`(
          EXISTS (
            SELECT 1
            FROM app_m01_oblast_spravce scope_os
            WHERE scope_os.oblast_id = l.oblast_id
              AND scope_os.person_id IN (${Prisma.join(personIds)})
          ) OR EXISTS (
            SELECT 1
            FROM app_m01_lodicka_garant legacy_scope_lg
            WHERE legacy_scope_lg.lodicka_id = l.id
              AND legacy_scope_lg.person_id IN (${Prisma.join(personIds)})
          )
        )`
        : Prisma.sql`false`,
    );
  }

  if (input.filters.q) {
    const like = `%${input.filters.q}%`;
    clauses.push(Prisma.sql`(
      l.kod ILIKE ${like}
      OR l.nazev ILIKE ${like}
      OR pr.nazev ILIKE ${like}
      OR COALESCE(pp.nazev, '') ILIKE ${like}
      OR ob.nazev ILIKE ${like}
    )`);
  }

  if (input.filters.predmetId) {
    clauses.push(Prisma.sql`l.predmet_id = ${input.filters.predmetId}`);
  }

  if (input.filters.podpredmetId) {
    clauses.push(Prisma.sql`l.podpredmet_id = ${input.filters.podpredmetId}`);
  }

  if (input.filters.oblastId) {
    clauses.push(Prisma.sql`l.oblast_id = ${input.filters.oblastId}`);
  }

  if (input.filters.stupen) {
    clauses.push(Prisma.sql`l.stupen::text = ${input.filters.stupen}`);
  }

  if (input.filters.rocnik !== null) {
    clauses.push(Prisma.sql`l.rocnik_od <= ${input.filters.rocnik} AND l.rocnik_do >= ${input.filters.rocnik}`);
  }

  if (input.filters.coverage === "bez-ovu") {
    clauses.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM app_m01_lodicka_ovu_link coverage_ovu WHERE coverage_ovu.lodicka_id = l.id
    ) AND l.ovu_not_applicable = false`);
  }

  if (input.filters.coverage === "ovu-nerelevantni") {
    clauses.push(Prisma.sql`l.ovu_not_applicable = true`);
  }

  if (input.filters.coverage === "bez-spravce") {
    clauses.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM app_m01_oblast_spravce coverage_os WHERE coverage_os.oblast_id = l.oblast_id
    )`);
  }

  if (input.filters.coverage === "bez-garanta") {
    clauses.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM app_m01_lodicka_stav_garant coverage_sg WHERE coverage_sg.lodicka_id = l.id
    ) AND l.garant_person_id IS NULL`);
  }

  return Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}`;
}

function shouldRestrictRowsToAssigned(input: {
  filters: LodickyManagementFilters;
  access: LodickyManagementAccess;
}): boolean {
  if (canManageWholeFleet(input.access.roles)) return false;
  if (hasLodickyManagerRole(input.access.roles)) return input.filters.scope !== "vse";
  return false;
}

function canEditBasicSql(access: LodickyManagementAccess): Prisma.Sql {
  if (canManageWholeFleet(access.roles)) return Prisma.sql`false`;
  if (!hasLodickyManagerRole(access.roles)) return Prisma.sql`false`;
  const personIds = [...new Set(access.personIds.map((id) => id.trim()).filter(Boolean))];
  if (personIds.length === 0) return Prisma.sql`false`;
  return Prisma.sql`(
    EXISTS (
      SELECT 1
      FROM app_m01_oblast_spravce edit_os
      WHERE edit_os.oblast_id = l.oblast_id
        AND edit_os.person_id IN (${Prisma.join(personIds)})
    )
    OR EXISTS (
      SELECT 1
      FROM app_m01_lodicka_garant legacy_edit_lg
      WHERE legacy_edit_lg.lodicka_id = l.id
        AND legacy_edit_lg.person_id IN (${Prisma.join(personIds)})
    )
  )`;
}

function buildLodickaAccessWhere(input: {
  lodickaId: string;
  access: LodickyManagementAccess;
}): Prisma.Sql {
  const clauses: Prisma.Sql[] = [Prisma.sql`l.id = ${input.lodickaId}`, Prisma.sql`l.is_deleted = false`];

  if (!canManageWholeFleet(input.access.roles)) {
    const personIds = [...new Set(input.access.personIds.map((id) => id.trim()).filter(Boolean))];
    clauses.push(
      personIds.length > 0
        ? Prisma.sql`(
          EXISTS (
            SELECT 1
            FROM app_m01_oblast_spravce scope_os
            WHERE scope_os.oblast_id = l.oblast_id
              AND scope_os.person_id IN (${Prisma.join(personIds)})
          ) OR EXISTS (
            SELECT 1
            FROM app_m01_lodicka_garant legacy_scope_lg
            WHERE legacy_scope_lg.lodicka_id = l.id
              AND legacy_scope_lg.person_id IN (${Prisma.join(personIds)})
          )
        )`
        : Prisma.sql`false`,
    );
  }

  return Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}`;
}

export async function getSvpVersions(): Promise<SvpVersionSummary[]> {
  return prisma.$queryRaw<SvpVersionSummary[]>(Prisma.sql`
    WITH lodicka_counts AS (
      SELECT
        l.svp_version_id,
        count(*)::int AS lodicky_count,
        count(*) FILTER (WHERE ov.lodicka_id IS NULL AND l.ovu_not_applicable = false)::int AS without_ovu,
        count(*) FILTER (WHERE l.ovu_not_applicable = true)::int AS ovu_not_applicable,
        count(*) FILTER (WHERE os.oblast_id IS NULL)::int AS without_spravce,
        count(*) FILTER (WHERE sg.lodicka_id IS NULL AND l.garant_person_id IS NULL)::int AS without_garant
      FROM app_m01_lodicka l
      LEFT JOIN (
        SELECT DISTINCT lodicka_id
        FROM app_m01_lodicka_ovu_link
      ) ov ON ov.lodicka_id = l.id
      LEFT JOIN (
        SELECT DISTINCT oblast_id
        FROM app_m01_oblast_spravce
      ) os ON os.oblast_id = l.oblast_id
      LEFT JOIN (
        SELECT DISTINCT lodicka_id
        FROM app_m01_lodicka_stav_garant
      ) sg ON sg.lodicka_id = l.id
      WHERE l.is_deleted = false
      GROUP BY l.svp_version_id
    ),
    predmet_counts AS (
      SELECT svp_version_id, count(*)::int AS predmet_count
      FROM app_m01_predmet
      WHERE is_active = true
      GROUP BY svp_version_id
    ),
    oblast_counts AS (
      SELECT svp_version_id, count(*)::int AS oblast_count
      FROM app_m01_oblast
      WHERE is_active = true
      GROUP BY svp_version_id
    )
    SELECT
      svp.id,
      svp.label,
      svp.version_label AS "versionLabel",
      svp.major,
      svp.minor,
      svp.patch,
      svp.zmena_type::text AS "zmenaType",
      svp.status::text AS status,
      svp.is_current AS "isCurrent",
      svp.based_on_rvp_version_id AS "basedOnRvpVersionId",
      svp.parent_svp_version_id AS "parentSvpVersionId",
      svp.effective_from AS "effectiveFrom",
      svp.effective_to AS "effectiveTo",
      svp.notes,
      rvp.dataset_version AS "rvpDatasetVersion",
      rvp.source_format AS "rvpSourceFormat",
      rvp.is_active AS "rvpIsActive",
      COALESCE(lc.lodicky_count, 0)::int AS "lodickyCount",
      COALESCE(lc.without_ovu, 0)::int AS "withoutOvu",
      COALESCE(lc.ovu_not_applicable, 0)::int AS "ovuNotApplicable",
      COALESCE(lc.without_spravce, 0)::int AS "withoutSpravce",
      COALESCE(lc.without_garant, 0)::int AS "withoutGarant",
      COALESCE(pc.predmet_count, 0)::int AS "predmetCount",
      COALESCE(oc.oblast_count, 0)::int AS "oblastCount"
    FROM app_m01_svp_version svp
    JOIN app_m01_rvp_version rvp ON rvp.id = svp.based_on_rvp_version_id
    LEFT JOIN lodicka_counts lc ON lc.svp_version_id = svp.id
    LEFT JOIN predmet_counts pc ON pc.svp_version_id = svp.id
    LEFT JOIN oblast_counts oc ON oc.svp_version_id = svp.id
    ORDER BY svp.is_current DESC, svp.effective_from DESC, svp.major DESC, svp.minor DESC, svp.patch DESC
  `);
}

export function formatSvpVersionLabel(version: Pick<SvpVersionSummary, "major" | "minor" | "patch" | "versionLabel">): string {
  if (version.versionLabel) return version.versionLabel;
  if (version.minor === 0 && version.patch === 0) return String(version.major);
  if (version.patch === 0) return `${version.major}.${String(version.minor).padStart(2, "0")}`;
  return `${version.major}.${String(version.minor).padStart(2, "0")}.${String(version.patch).padStart(2, "0")}`;
}

function currentSemesterStart(now = new Date()): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (month >= 2 && month <= 8) {
    return new Date(Date.UTC(year, 1, 1, 0, 0, 0, 0));
  }
  const schoolYearStart = month >= 9 ? year : year - 1;
  return new Date(Date.UTC(schoolYearStart, 8, 1, 0, 0, 0, 0));
}

function formatNextVersionLabel(major: number, minor: number, patch: number): string {
  if (minor === 0 && patch === 0) return String(major);
  if (patch === 0) return `${major}.${String(minor).padStart(2, "0")}`;
  return `${major}.${String(minor).padStart(2, "0")}.${String(patch).padStart(2, "0")}`;
}

export async function getSvpDraftChangeSummary(selectedSvp: SvpVersionSummary | null): Promise<SvpDraftChangeSummary | null> {
  if (!selectedSvp || selectedSvp.status !== "DRAFT" || !selectedSvp.parentSvpVersionId) return null;

  const rows = await prisma.$queryRaw<Array<{
    subjectKey: string;
    subjectName: string;
    beforeCount: number;
    afterCount: number;
  }>>(Prisma.sql`
    WITH parent_counts AS (
      SELECT
        COALESCE(p.kod, p.nazev) AS subject_key,
        p.nazev AS subject_name,
        count(l.id)::int AS before_count
      FROM app_m01_predmet p
      LEFT JOIN app_m01_lodicka l
        ON l.predmet_id = p.id
        AND l.is_deleted = false
      WHERE p.svp_version_id = ${selectedSvp.parentSvpVersionId}
        AND p.is_active = true
      GROUP BY COALESCE(p.kod, p.nazev), p.nazev
    ),
    draft_counts AS (
      SELECT
        COALESCE(p.kod, p.nazev) AS subject_key,
        p.nazev AS subject_name,
        count(l.id)::int AS after_count
      FROM app_m01_predmet p
      LEFT JOIN app_m01_lodicka l
        ON l.predmet_id = p.id
        AND l.is_deleted = false
      WHERE p.svp_version_id = ${selectedSvp.id}
        AND p.is_active = true
      GROUP BY COALESCE(p.kod, p.nazev), p.nazev
    )
    SELECT
      COALESCE(d.subject_key, p.subject_key) AS "subjectKey",
      COALESCE(d.subject_name, p.subject_name) AS "subjectName",
      COALESCE(p.before_count, 0)::int AS "beforeCount",
      COALESCE(d.after_count, 0)::int AS "afterCount"
    FROM parent_counts p
    FULL JOIN draft_counts d ON d.subject_key = p.subject_key
    WHERE COALESCE(p.before_count, 0) <> COALESCE(d.after_count, 0)
    ORDER BY COALESCE(d.subject_name, p.subject_name) ASC
  `);

  const hasSubjectCountChanges = rows.length > 0;
  const existingRows = await prisma.$queryRaw<Array<{ minor: number; patch: number }>>(Prisma.sql`
    SELECT minor, patch
    FROM app_m01_svp_version
    WHERE major = ${selectedSvp.major}
      AND id <> ${selectedSvp.id}
    ORDER BY minor DESC, patch DESC
  `);
  const nextMinor = hasSubjectCountChanges
    ? Math.max(0, ...existingRows.map((row) => row.minor)) + 1
    : selectedSvp.minor;
  const nextPatch = hasSubjectCountChanges
    ? 0
    : Math.max(0, ...existingRows.filter((row) => row.minor === selectedSvp.minor).map((row) => row.patch)) + 1;

  return {
    type: hasSubjectCountChanges ? "minor" : "patch",
    label: formatNextVersionLabel(selectedSvp.major, nextMinor, nextPatch),
    effectiveFrom: currentSemesterStart(),
    hasSubjectCountChanges,
    subjectChanges: rows,
  };
}

export async function getSvpVersionChangeHistory(svpVersionId: string | null): Promise<SvpVersionChangeHistoryItem[]> {
  if (!svpVersionId) return [];
  return prisma.$queryRaw<SvpVersionChangeHistoryItem[]>(Prisma.sql`
    SELECT
      ch.id,
      ch.svp_version_id AS "svpVersionId",
      ch.parent_svp_version_id AS "parentSvpVersionId",
      ch.change_type::text AS "changeType",
      ch.version_label AS "versionLabel",
      ch.effective_from AS "effectiveFrom",
      person.display_name AS "changedByName",
      ch.summary,
      ch.created_at AS "createdAt"
    FROM app_m01_svp_version_change ch
    LEFT JOIN app_person person ON person.id = ch.changed_by_person_id
    WHERE ch.svp_version_id = ${svpVersionId}
       OR ch.parent_svp_version_id = ${svpVersionId}
    ORDER BY ch.created_at DESC
    LIMIT 20
  `);
}

export async function getRvpVersions(): Promise<RvpVersionSummary[]> {
  return prisma.$queryRaw<RvpVersionSummary[]>(Prisma.sql`
    SELECT
      rvp.id,
      rvp.dataset_version AS "datasetVersion",
      rvp.source_format AS "sourceFormat",
      rvp.source_url AS "sourceUrl",
      rvp.source_hash AS "sourceHash",
      rvp.imported_at AS "importedAt",
      rvp.imported_by AS "importedBy",
      rvp.is_active AS "isActive",
      rvp.notes,
      count(DISTINCT o.id)::int AS "ovuCount",
      count(DISTINCT ub.id)::int AS "uzlovyBodCount",
      count(DISTINCT svp.id)::int AS "svpVersionCount"
    FROM app_m01_rvp_version rvp
    LEFT JOIN app_m01_rvp_ovu o ON o.rvp_version_id = rvp.id
    LEFT JOIN app_m01_rvp_uzlovy_bod ub ON ub.rvp_version_id = rvp.id
    LEFT JOIN app_m01_svp_version svp ON svp.based_on_rvp_version_id = rvp.id
    GROUP BY rvp.id
    ORDER BY rvp.is_active DESC, rvp.imported_at DESC
  `);
}

function pickSvpVersion(versions: SvpVersionSummary[], requestedId: string): SvpVersionSummary | null {
  return versions.find((version) => version.id === requestedId)
    ?? versions.find((version) => version.isCurrent)
    ?? versions[0]
    ?? null;
}

function pickRvpVersion(versions: RvpVersionSummary[], requestedId: string): RvpVersionSummary | null {
  return versions.find((version) => version.id === requestedId)
    ?? versions.find((version) => version.isActive)
    ?? versions[0]
    ?? null;
}

async function getTaxonomyOptions(
  svpVersionId: string | null,
  options: {
    includeLodicky?: boolean;
    includeAreaPeople?: boolean;
    includeAreaCounts?: boolean;
    includeAreaPreview?: boolean;
  } = {},
) {
  if (!svpVersionId) {
    return {
      predmetOptions: [],
      podpredmetOptions: [],
      oblastOptions: [],
      lodickaOptions: [],
    };
  }

  const includeAreaPeople = options.includeAreaPeople ?? true;
  const includeAreaCounts = options.includeAreaCounts ?? true;
  const includeAreaPreview = options.includeAreaPreview ?? true;
  const includeLodicky = options.includeLodicky ?? true;

  const [predmetOptions, podpredmetOptions, oblastOptions, lodickaOptions] = await Promise.all([
    prisma.$queryRaw<TaxonomyOption[]>(Prisma.sql`
      SELECT id, kod, nazev, stupen::text AS stupen, poradi
      FROM app_m01_predmet
      WHERE svp_version_id = ${svpVersionId}
        AND is_active = true
      ORDER BY poradi ASC NULLS LAST, nazev ASC
    `),
    prisma.$queryRaw<TaxonomyOption[]>(Prisma.sql`
      SELECT id, kod, nazev, stupen::text AS stupen, poradi, predmet_id AS "predmetId"
      FROM app_m01_podpredmet
      WHERE svp_version_id = ${svpVersionId}
        AND is_active = true
      ORDER BY poradi ASC NULLS LAST, nazev ASC
    `),
    prisma.$queryRaw<TaxonomyOption[]>(Prisma.sql`
      SELECT
        ob.id,
        ob.kod,
        ob.nazev,
        ob.stupen::text AS stupen,
        ob.poradi,
        ob.predmet_id AS "predmetId",
        ob.podpredmet_id AS "podpredmetId",
        ${includeAreaPeople
          ? Prisma.sql`COALESCE(
              (
                SELECT array_agg(DISTINCT os.person_id)
                FROM app_m01_oblast_spravce os
                WHERE os.oblast_id = ob.id
              ),
              ARRAY[]::text[]
            )`
          : Prisma.sql`ARRAY[]::text[]`} AS "spravcePersonIds",
        ${includeAreaPeople
          ? Prisma.sql`(
              SELECT string_agg(DISTINCT p.display_name, ', ' ORDER BY p.display_name)
              FROM app_m01_oblast_spravce os
              JOIN app_person p ON p.id = os.person_id
              WHERE os.oblast_id = ob.id
            )`
          : Prisma.sql`NULL::text`} AS "spravciNames",
        ${includeAreaPeople
          ? Prisma.sql`COALESCE(
              (
                SELECT array_agg(DISTINCT sg.person_id)
                FROM app_m01_lodicka l
                JOIN app_m01_lodicka_stav_garant sg ON sg.lodicka_id = l.id
                WHERE l.oblast_id = ob.id
                  AND l.is_deleted = false
              ),
              ARRAY[]::text[]
            )`
          : Prisma.sql`ARRAY[]::text[]`} AS "garantPersonIds",
        ${includeAreaPeople
          ? Prisma.sql`(
              SELECT string_agg(DISTINCT p.display_name, ', ' ORDER BY p.display_name)
              FROM app_m01_lodicka l
              JOIN app_m01_lodicka_stav_garant sg ON sg.lodicka_id = l.id
              JOIN app_person p ON p.id = sg.person_id
              WHERE l.oblast_id = ob.id
                AND l.is_deleted = false
            )`
          : Prisma.sql`NULL::text`} AS "garantiNames",
        ${includeAreaCounts
          ? Prisma.sql`(
              SELECT count(*)::int
              FROM app_m01_lodicka l
              WHERE l.oblast_id = ob.id
                AND l.is_deleted = false
            )`
          : Prisma.sql`0::int`} AS "lodickyCount",
        ${includeAreaPreview
          ? Prisma.sql`COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', lodicka.id,
                    'kod', lodicka.kod,
                    'nazev', lodicka.nazev,
                    'rocnikOd', lodicka.rocnik_od,
                    'rocnikDo', lodicka.rocnik_do
                  )
                  ORDER BY lodicka.nazev ASC, lodicka.kod ASC
                )
                FROM (
                  SELECT id, kod, nazev, rocnik_od, rocnik_do
                  FROM app_m01_lodicka
                  WHERE oblast_id = ob.id
                    AND is_deleted = false
                  ORDER BY nazev ASC, kod ASC
                  LIMIT 6
                ) lodicka
              ),
              '[]'::jsonb
            )`
          : Prisma.sql`'[]'::jsonb`} AS "lodickyPreview"
      FROM app_m01_oblast ob
      WHERE ob.svp_version_id = ${svpVersionId}
        AND ob.is_active = true
      ORDER BY ob.poradi ASC NULLS LAST, ob.nazev ASC
    `),
    includeLodicky
      ? prisma.$queryRaw<TaxonomyLodickaOption[]>(Prisma.sql`
          SELECT
            l.id,
            l.kod,
            l.nazev,
            l.popis,
            l.stupen::text AS stupen,
            l.rocnik_od AS "rocnikOd",
            l.rocnik_do AS "rocnikDo",
            l.predmet_id AS "predmetId",
            l.podpredmet_id AS "podpredmetId",
            l.oblast_id AS "oblastId",
            l.ovu_not_applicable AS "ovuNotApplicable",
            COALESCE(
              array_agg(DISTINCT link.rvp_ovu_id) FILTER (WHERE link.rvp_ovu_id IS NOT NULL),
              ARRAY[]::text[]
            ) AS "ovuIds"
          FROM app_m01_lodicka l
          LEFT JOIN app_m01_lodicka_ovu_link link ON link.lodicka_id = l.id
          WHERE l.svp_version_id = ${svpVersionId}
            AND l.is_deleted = false
          GROUP BY l.id
          ORDER BY l.nazev ASC, l.kod ASC
        `)
      : Promise.resolve([]),
  ]);

  return { predmetOptions, podpredmetOptions, oblastOptions, lodickaOptions };
}

async function getSpravceOptions(): Promise<LodickyManagementPersonOption[]> {
  return prisma.$queryRaw<LodickyManagementPersonOption[]>(Prisma.sql`
    SELECT
      p.id,
      COALESCE(NULLIF(BTRIM(p.nickname), ''), p.display_name) AS "displayName",
      p.display_name AS "legalName",
      p.identifier,
      COALESCE(login.normalized_value, sr.primary_email) AS email
    FROM app_person p
    JOIN app_role_assignment ra
      ON ra.person_id = p.id
      AND ra.role = 'spravce_lodicek'
      AND ra.is_active = true
    LEFT JOIN LATERAL (
      SELECT i.normalized_value
      FROM app_login_person_link l
      JOIN app_login_identity i ON i.id = l.identity_id AND i.is_active = true
      WHERE l.person_id = p.id
        AND l.status = 'approved'
      ORDER BY l.approved_at DESC NULLS LAST
      LIMIT 1
    ) login ON true
    LEFT JOIN LATERAL (
      SELECT primary_email
      FROM app_person_source_record
      WHERE person_id = p.id
        AND active_source = true
        AND primary_email IS NOT NULL
      LIMIT 1
    ) sr ON true
    WHERE p.is_active = true
    ORDER BY p.display_name ASC
    LIMIT 300
  `);
}

async function getGarantOptions(): Promise<LodickyManagementPersonOption[]> {
  return prisma.$queryRaw<LodickyManagementPersonOption[]>(Prisma.sql`
    SELECT
      p.id,
      COALESCE(NULLIF(BTRIM(p.nickname), ''), p.display_name) AS "displayName",
      p.display_name AS "legalName",
      p.identifier,
      COALESCE(login.normalized_value, sr.primary_email) AS email
    FROM app_person p
    JOIN app_role_assignment ra
      ON ra.person_id = p.id
      AND ra.role = 'garant'
      AND ra.is_active = true
    LEFT JOIN LATERAL (
      SELECT i.normalized_value
      FROM app_login_person_link l
      JOIN app_login_identity i ON i.id = l.identity_id AND i.is_active = true
      WHERE l.person_id = p.id
        AND l.status = 'approved'
      ORDER BY l.approved_at DESC NULLS LAST
      LIMIT 1
    ) login ON true
    LEFT JOIN LATERAL (
      SELECT primary_email
      FROM app_person_source_record
      WHERE person_id = p.id
        AND active_source = true
        AND primary_email IS NOT NULL
      LIMIT 1
    ) sr ON true
    WHERE p.is_active = true
    ORDER BY p.display_name ASC
    LIMIT 300
  `);
}

async function getLodickyCounts(where: Prisma.Sql): Promise<CountRow> {
  const countRows = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM app_m01_lodicka_ovu_link count_ovu WHERE count_ovu.lodicka_id = l.id
        )
        AND l.ovu_not_applicable = false
      )::int AS without_ovu,
      count(*) FILTER (WHERE l.ovu_not_applicable = true)::int AS ovu_not_applicable,
      count(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM app_m01_oblast_spravce count_os WHERE count_os.oblast_id = l.oblast_id
        )
      )::int AS without_spravce,
      count(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM app_m01_lodicka_stav_garant count_sg WHERE count_sg.lodicka_id = l.id
        )
        AND l.garant_person_id IS NULL
      )::int AS without_garant
    FROM app_m01_lodicka l
    JOIN app_m01_predmet pr ON pr.id = l.predmet_id
    LEFT JOIN app_m01_podpredmet pp ON pp.id = l.podpredmet_id
    JOIN app_m01_oblast ob ON ob.id = l.oblast_id
    ${where}
  `);

  return countRows[0] ?? {
    total: 0,
    without_ovu: 0,
    ovu_not_applicable: 0,
    without_spravce: 0,
    without_garant: 0,
  };
}

function toPublicCounts(counts: CountRow): LodickyManagementRowsResult["counts"] {
  return {
    total: counts.total,
    withoutOvu: counts.without_ovu,
    ovuNotApplicable: counts.ovu_not_applicable,
    withoutSpravce: counts.without_spravce,
    withoutGarant: counts.without_garant,
  };
}

function pickCreateDefaults(taxonomy: Awaited<ReturnType<typeof getTaxonomyOptions>>): LodickyCreateDefaults | null {
  const predmet = taxonomy.predmetOptions.find((option) => option.stupen === "I_STUPEN")
    ?? taxonomy.predmetOptions[0]
    ?? null;
  if (!predmet) return null;

  const podpredmet = taxonomy.podpredmetOptions.find(
    (option) => option.stupen === predmet.stupen && option.predmetId === predmet.id,
  ) ?? null;
  const oblast = taxonomy.oblastOptions.find(
    (option) =>
      option.stupen === predmet.stupen &&
      option.predmetId === predmet.id &&
      (podpredmet ? option.podpredmetId === podpredmet.id : !option.podpredmetId),
  ) ?? taxonomy.oblastOptions.find(
    (option) => option.stupen === predmet.stupen && option.predmetId === predmet.id,
  ) ?? null;
  if (!oblast) return null;

  const stupen = predmet.stupen === "II_STUPEN" ? "II_STUPEN" : "I_STUPEN";
  return {
    stupen,
    rocnikOd: stupen === "I_STUPEN" ? 1 : 6,
    rocnikDo: stupen === "I_STUPEN" ? 5 : 9,
    predmetId: predmet.id,
    podpredmetId: oblast.podpredmetId ?? podpredmet?.id ?? null,
    oblastId: oblast.id,
  };
}

export async function getLodickyManagementPage(input: {
  filters: LodickyManagementFilters;
  access: LodickyManagementAccess;
  view?: LodickyManagementView;
}) {
  const view = input.view ?? "struktura";
  const svpVersions = await getSvpVersions();
  const selectedSvp = pickSvpVersion(svpVersions, input.filters.svpVersionId);
  const where = buildWhere({
    filters: input.filters,
    svpVersionId: selectedSvp?.id ?? null,
    access: input.access,
    restrictToAssigned: shouldRestrictRowsToAssigned(input),
  });
  const wholeFleet = canManageWholeFleet(input.access.roles);
  const rowScope = wholeFleet || input.filters.scope === "vse" || !hasLodickyManagerRole(input.access.roles)
    ? "all"
    : "assigned";
  const canEditSvpStructure = Boolean(
    wholeFleet && selectedSvp?.status === "DRAFT" && selectedSvp.parentSvpVersionId,
  );
  const shouldLoadStructureData = view === "struktura";
  const shouldLoadRvpVersions = view === "struktura" || view === "rvp";
  const shouldLoadSpravci = (view === "struktura" && canEditSvpStructure)
    || (view === "seznam" && canEditSvpStructure)
    || (view === "pristup" && wholeFleet);
  const shouldLoadGaranti = (view === "struktura" && canEditSvpStructure)
    || (view === "seznam" && canEditSvpStructure);

  const [rvpVersions, taxonomy, counts, spravceOptions, garantOptions, ovuOptions, draftChangeSummary, versionHistory] = await Promise.all([
    shouldLoadRvpVersions ? getRvpVersions() : Promise.resolve([]),
    getTaxonomyOptions(selectedSvp?.id ?? null, {
      includeLodicky: shouldLoadStructureData,
      includeAreaPeople: shouldLoadStructureData || view === "pristup",
      includeAreaCounts: shouldLoadStructureData || view === "pristup",
      includeAreaPreview: shouldLoadStructureData,
    }),
    view === "seznam"
      ? getLodickyCounts(where)
      : Promise.resolve({
          total: selectedSvp?.lodickyCount ?? 0,
          without_ovu: selectedSvp?.withoutOvu ?? 0,
          ovu_not_applicable: selectedSvp?.ovuNotApplicable ?? 0,
          without_spravce: selectedSvp?.withoutSpravce ?? 0,
          without_garant: selectedSvp?.withoutGarant ?? 0,
        } satisfies CountRow),
    shouldLoadSpravci ? getSpravceOptions() : Promise.resolve([]),
    shouldLoadGaranti ? getGarantOptions() : Promise.resolve([]),
    shouldLoadStructureData && selectedSvp
      ? prisma.$queryRaw<LodickyManagementOvuOption[]>(Prisma.sql`
          SELECT
            o.id,
            o.kod,
            o.zneni,
            CASE
              WHEN ub.id IS NULL THEN NULL
              ELSE CONCAT_WS(' · ', ub.kod, ub.nazev)
            END AS "uzlovyBod",
            ub.kod AS "uzlovyBodKod",
            ub.nazev AS "uzlovyBodNazev",
            ub.grade_num AS "uzlovyBodRocnik",
            ub.stage_code AS "uzlovyBodStupen",
            false AS "isSelected"
          FROM app_m01_rvp_ovu o
          LEFT JOIN app_m01_rvp_uzlovy_bod ub ON ub.id = o.uzlovy_bod_id
          WHERE o.rvp_version_id = ${selectedSvp.basedOnRvpVersionId}
          ORDER BY o.kod ASC
          LIMIT 1000
        `)
      : Promise.resolve([]),
    shouldLoadStructureData ? getSvpDraftChangeSummary(selectedSvp) : Promise.resolve(null),
    shouldLoadStructureData ? getSvpVersionChangeHistory(selectedSvp?.id ?? null) : Promise.resolve([]),
  ]);

  const pageCount = Math.max(1, Math.ceil(counts.total / LODICKY_PAGE_SIZE));
  const pageNumber = Math.min(input.filters.page, pageCount);

  return {
    svpVersions,
    rvpVersions,
    selectedSvp,
    scope: wholeFleet ? "fleet" as const : rowScope,
    counts: toPublicCounts(counts),
    pagination: {
      page: pageNumber,
      pageSize: LODICKY_PAGE_SIZE,
      pageCount,
    },
    spravceOptions,
    garantOptions,
    ovuOptions,
    draftChangeSummary,
    versionHistory,
    ...taxonomy,
  };
}

export async function getLodickyManagementRows(input: {
  filters: LodickyManagementFilters;
  access: LodickyManagementAccess;
}): Promise<LodickyManagementRowsResult> {
  const selectedSvpVersionId = input.filters.svpVersionId || (pickSvpVersion(await getSvpVersions(), "")?.id ?? null);
  const where = buildWhere({
    filters: input.filters,
    svpVersionId: selectedSvpVersionId,
    access: input.access,
    restrictToAssigned: shouldRestrictRowsToAssigned(input),
  });
  const requestedPage = Math.max(1, input.filters.page);
  const offset = (requestedPage - 1) * LODICKY_PAGE_SIZE;
  const [counts, rows] = await Promise.all([
    getLodickyCounts(where),
    prisma.$queryRaw<LodickyManagementRow[]>(Prisma.sql`
    SELECT
      l.id,
      l.kod,
      l.nazev,
      l.typ::text AS typ,
      l.stupen::text AS stupen,
      l.rocnik_od AS "rocnikOd",
      l.rocnik_do AS "rocnikDo",
      l.ovu_not_applicable AS "ovuNotApplicable",
      pr.nazev AS predmet,
      pp.nazev AS podpredmet,
      ob.nazev AS oblast,
      string_agg(DISTINCT sgp.display_name, ', ' ORDER BY sgp.display_name) AS "garantName",
      string_agg(DISTINCT sp.display_name, ', ' ORDER BY sp.display_name) AS "spravciNames",
      COALESCE(
        array_agg(DISTINCT os.person_id) FILTER (WHERE os.person_id IS NOT NULL),
        ARRAY[]::text[]
      ) AS "spravcePersonIds",
      ${canEditBasicSql(input.access)} AS "canEditBasic",
      count(DISTINCT os.person_id)::int AS "spravciCount",
      count(DISTINCT ov.rvp_ovu_id)::int AS "ovuCount"
    FROM app_m01_lodicka l
    JOIN app_m01_predmet pr ON pr.id = l.predmet_id
    LEFT JOIN app_m01_podpredmet pp ON pp.id = l.podpredmet_id
    JOIN app_m01_oblast ob ON ob.id = l.oblast_id
    LEFT JOIN app_m01_lodicka_stav_garant sg ON sg.lodicka_id = l.id
    LEFT JOIN app_person sgp ON sgp.id = sg.person_id
    LEFT JOIN app_m01_oblast_spravce os ON os.oblast_id = l.oblast_id
    LEFT JOIN app_person sp ON sp.id = os.person_id
    LEFT JOIN app_m01_lodicka_ovu_link ov ON ov.lodicka_id = l.id
    ${where}
    GROUP BY l.id, pr.nazev, pp.nazev, ob.nazev
    ORDER BY pr.nazev ASC, pp.nazev ASC NULLS FIRST, ob.nazev ASC, l.rocnik_od ASC, l.kod ASC
    LIMIT ${LODICKY_PAGE_SIZE}
    OFFSET ${offset}
  `),
  ]);
  const pageCount = Math.max(1, Math.ceil(counts.total / LODICKY_PAGE_SIZE));
  const pageNumber = Math.min(requestedPage, pageCount);

  return {
    rows,
    pagination: {
      page: pageNumber,
      pageSize: LODICKY_PAGE_SIZE,
      pageCount,
    },
    counts: toPublicCounts(counts),
  };
}

export async function getLodickyManagementDetailPage(input: {
  lodickaId: string;
  access: LodickyManagementAccess;
  basicOnly?: boolean;
}): Promise<LodickyManagementDetailPage> {
  const lodickaRows = await prisma.$queryRaw<LodickyManagementDetail[]>(Prisma.sql`
    SELECT
      l.id,
      l.svp_version_id AS "svpVersionId",
      svp.status::text AS "svpStatus",
      svp.parent_svp_version_id AS "parentSvpVersionId",
      svp.label AS "svpLabel",
      svp.based_on_rvp_version_id AS "svpBasedOnRvpVersionId",
      rvp.dataset_version AS "rvpDatasetVersion",
      l.kod,
      l.nazev,
      l.popis,
      l.typ::text AS typ,
      l.stupen::text AS stupen,
      l.rocnik_od AS "rocnikOd",
      l.rocnik_do AS "rocnikDo",
      l.predmet_id AS "predmetId",
      l.podpredmet_id AS "podpredmetId",
      l.oblast_id AS "oblastId",
      pr.nazev AS predmet,
      pp.nazev AS podpredmet,
      ob.nazev AS oblast,
      l.ovu_not_applicable AS "ovuNotApplicable",
      COALESCE(
        array_agg(DISTINCT os.person_id) FILTER (WHERE os.person_id IS NOT NULL),
        ARRAY[]::text[]
      ) AS "spravcePersonIds",
      ${canEditBasicSql(input.access)} AS "canEditBasic",
      COALESCE(
        array_agg(DISTINCT sg.person_id) FILTER (WHERE sg.person_id IS NOT NULL),
        ARRAY[]::text[]
      ) AS "garantPersonIds",
      COALESCE(
        array_agg(DISTINCT ov.rvp_ovu_id) FILTER (WHERE ov.rvp_ovu_id IS NOT NULL),
        ARRAY[]::text[]
      ) AS "ovuIds"
    FROM app_m01_lodicka l
    JOIN app_m01_svp_version svp ON svp.id = l.svp_version_id
    JOIN app_m01_rvp_version rvp ON rvp.id = svp.based_on_rvp_version_id
    JOIN app_m01_predmet pr ON pr.id = l.predmet_id
    LEFT JOIN app_m01_podpredmet pp ON pp.id = l.podpredmet_id
    JOIN app_m01_oblast ob ON ob.id = l.oblast_id
    LEFT JOIN app_m01_oblast_spravce os ON os.oblast_id = l.oblast_id
    LEFT JOIN app_m01_lodicka_stav_garant sg ON sg.lodicka_id = l.id
    LEFT JOIN app_m01_lodicka_ovu_link ov ON ov.lodicka_id = l.id
    WHERE l.id = ${input.lodickaId}
      AND l.is_deleted = false
    GROUP BY l.id, svp.id, rvp.id, pr.nazev, pp.nazev, ob.nazev
    LIMIT 1
  `);

  const lodicka = lodickaRows[0] ?? null;
  const canEditFleetFields = Boolean(
    lodicka &&
      canManageWholeFleet(input.access.roles) &&
      !input.basicOnly &&
      lodicka.svpStatus === "DRAFT" &&
      lodicka.parentSvpVersionId,
  );
  const canEditBasicFields = Boolean(canEditFleetFields || lodicka?.canEditBasic);
  const emptyTaxonomy: Awaited<ReturnType<typeof getTaxonomyOptions>> = {
    predmetOptions: [],
    podpredmetOptions: [],
    oblastOptions: [],
    lodickaOptions: [],
  };
  const [spravceOptions, garantOptions, taxonomy, ovuOptions] = await Promise.all([
    canEditFleetFields ? getSpravceOptions() : Promise.resolve([]),
    canEditFleetFields ? getGarantOptions() : Promise.resolve([]),
    canEditFleetFields ? getTaxonomyOptions(lodicka?.svpVersionId ?? null) : Promise.resolve(emptyTaxonomy),
    lodicka
      ? canEditFleetFields
        ? prisma.$queryRaw<LodickyManagementOvuOption[]>(Prisma.sql`
          SELECT
            o.id,
            o.kod,
            o.zneni,
            CASE
              WHEN ub.id IS NULL THEN NULL
              ELSE CONCAT_WS(' · ', ub.kod, ub.nazev)
            END AS "uzlovyBod",
            ub.kod AS "uzlovyBodKod",
            ub.nazev AS "uzlovyBodNazev",
            ub.grade_num AS "uzlovyBodRocnik",
            ub.stage_code AS "uzlovyBodStupen",
            EXISTS (
              SELECT 1
              FROM app_m01_lodicka_ovu_link link
              WHERE link.lodicka_id = ${input.lodickaId}
                AND link.rvp_ovu_id = o.id
            ) AS "isSelected"
          FROM app_m01_rvp_ovu o
          LEFT JOIN app_m01_rvp_uzlovy_bod ub ON ub.id = o.uzlovy_bod_id
          WHERE o.rvp_version_id = ${lodicka.svpBasedOnRvpVersionId}
          ORDER BY o.kod ASC
          LIMIT 1000
        `)
        : lodicka.ovuIds.length > 0
          ? prisma.$queryRaw<LodickyManagementOvuOption[]>(Prisma.sql`
              SELECT
                o.id,
                o.kod,
                o.zneni,
                CASE
                  WHEN ub.id IS NULL THEN NULL
                  ELSE CONCAT_WS(' · ', ub.kod, ub.nazev)
                END AS "uzlovyBod",
                ub.kod AS "uzlovyBodKod",
                ub.nazev AS "uzlovyBodNazev",
                ub.grade_num AS "uzlovyBodRocnik",
                ub.stage_code AS "uzlovyBodStupen",
                true AS "isSelected"
              FROM app_m01_rvp_ovu o
              LEFT JOIN app_m01_rvp_uzlovy_bod ub ON ub.id = o.uzlovy_bod_id
              WHERE o.id IN (${Prisma.join(lodicka.ovuIds)})
              ORDER BY o.kod ASC
            `)
          : Promise.resolve([])
      : Promise.resolve([]),
  ]);

  return {
    lodicka,
    canEditFleetFields,
    canEditBasicFields,
    spravceOptions,
    garantOptions,
    ...taxonomy,
    ovuOptions,
  };
}

export async function getLodickyCreatePage(input: {
  svpVersionId: string;
}): Promise<LodickyCreatePage> {
  const svpVersions = await getSvpVersions();
  const selectedSvp = pickSvpVersion(svpVersions, input.svpVersionId);
  const taxonomy = await getTaxonomyOptions(selectedSvp?.id ?? null);
  const [spravceOptions, garantOptions, ovuOptions] = await Promise.all([
    getSpravceOptions(),
    getGarantOptions(),
    selectedSvp
      ? prisma.$queryRaw<LodickyManagementOvuOption[]>(Prisma.sql`
          SELECT
            o.id,
            o.kod,
            o.zneni,
            CASE
              WHEN ub.id IS NULL THEN NULL
              ELSE CONCAT_WS(' · ', ub.kod, ub.nazev)
            END AS "uzlovyBod",
            ub.kod AS "uzlovyBodKod",
            ub.nazev AS "uzlovyBodNazev",
            ub.grade_num AS "uzlovyBodRocnik",
            ub.stage_code AS "uzlovyBodStupen",
            false AS "isSelected"
          FROM app_m01_rvp_ovu o
          LEFT JOIN app_m01_rvp_uzlovy_bod ub ON ub.id = o.uzlovy_bod_id
          WHERE o.rvp_version_id = ${selectedSvp.basedOnRvpVersionId}
          ORDER BY o.kod ASC
          LIMIT 1000
        `)
      : Promise.resolve([]),
  ]);

  return {
    selectedSvp,
    defaults: pickCreateDefaults(taxonomy),
    spravceOptions,
    garantOptions,
    ...taxonomy,
    ovuOptions,
  };
}

export async function getRvpManagementPage(input: { filters: RvpManagementFilters }) {
  const rvpVersions = await getRvpVersions();
  const selectedRvp = pickRvpVersion(rvpVersions, input.filters.rvpVersionId);
  const like = `%${input.filters.q}%`;
  const searchClause = input.filters.q
    ? Prisma.sql`AND (
        o.kod ILIKE ${like}
        OR o.zneni ILIKE ${like}
        OR COALESCE(ub.kod, '') ILIKE ${like}
        OR COALESCE(ub.nazev, '') ILIKE ${like}
      )`
    : Prisma.empty;

  const [svpLinks, ovuRows] = selectedRvp
    ? await Promise.all([
        prisma.$queryRaw<RvpSvpLink[]>(Prisma.sql`
          SELECT
            svp.id,
            svp.label,
            svp.status::text AS status,
            svp.is_current AS "isCurrent",
            svp.effective_from AS "effectiveFrom",
            svp.effective_to AS "effectiveTo",
            count(DISTINCT l.id)::int AS "lodickyCount"
          FROM app_m01_svp_version svp
          LEFT JOIN app_m01_lodicka l ON l.svp_version_id = svp.id AND l.is_deleted = false
          WHERE svp.based_on_rvp_version_id = ${selectedRvp.id}
          GROUP BY svp.id
          ORDER BY svp.is_current DESC, svp.effective_from DESC
        `),
        prisma.$queryRaw<RvpOvuRow[]>(Prisma.sql`
          SELECT
            o.id,
            o.kod,
            o.zneni,
            ub.kod AS "uzlovyBodKod",
            ub.nazev AS "uzlovyBodNazev",
            count(DISTINCT link.lodicka_id)::int AS "linkedLodickyCount"
          FROM app_m01_rvp_ovu o
          LEFT JOIN app_m01_rvp_uzlovy_bod ub ON ub.id = o.uzlovy_bod_id
          LEFT JOIN app_m01_lodicka_ovu_link link ON link.rvp_ovu_id = o.id
          WHERE o.rvp_version_id = ${selectedRvp.id}
          ${searchClause}
          GROUP BY o.id, ub.id
          ORDER BY o.kod ASC
          LIMIT 500
        `),
      ])
    : [[], []];

  return {
    rvpVersions,
    selectedRvp,
    svpLinks,
    ovuRows,
  };
}

export async function verifyCanEditLodicka(input: {
  lodickaId: string;
  access: LodickyManagementAccess;
}): Promise<boolean> {
  const where = buildLodickaAccessWhere(input);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT count(*)::int AS count
    FROM app_m01_lodicka l
    ${where}
  `);
  return (rows[0]?.count ?? 0) > 0;
}
