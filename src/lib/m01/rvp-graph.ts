import { Prisma } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";

export type RvpGraphSvpOption = {
  id: string;
  label: string;
  status: string;
  isCurrent: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  basedOnRvpVersionId: string;
  rvpDatasetVersion: string;
  rvpSourceFormat: string;
  lodickyCount: number;
  confirmedLinkCount: number;
};

export type RvpGraphCounts = {
  graphNodes: number;
  graphEdges: number;
  ovuNodes: number;
  confirmedLinks: number;
  linkedLodicky: number;
};

export type RvpGraphNeighborLink = {
  edgeType: string;
  code: string | null;
  title: string | null;
  bodyText: string | null;
};

export type RvpGraphContextNode = {
  id: string;
  entityType: string;
  code: string | null;
  title: string | null;
  bodyText: string | null;
  depthFromOvu: number;
};

export type RvpGraphVerticalPath = {
  label: string;
  nodes: RvpGraphContextNode[];
};

export type RvpGraphOvuLink = {
  id: string;
  kod: string;
  zneni: string;
  uzlovyBod: string | null;
  graphNodeId: string | null;
  contextTitle: string | null;
  contextType: string | null;
  verticalPaths: RvpGraphVerticalPath[];
  verticalNeighbors: RvpGraphNeighborLink[];
  horizontalNeighbors: RvpGraphNeighborLink[];
  methodSupport: RvpGraphNeighborLink[];
};

export type RvpGraphLodickaLink = {
  id: string;
  kod: string;
  nazev: string;
  popis: string | null;
  predmet: string;
  oblast: string;
  rocnikOd: number;
  rocnikDo: number;
  confirmedOvu: RvpGraphOvuLink[];
};

export type RvpGraphOvuRow = {
  id: string;
  kod: string;
  zneni: string;
  uzlovyBod: string | null;
  graphNodeId: string | null;
  parentTitle: string | null;
  parentType: string | null;
  linkedLodickyCount: number;
  incomingEdges: number;
  outgoingEdges: number;
};

export type RvpGraphEdgeTypeCount = {
  edgeType: string;
  count: number;
};

export type RvpGraphCoverageOvu = {
  id: string;
  kod: string;
  zneni: string;
  linkedLodickyCount: number;
};

export type RvpGraphCoverageArea = {
  id: string;
  title: string;
  entityType: string;
  coverageLevel: string;
  totalOvu: number;
  linkedOvu: number;
  linkCount: number;
  coveragePercent: number;
  linkedOvuSamples: RvpGraphCoverageOvu[];
  unlinkedOvuSamples: RvpGraphCoverageOvu[];
};

export type RvpGraphOverview = {
  svpOptions: RvpGraphSvpOption[];
  selectedSvp: RvpGraphSvpOption | null;
  counts: RvpGraphCounts;
  lodicky: RvpGraphLodickaLink[];
  ovuRows: RvpGraphOvuRow[];
  edgeTypeCounts: RvpGraphEdgeTypeCount[];
  coverageAreas: RvpGraphCoverageArea[];
};

type NeighborRow = {
  graphNodeId: string;
  neighborKind: "vertical" | "horizontal" | "method";
  edgeType: string;
  code: string | null;
  title: string | null;
  bodyText: string | null;
};

type LinkRow = {
  lodickaId: string;
  lodickaKod: string;
  lodickaNazev: string;
  lodickaPopis: string | null;
  predmet: string;
  oblast: string;
  rocnikOd: number;
  rocnikDo: number;
  ovuId: string | null;
  ovuKod: string | null;
  ovuZneni: string | null;
  uzlovyBod: string | null;
  graphNodeId: string | null;
  contextTitle: string | null;
  contextType: string | null;
};

type CoverageOvuRow = {
  areaId: string;
  id: string;
  kod: string;
  zneni: string;
  linkedLodickyCount: number;
  isLinked: boolean;
};

type ContextPathRow = RvpGraphContextNode & {
  graphNodeId: string;
};

function pickSelectedSvp(options: RvpGraphSvpOption[], requestedId: string): RvpGraphSvpOption | null {
  if (requestedId) {
    const selected = options.find((option) => option.id === requestedId);
    if (selected) return selected;
  }
  return options.find((option) => option.isCurrent) ?? options[0] ?? null;
}

function buildSearchClause(q: string): Prisma.Sql {
  if (!q) return Prisma.empty;
  const like = `%${q}%`;
  return Prisma.sql`AND (
    l.kod ILIKE ${like}
    OR l.nazev ILIKE ${like}
    OR COALESCE(l.popis, '') ILIKE ${like}
    OR pr.nazev ILIKE ${like}
    OR ob.nazev ILIKE ${like}
    OR COALESCE(o.kod, '') ILIKE ${like}
    OR COALESCE(o.zneni, '') ILIKE ${like}
    OR COALESCE(ub.kod, '') ILIKE ${like}
    OR COALESCE(ub.nazev, '') ILIKE ${like}
  )`;
}

function buildOvuSearchClause(q: string): Prisma.Sql {
  if (!q) return Prisma.empty;
  const like = `%${q}%`;
  return Prisma.sql`AND (
    o.kod ILIKE ${like}
    OR o.zneni ILIKE ${like}
    OR COALESCE(ub.kod, '') ILIKE ${like}
    OR COALESCE(ub.nazev, '') ILIKE ${like}
  )`;
}

function groupNeighbors(rows: NeighborRow[]): Map<string, { vertical: RvpGraphNeighborLink[]; horizontal: RvpGraphNeighborLink[]; method: RvpGraphNeighborLink[] }> {
  const byNodeId = new Map<string, { vertical: RvpGraphNeighborLink[]; horizontal: RvpGraphNeighborLink[]; method: RvpGraphNeighborLink[] }>();
  for (const row of rows) {
    const target = byNodeId.get(row.graphNodeId) ?? { vertical: [], horizontal: [], method: [] };
    const link = { edgeType: row.edgeType, code: row.code, title: row.title, bodyText: row.bodyText };
    if (row.neighborKind === "vertical") target.vertical.push(link);
    else if (row.neighborKind === "method") target.method.push(link);
    else target.horizontal.push(link);
    byNodeId.set(row.graphNodeId, target);
  }
  return byNodeId;
}

function pathLabel(nodes: RvpGraphContextNode[]) {
  const first = nodes[0];
  if (!first) return "RVP cesta";
  const labels: Record<string, string> = {
    vzdelavaciOblasti: "Vzdělávací oblast",
    vzdelavaciObory: "Vzdělávací obor",
    tematickeOkruhy: "Tematický okruh",
    klicoveKompetence: "Klíčová kompetence",
    slozkyKlicoveKompetence: "Složka klíčové kompetence",
    zakladniGramotnosti: "Základní gramotnost",
    slozkyZakladniGramotnosti: "Složka gramotnosti",
    prurezovaTemata: "Průřezové téma",
  };
  return labels[first.entityType] ?? "RVP cesta";
}

function groupVerticalPaths(rows: ContextPathRow[]): Map<string, RvpGraphVerticalPath[]> {
  const byNodeId = new Map<string, RvpGraphContextNode[]>();
  for (const row of rows) {
    const group = byNodeId.get(row.graphNodeId) ?? [];
    group.push({
      id: row.id,
      entityType: row.entityType,
      code: row.code,
      title: row.title,
      bodyText: row.bodyText,
      depthFromOvu: row.depthFromOvu,
    });
    byNodeId.set(row.graphNodeId, group);
  }

  const paths = new Map<string, RvpGraphVerticalPath[]>();
  for (const [graphNodeId, nodes] of byNodeId.entries()) {
    const ordered = nodes
      .filter((node, index, array) => array.findIndex((other) => other.id === node.id) === index)
      .sort((a, b) => b.depthFromOvu - a.depthFromOvu);
    paths.set(graphNodeId, [{ label: pathLabel(ordered), nodes: ordered }]);
  }
  return paths;
}

function groupLodicky(
  rows: LinkRow[],
  neighborsByGraphNodeId: Map<string, { vertical: RvpGraphNeighborLink[]; horizontal: RvpGraphNeighborLink[]; method: RvpGraphNeighborLink[] }>,
  verticalPathsByGraphNodeId: Map<string, RvpGraphVerticalPath[]>,
): RvpGraphLodickaLink[] {
  const byId = new Map<string, RvpGraphLodickaLink>();
  for (const row of rows) {
    let lodicka = byId.get(row.lodickaId);
    if (!lodicka) {
      lodicka = {
        id: row.lodickaId,
        kod: row.lodickaKod,
        nazev: row.lodickaNazev,
        popis: row.lodickaPopis,
        predmet: row.predmet,
        oblast: row.oblast,
        rocnikOd: row.rocnikOd,
        rocnikDo: row.rocnikDo,
        confirmedOvu: [],
      };
      byId.set(row.lodickaId, lodicka);
    }

    if (row.ovuId && row.ovuKod && row.ovuZneni) {
      const neighbors = row.graphNodeId ? neighborsByGraphNodeId.get(row.graphNodeId) : null;
      lodicka.confirmedOvu.push({
        id: row.ovuId,
        kod: row.ovuKod,
        zneni: row.ovuZneni,
        uzlovyBod: row.uzlovyBod,
        graphNodeId: row.graphNodeId,
        contextTitle: row.contextTitle,
        contextType: row.contextType,
        verticalPaths: row.graphNodeId ? (verticalPathsByGraphNodeId.get(row.graphNodeId) ?? []) : [],
        verticalNeighbors: neighbors?.vertical.slice(0, 8) ?? [],
        horizontalNeighbors: neighbors?.horizontal.slice(0, 8) ?? [],
        methodSupport: neighbors?.method.slice(0, 8) ?? [],
      });
    }
  }
  return [...byId.values()];
}

export async function getRvpGraphOverview(input: {
  svpVersionId?: string;
  q?: string;
  limit?: number;
}): Promise<RvpGraphOverview> {
  const q = input.q?.trim() ?? "";
  const limit = Math.max(10, Math.min(input.limit ?? 80, 1000));

  const svpOptions = await prisma.$queryRaw<RvpGraphSvpOption[]>(Prisma.sql`
    SELECT
      svp.id,
      svp.label,
      svp.status::text AS status,
      svp.is_current AS "isCurrent",
      svp.effective_from AS "effectiveFrom",
      svp.effective_to AS "effectiveTo",
      svp.based_on_rvp_version_id AS "basedOnRvpVersionId",
      rvp.dataset_version AS "rvpDatasetVersion",
      rvp.source_format AS "rvpSourceFormat",
      count(DISTINCT l.id)::int AS "lodickyCount",
      count(DISTINCT link.id)::int AS "confirmedLinkCount"
    FROM app_m01_svp_version svp
    JOIN app_m01_rvp_version rvp ON rvp.id = svp.based_on_rvp_version_id
    LEFT JOIN app_m01_lodicka l ON l.svp_version_id = svp.id AND l.is_deleted = false
    LEFT JOIN app_m01_lodicka_ovu_link link ON link.lodicka_id = l.id
    GROUP BY svp.id, rvp.id
    ORDER BY svp.is_current DESC, svp.effective_from DESC, svp.major DESC, svp.minor DESC
  `);

  const selectedSvp = pickSelectedSvp(svpOptions, input.svpVersionId?.trim() ?? "");
  if (!selectedSvp) {
    return {
      svpOptions,
      selectedSvp: null,
      counts: { graphNodes: 0, graphEdges: 0, ovuNodes: 0, confirmedLinks: 0, linkedLodicky: 0 },
      lodicky: [],
      ovuRows: [],
      edgeTypeCounts: [],
      coverageAreas: [],
    };
  }

  const searchClause = buildSearchClause(q);
  const ovuSearchClause = buildOvuSearchClause(q);
  const [countsRows, linkRows, ovuRows, edgeTypeCounts, coverageAreas, coverageOvuRows] = await Promise.all([
    prisma.$queryRaw<RvpGraphCounts[]>(Prisma.sql`
      SELECT
        (SELECT count(*)::int FROM app_m01_rvp_graph_node WHERE rvp_version_id = ${selectedSvp.basedOnRvpVersionId}) AS "graphNodes",
        (SELECT count(*)::int FROM app_m01_rvp_graph_edge WHERE rvp_version_id = ${selectedSvp.basedOnRvpVersionId}) AS "graphEdges",
        (SELECT count(*)::int FROM app_m01_rvp_graph_node WHERE rvp_version_id = ${selectedSvp.basedOnRvpVersionId} AND entity_type = 'ovu') AS "ovuNodes",
        (SELECT count(*)::int
          FROM app_m01_lodicka_ovu_link link
          JOIN app_m01_lodicka l ON l.id = link.lodicka_id
          WHERE l.svp_version_id = ${selectedSvp.id} AND l.is_deleted = false
        ) AS "confirmedLinks",
        (SELECT count(DISTINCT l.id)::int
          FROM app_m01_lodicka l
          JOIN app_m01_lodicka_ovu_link link ON link.lodicka_id = l.id
          WHERE l.svp_version_id = ${selectedSvp.id} AND l.is_deleted = false
        ) AS "linkedLodicky"
    `),
    prisma.$queryRaw<LinkRow[]>(Prisma.sql`
      SELECT
        l.id AS "lodickaId",
        l.kod AS "lodickaKod",
        l.nazev AS "lodickaNazev",
        l.popis AS "lodickaPopis",
        pr.nazev AS predmet,
        ob.nazev AS oblast,
        l.rocnik_od AS "rocnikOd",
        l.rocnik_do AS "rocnikDo",
        o.id AS "ovuId",
        o.kod AS "ovuKod",
        o.zneni AS "ovuZneni",
        CASE
          WHEN ub.kod IS NULL THEN ub.nazev
          ELSE ub.kod || ' · ' || ub.nazev
        END AS "uzlovyBod",
        node.id AS "graphNodeId",
        parent.title AS "contextTitle",
        parent.entity_type AS "contextType"
      FROM app_m01_lodicka l
      JOIN app_m01_predmet pr ON pr.id = l.predmet_id
      JOIN app_m01_oblast ob ON ob.id = l.oblast_id
      LEFT JOIN app_m01_lodicka_ovu_link link ON link.lodicka_id = l.id
      LEFT JOIN app_m01_rvp_ovu o ON o.id = link.rvp_ovu_id
      LEFT JOIN app_m01_rvp_uzlovy_bod ub ON ub.id = o.uzlovy_bod_id
      LEFT JOIN app_m01_rvp_graph_node node ON node.rvp_version_id = ${selectedSvp.basedOnRvpVersionId}
        AND node.source_table = 'app_m01_rvp_ovu'
        AND node.source_id = o.id
      LEFT JOIN app_m01_rvp_graph_edge parent_edge ON parent_edge.to_node_id = node.id
        AND parent_edge.edge_type = 'contains'
      LEFT JOIN app_m01_rvp_graph_node parent ON parent.id = parent_edge.from_node_id
      WHERE l.svp_version_id = ${selectedSvp.id}
        AND l.is_deleted = false
        ${searchClause}
      ORDER BY l.kod ASC, o.kod ASC NULLS LAST
      LIMIT ${limit * 8}
    `),
    prisma.$queryRaw<RvpGraphOvuRow[]>(Prisma.sql`
      SELECT
        o.id,
        o.kod,
        o.zneni,
        CASE
          WHEN ub.kod IS NULL THEN ub.nazev
          ELSE ub.kod || ' · ' || ub.nazev
        END AS "uzlovyBod",
        node.id AS "graphNodeId",
        parent.title AS "parentTitle",
        parent.entity_type AS "parentType",
        count(DISTINCT l.id)::int AS "linkedLodickyCount",
        count(DISTINCT incoming.id)::int AS "incomingEdges",
        count(DISTINCT outgoing.id)::int AS "outgoingEdges"
      FROM app_m01_rvp_ovu o
      LEFT JOIN app_m01_rvp_uzlovy_bod ub ON ub.id = o.uzlovy_bod_id
      LEFT JOIN app_m01_lodicka_ovu_link link ON link.rvp_ovu_id = o.id
      LEFT JOIN app_m01_lodicka l ON l.id = link.lodicka_id
        AND l.svp_version_id = ${selectedSvp.id}
        AND l.is_deleted = false
      LEFT JOIN app_m01_rvp_graph_node node ON node.rvp_version_id = ${selectedSvp.basedOnRvpVersionId}
        AND node.source_table = 'app_m01_rvp_ovu'
        AND node.source_id = o.id
      LEFT JOIN app_m01_rvp_graph_edge parent_edge ON parent_edge.to_node_id = node.id
        AND parent_edge.edge_type = 'contains'
      LEFT JOIN app_m01_rvp_graph_node parent ON parent.id = parent_edge.from_node_id
      LEFT JOIN app_m01_rvp_graph_edge incoming ON incoming.to_node_id = node.id
      LEFT JOIN app_m01_rvp_graph_edge outgoing ON outgoing.from_node_id = node.id
      WHERE o.rvp_version_id = ${selectedSvp.basedOnRvpVersionId}
        ${ovuSearchClause}
      GROUP BY o.id, ub.id, node.id, parent.id
      ORDER BY "linkedLodickyCount" DESC, o.kod ASC
      LIMIT ${limit}
    `),
    prisma.$queryRaw<RvpGraphEdgeTypeCount[]>(Prisma.sql`
      SELECT edge_type AS "edgeType", count(*)::int AS count
      FROM app_m01_rvp_graph_edge
      WHERE rvp_version_id = ${selectedSvp.basedOnRvpVersionId}
      GROUP BY edge_type
      ORDER BY count DESC, edge_type ASC
    `),
    prisma.$queryRaw<RvpGraphCoverageArea[]>(Prisma.sql`
      WITH RECURSIVE ancestors AS (
        SELECT
          node.id AS "ovuNodeId",
          o.id AS "ovuId",
          parent.id AS "contextId",
          parent.entity_type AS "entityType",
          parent.code,
          parent.title,
          1::int AS depth,
          ARRAY[node.id, parent.id] AS path
        FROM app_m01_rvp_graph_node node
        JOIN app_m01_rvp_ovu o ON node.source_id = o.id
        JOIN app_m01_rvp_graph_edge edge ON edge.to_node_id = node.id
          AND edge.edge_type = 'contains'
        JOIN app_m01_rvp_graph_node parent ON parent.id = edge.from_node_id
        WHERE node.rvp_version_id = ${selectedSvp.basedOnRvpVersionId}
          AND node.entity_type = 'ovu'

        UNION ALL

        SELECT
          ancestors."ovuNodeId",
          ancestors."ovuId",
          parent.id AS "contextId",
          parent.entity_type AS "entityType",
          parent.code,
          parent.title,
          ancestors.depth + 1 AS depth,
          ancestors.path || parent.id
        FROM ancestors
        JOIN app_m01_rvp_graph_edge edge ON edge.to_node_id = ancestors."contextId"
          AND edge.edge_type = 'contains'
        JOIN app_m01_rvp_graph_node parent ON parent.id = edge.from_node_id
        WHERE ancestors.depth < 10
          AND NOT parent.id = ANY(ancestors.path)
      ),
      contexts AS (
        SELECT DISTINCT *
        FROM ancestors
        WHERE "entityType" IN (
          'vzdelavaciOblasti', 'vzdelavaciObory', 'tematickeOkruhy', 'uzlovyBod',
          'klicoveKompetence', 'slozkyKlicoveKompetence',
          'zakladniGramotnosti', 'slozkyZakladniGramotnosti',
          'prurezovaTemata'
        )
      )
      SELECT
        context."contextId" AS id,
        COALESCE(context.title, context.code, 'Bez názvu') AS title,
        context."entityType" AS "entityType",
        CASE
          WHEN context."entityType" IN ('vzdelavaciOblasti', 'klicoveKompetence', 'zakladniGramotnosti', 'prurezovaTemata') THEN 'axis'
          WHEN context."entityType" IN ('vzdelavaciObory', 'slozkyKlicoveKompetence', 'slozkyZakladniGramotnosti') THEN 'branch'
          WHEN context."entityType" = 'tematickeOkruhy' THEN 'topic'
          WHEN context."entityType" = 'uzlovyBod' THEN 'node'
          ELSE 'context'
        END AS "coverageLevel",
        count(DISTINCT o.id)::int AS "totalOvu",
        count(DISTINCT o.id) FILTER (WHERE linked_l.id IS NOT NULL)::int AS "linkedOvu",
        count(DISTINCT link.id) FILTER (WHERE linked_l.id IS NOT NULL)::int AS "linkCount",
        COALESCE(
          round(
            100.0 * count(DISTINCT o.id) FILTER (WHERE linked_l.id IS NOT NULL)
            / NULLIF(count(DISTINCT o.id), 0)
          )::int,
          0
        ) AS "coveragePercent"
      FROM contexts context
      JOIN app_m01_rvp_ovu o ON o.id = context."ovuId"
      LEFT JOIN app_m01_lodicka_ovu_link link ON link.rvp_ovu_id = o.id
      LEFT JOIN app_m01_lodicka linked_l ON linked_l.id = link.lodicka_id
        AND linked_l.svp_version_id = ${selectedSvp.id}
        AND linked_l.is_deleted = false
      GROUP BY context."contextId", context.title, context.code, context."entityType"
      HAVING count(DISTINCT o.id) > 0
      ORDER BY "coverageLevel" ASC, "coveragePercent" ASC, "totalOvu" DESC, title ASC
      LIMIT 160
    `),
    prisma.$queryRaw<CoverageOvuRow[]>(Prisma.sql`
      WITH RECURSIVE ancestors AS (
        SELECT
          node.id AS "ovuNodeId",
          o.id AS "ovuId",
          parent.id AS "contextId",
          parent.entity_type AS "entityType",
          1::int AS depth,
          ARRAY[node.id, parent.id] AS path
        FROM app_m01_rvp_graph_node node
        JOIN app_m01_rvp_ovu o ON node.source_id = o.id
        JOIN app_m01_rvp_graph_edge edge ON edge.to_node_id = node.id
          AND edge.edge_type = 'contains'
        JOIN app_m01_rvp_graph_node parent ON parent.id = edge.from_node_id
        WHERE node.rvp_version_id = ${selectedSvp.basedOnRvpVersionId}
          AND node.entity_type = 'ovu'

        UNION ALL

        SELECT
          ancestors."ovuNodeId",
          ancestors."ovuId",
          parent.id AS "contextId",
          parent.entity_type AS "entityType",
          ancestors.depth + 1 AS depth,
          ancestors.path || parent.id
        FROM ancestors
        JOIN app_m01_rvp_graph_edge edge ON edge.to_node_id = ancestors."contextId"
          AND edge.edge_type = 'contains'
        JOIN app_m01_rvp_graph_node parent ON parent.id = edge.from_node_id
        WHERE ancestors.depth < 10
          AND NOT parent.id = ANY(ancestors.path)
      ),
      contexts AS (
        SELECT DISTINCT "contextId", "ovuId"
        FROM ancestors
        WHERE "entityType" IN (
          'vzdelavaciOblasti', 'vzdelavaciObory', 'tematickeOkruhy', 'uzlovyBod',
          'klicoveKompetence', 'slozkyKlicoveKompetence',
          'zakladniGramotnosti', 'slozkyZakladniGramotnosti',
          'prurezovaTemata'
        )
      ),
      base AS (
        SELECT
          context."contextId" AS "areaId",
          o.id,
          o.kod,
          o.zneni,
          count(DISTINCT linked_l.id)::int AS "linkedLodickyCount",
          (count(DISTINCT linked_l.id) > 0) AS "isLinked"
        FROM contexts context
        JOIN app_m01_rvp_ovu o ON o.id = context."ovuId"
        LEFT JOIN app_m01_lodicka_ovu_link link ON link.rvp_ovu_id = o.id
        LEFT JOIN app_m01_lodicka linked_l ON linked_l.id = link.lodicka_id
          AND linked_l.svp_version_id = ${selectedSvp.id}
          AND linked_l.is_deleted = false
        GROUP BY context."contextId", o.id
      ),
      ranked AS (
        SELECT
          *,
          row_number() OVER (
            PARTITION BY "areaId", "isLinked"
            ORDER BY "linkedLodickyCount" DESC, kod ASC
          ) AS rn
        FROM base
      )
      SELECT
        "areaId",
        id,
        kod,
        zneni,
        "linkedLodickyCount",
        "isLinked"
      FROM ranked
      WHERE rn <= 12
      ORDER BY "areaId" ASC, "isLinked" DESC, "linkedLodickyCount" DESC, kod ASC
    `),
  ]);

  const graphNodeIds = [...new Set(linkRows.map((row) => row.graphNodeId).filter((id): id is string => Boolean(id)))];
  const neighborRows = graphNodeIds.length > 0
    ? await prisma.$queryRaw<NeighborRow[]>(Prisma.sql`
        SELECT * FROM (
          SELECT
            node.id AS "graphNodeId",
            'vertical'::text AS "neighborKind",
            parent_edge.edge_type AS "edgeType",
            parent.code,
            parent.title,
            parent.body_text AS "bodyText"
          FROM app_m01_rvp_graph_node node
          JOIN app_m01_rvp_graph_edge parent_edge ON parent_edge.to_node_id = node.id
            AND parent_edge.edge_type = 'contains'
          JOIN app_m01_rvp_graph_node parent ON parent.id = parent_edge.from_node_id
          WHERE node.id IN (${Prisma.join(graphNodeIds)})

          UNION ALL

          SELECT
            node.id AS "graphNodeId",
            'method'::text AS "neighborKind",
            method_edge.edge_type AS "edgeType",
            method_node.code,
            method_node.title,
            method_node.body_text AS "bodyText"
          FROM app_m01_rvp_graph_node node
          JOIN app_m01_rvp_graph_edge method_edge ON method_edge.from_node_id = node.id
            AND method_edge.edge_type = 'has_method_level'
          JOIN app_m01_rvp_graph_node method_node ON method_node.id = method_edge.to_node_id
          WHERE node.id IN (${Prisma.join(graphNodeIds)})

          UNION ALL

          SELECT
            node.id AS "graphNodeId",
            'horizontal'::text AS "neighborKind",
            horizontal_edge.edge_type AS "edgeType",
            horizontal_node.code,
            horizontal_node.title,
            horizontal_node.body_text AS "bodyText"
          FROM app_m01_rvp_graph_node node
          JOIN app_m01_rvp_graph_edge horizontal_edge ON horizontal_edge.from_node_id = node.id
            AND horizontal_edge.edge_type IN ('ovu_related', 'ovu_precedes', 'ovu_follows')
          JOIN app_m01_rvp_graph_node horizontal_node ON horizontal_node.id = horizontal_edge.to_node_id
          WHERE node.id IN (${Prisma.join(graphNodeIds)})
        ) neighbors
        ORDER BY "graphNodeId", "neighborKind", "edgeType", code NULLS LAST, title NULLS LAST
      `)
    : [];
  const neighborsByGraphNodeId = groupNeighbors(neighborRows);
  const verticalPathRows = graphNodeIds.length > 0
    ? await prisma.$queryRaw<ContextPathRow[]>(Prisma.sql`
        WITH RECURSIVE ancestors AS (
          SELECT
            node.id AS "graphNodeId",
            node.id,
            node.entity_type AS "entityType",
            node.code,
            node.title,
            node.body_text AS "bodyText",
            0::int AS "depthFromOvu",
            ARRAY[node.id] AS path
          FROM app_m01_rvp_graph_node node
          WHERE node.id IN (${Prisma.join(graphNodeIds)})

          UNION ALL

          SELECT
            ancestors."graphNodeId",
            parent.id,
            parent.entity_type AS "entityType",
            parent.code,
            parent.title,
            parent.body_text AS "bodyText",
            ancestors."depthFromOvu" + 1 AS "depthFromOvu",
            ancestors.path || parent.id
          FROM ancestors
          JOIN app_m01_rvp_graph_edge edge ON edge.to_node_id = ancestors.id
            AND edge.edge_type = 'contains'
          JOIN app_m01_rvp_graph_node parent ON parent.id = edge.from_node_id
          WHERE ancestors."depthFromOvu" < 10
            AND NOT parent.id = ANY(ancestors.path)
        )
        SELECT
          "graphNodeId",
          id,
          "entityType",
          code,
          title,
          "bodyText",
          "depthFromOvu"
        FROM ancestors
        ORDER BY "graphNodeId", "depthFromOvu" DESC, title NULLS LAST
      `)
    : [];
  const verticalPathsByGraphNodeId = groupVerticalPaths(verticalPathRows);
  const coverageSamplesByArea = new Map<string, { linked: RvpGraphCoverageOvu[]; unlinked: RvpGraphCoverageOvu[] }>();
  for (const row of coverageOvuRows) {
    const group = coverageSamplesByArea.get(row.areaId) ?? { linked: [], unlinked: [] };
    const sample = {
      id: row.id,
      kod: row.kod,
      zneni: row.zneni,
      linkedLodickyCount: row.linkedLodickyCount,
    };
    if (row.isLinked) group.linked.push(sample);
    else group.unlinked.push(sample);
    coverageSamplesByArea.set(row.areaId, group);
  }
  const coverageAreasWithSamples = coverageAreas.map((area) => {
    const samples = coverageSamplesByArea.get(area.id);
    return {
      ...area,
      linkedOvuSamples: samples?.linked ?? [],
      unlinkedOvuSamples: samples?.unlinked ?? [],
    };
  });

  return {
    svpOptions,
    selectedSvp,
    counts: countsRows[0] ?? { graphNodes: 0, graphEdges: 0, ovuNodes: 0, confirmedLinks: 0, linkedLodicky: 0 },
    lodicky: groupLodicky(linkRows, neighborsByGraphNodeId, verticalPathsByGraphNodeId).slice(0, limit),
    ovuRows,
    edgeTypeCounts,
    coverageAreas: coverageAreasWithSamples,
  };
}
