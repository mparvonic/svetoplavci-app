"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Info, MapIcon, MousePointer2, Network, Sparkles } from "lucide-react";
import type { NodeObject } from "react-force-graph-2d";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  RvpGraphCoverageArea,
  RvpGraphCoverageOvu,
  RvpGraphOverview,
  RvpGraphLodickaLink,
  RvpGraphOvuLink,
} from "@/src/lib/m01/rvp-graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type VazbyWorkspaceProps = {
  page: RvpGraphOverview;
};

type GraphMode = "focus" | "whole";

type SemanticCandidate = {
  pointId: string;
  score: number;
  sourceCode: string | null;
  title: string;
  text: string;
  alreadyConfirmed: boolean;
  grades: number[];
  stage: string | null;
  contextTitle: string | null;
};

type SemanticSearchResult = {
  embedding: {
    provider: string;
    model: string;
    dimensions: number;
    semantic: boolean;
  };
  lodicka: {
    id: string;
    code: string | null;
    title: string;
    confirmedOvuCodes: string[];
  };
  candidates: SemanticCandidate[];
};

type NetworkNode = NodeObject<{
  id: string;
  label: string;
  detail: string;
  kind: "lodicka" | "ovu" | "context" | "semantic" | "related-lodicka";
  color: string;
  val: number;
  showLabel?: boolean;
  lodickaId?: string;
  ovuId?: string;
}>;

type NetworkLink = {
  source: string;
  target: string;
  kind: "confirmed" | "context" | "semantic" | "shared";
  label: string;
};

type NetworkData = {
  nodes: NetworkNode[];
  links: NetworkLink[];
};

function shortText(value: string | null, limit = 160) {
  if (!value) return "bez popisu";
  return value.length > limit ? `${value.slice(0, limit).trim()}...` : value;
}

function trimLabel(value: string | null, limit = 34) {
  if (!value) return "bez názvu";
  return value.length > limit ? `${value.slice(0, limit).trim()}...` : value;
}

function entityTypeLabel(value: string | null) {
  const labels: Record<string, string> = {
    obecnaCast: "obecná část",
    obecneCasti: "obecná část",
    zakladniGramotnost: "gramotnost",
    zakladniGramotnosti: "gramotnost",
    slozkyZakladniGramotnosti: "složka gramotnosti",
    klicovaKompetence: "kompetence",
    klicoveKompetence: "kompetence",
    slozkyKlicoveKompetence: "složka kompetence",
    prurezoveTema: "průřezové téma",
    prurezovaTemata: "průřezové téma",
    vzdelavaciOblast: "oblast RVP",
    vzdelavaciOblasti: "oblast RVP",
    vzdelavaciObor: "obor RVP",
    vzdelavaciObory: "obor RVP",
    tematickeOkruhy: "tematický okruh",
    ocekavanyVystup: "očekávaný výstup",
    ovu: "OVU",
    uzlovyBod: "uzlový bod",
    metodickaUroven: "metodická podpora",
  };
  return value ? (labels[value] ?? value) : "RVP kontext";
}

function coverageLevelLabel(value: string) {
  const labels: Record<string, string> = {
    all: "Vše",
    axis: "Oblasti a osy",
    branch: "Obory a složky",
    topic: "Tematické okruhy",
    node: "Uzlové body",
    context: "Kontext",
  };
  return labels[value] ?? value;
}

function coverageLevelOrder(value: string) {
  const order: Record<string, number> = { axis: 0, branch: 1, topic: 2, node: 3, context: 4 };
  return order[value] ?? 99;
}

function contextNodeLabel(node: { code: string | null; title: string | null; entityType: string }) {
  return [node.code, node.title].filter(Boolean).join(" · ") || entityTypeLabel(node.entityType);
}

function verticalPathSummary(ovu: RvpGraphOvuLink) {
  const nodes = ovu.verticalPaths[0]?.nodes.filter((node) => node.entityType !== "ovu") ?? [];
  if (nodes.length === 0) return ovu.contextTitle ?? ovu.uzlovyBod ?? "bez RVP cesty";
  return nodes.map(contextNodeLabel).join(" > ");
}

function edgeLabel(value: string) {
  const labels: Record<string, string> = {
    contains: "nadřazený kontext",
    has_method_level: "metodická podpora",
    ovu_related: "související OVU",
    ovu_precedes: "předchází",
    ovu_follows: "navazuje",
  };
  return labels[value] ?? value;
}

function initialLodickaId(lodicky: RvpGraphLodickaLink[]) {
  return lodicky.find((lodicka) => lodicka.confirmedOvu.length > 0)?.id ?? lodicky[0]?.id ?? "";
}

function initialCoverageId(areas: RvpGraphCoverageArea[]) {
  return areas.find((area) => area.coverageLevel === "axis")?.id ?? areas[0]?.id ?? "";
}

function addLodickaNode(nodeMap: Map<string, NetworkNode>, lodicka: RvpGraphLodickaLink, options: { selected?: boolean; related?: boolean; showLabel?: boolean }) {
  const id = `lodicka:${lodicka.id}`;
  if (nodeMap.has(id)) return;
  nodeMap.set(id, {
    id,
    label: lodicka.kod,
    detail: lodicka.nazev,
    kind: options.related ? "related-lodicka" : "lodicka",
    color: options.selected ? "#C8372D" : options.related ? "#DDE7F7" : "#0E2A5C",
    val: options.selected ? 12 : options.related ? 5 : 6,
    showLabel: options.showLabel ?? options.selected,
    lodickaId: lodicka.id,
  });
}

function addOvuNode(nodeMap: Map<string, NetworkNode>, ovu: RvpGraphOvuLink, options: { selected?: boolean; showLabel?: boolean }) {
  const id = `ovu:${ovu.id}`;
  const existing = nodeMap.get(id);
  if (existing) {
    existing.val = Math.max(existing.val ?? 4, options.selected ? 8 : 4);
    existing.showLabel = existing.showLabel || options.showLabel;
    if (options.selected) existing.color = "#FFFFFF";
    return;
  }
  nodeMap.set(id, {
    id,
    label: ovu.kod,
    detail: ovu.zneni,
    kind: "ovu",
    color: "#FFFFFF",
    val: options.selected ? 8 : 4,
    showLabel: options.showLabel ?? options.selected,
    ovuId: ovu.id,
  });
}

function buildNetworkData(page: RvpGraphOverview, selectedLodickaId: string, mode: GraphMode): NetworkData {
  const nodeMap = new Map<string, NetworkNode>();
  const links: NetworkLink[] = [];
  const selected = page.lodicky.find((lodicka) => lodicka.id === selectedLodickaId) ?? null;
  const selectedOvuIds = new Set(selected?.confirmedOvu.map((ovu) => ovu.id) ?? []);

  if (mode === "focus" && selected) {
    addLodickaNode(nodeMap, selected, { selected: true, showLabel: true });
    for (const ovu of selected.confirmedOvu) {
      const sourceId = `lodicka:${selected.id}`;
      const ovuId = `ovu:${ovu.id}`;
      addOvuNode(nodeMap, ovu, { selected: true, showLabel: true });
      links.push({ source: sourceId, target: ovuId, kind: "confirmed", label: "potvrzená vazba" });

      const pathNodes = ovu.verticalPaths[0]?.nodes.filter((node) => node.entityType !== "ovu") ?? [];
      let previousContextTarget = ovuId;
      if (pathNodes.length === 0) {
        const ctxId = `context:fallback:${ovu.contextType ?? "context"}:${ovu.contextTitle ?? ovu.uzlovyBod ?? ovu.id}`;
        if (!nodeMap.has(ctxId)) {
          nodeMap.set(ctxId, {
            id: ctxId,
            label: entityTypeLabel(ovu.contextType),
            detail: ovu.contextTitle ?? ovu.uzlovyBod ?? "bez kontextu",
            kind: "context",
            color: "#EEF2F7",
            val: 6,
            showLabel: true,
          });
        }
        links.push({ source: ovuId, target: ctxId, kind: "context", label: "RVP kontext" });
      } else {
        for (const context of [...pathNodes].reverse()) {
          const ctxId = `context:${context.id}`;
          if (!nodeMap.has(ctxId)) {
            nodeMap.set(ctxId, {
              id: ctxId,
              label: context.code ?? entityTypeLabel(context.entityType),
              detail: context.title ?? context.bodyText ?? entityTypeLabel(context.entityType),
              kind: "context",
              color: context.entityType === "uzlovyBod" ? "#E8EEF8" : "#EEF2F7",
              val: context.entityType === "uzlovyBod" ? 5.5 : 4.5,
              showLabel: context.entityType !== "uzlovyBod",
            });
          }
          links.push({ source: previousContextTarget, target: ctxId, kind: "context", label: entityTypeLabel(context.entityType) });
          previousContextTarget = ctxId;
        }
      }

      for (const neighbor of ovu.horizontalNeighbors.slice(0, 6)) {
        const targetId = `semantic:${neighbor.edgeType}:${neighbor.code ?? neighbor.title ?? sourceId}`;
        if (!nodeMap.has(targetId)) {
          nodeMap.set(targetId, {
            id: targetId,
            label: neighbor.code ?? edgeLabel(neighbor.edgeType),
            detail: neighbor.title ?? neighbor.bodyText ?? "související OVU",
            kind: "semantic",
            color: "#FFF7ED",
            val: 4.5,
            showLabel: true,
          });
        }
        links.push({ source: ovuId, target: targetId, kind: "semantic", label: edgeLabel(neighbor.edgeType) });
      }
    }

    let relatedCount = 0;
    for (const lodicka of page.lodicky) {
      if (lodicka.id === selected.id) continue;
      const sharedOvu = lodicka.confirmedOvu.find((ovu) => selectedOvuIds.has(ovu.id));
      if (!sharedOvu || relatedCount >= 32) continue;
      relatedCount += 1;
      addLodickaNode(nodeMap, lodicka, { related: true, showLabel: relatedCount <= 10 });
      addOvuNode(nodeMap, sharedOvu, { selected: true, showLabel: true });
      links.push({ source: `lodicka:${lodicka.id}`, target: `ovu:${sharedOvu.id}`, kind: "shared", label: "sdílí potvrzené OVU" });
    }

    return { nodes: [...nodeMap.values()], links };
  }

  for (const lodicka of page.lodicky) {
    const isSelected = lodicka.id === selectedLodickaId;
    addLodickaNode(nodeMap, lodicka, { selected: isSelected, showLabel: isSelected });
    for (const ovu of lodicka.confirmedOvu) {
      const isSelectedOvu = selectedOvuIds.has(ovu.id);
      addOvuNode(nodeMap, ovu, { selected: isSelectedOvu, showLabel: isSelectedOvu });
      links.push({ source: `lodicka:${lodicka.id}`, target: `ovu:${ovu.id}`, kind: "confirmed", label: "potvrzená vazba" });
    }
  }

  return { nodes: [...nodeMap.values()], links };
}

function drawNode(rawNode: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) {
  const node = rawNode as NetworkNode;
  const radius = Math.max(4, (node.val ?? 4) * 1.25);
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const isOvu = node.kind === "ovu";
  const shouldLabel = Boolean(node.showLabel) || globalScale > 1.8;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
  ctx.fillStyle = node.color;
  ctx.fill();
  ctx.lineWidth = node.kind === "lodicka" ? 2.5 : 1.8;
  ctx.strokeStyle = node.kind === "lodicka" ? "#0E2A5C" : node.kind === "semantic" ? "#D97706" : "#7F88A0";
  ctx.stroke();

  if (!shouldLabel) return;
  const label = trimLabel(node.label, 24);
  const fontSize = Math.max(8, 12 / globalScale);
  ctx.font = `${node.kind === "lodicka" ? 700 : 600} ${fontSize}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isOvu || node.kind === "lodicka" ? "#0E2A5C" : "#4A5A7C";
  ctx.fillText(label, x + radius + 4, y);
}

function GraphModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? "rounded-[8px] border border-[#0E2A5C] bg-[#0E2A5C] px-3 py-1.5 text-xs font-semibold text-white"
        : "rounded-[8px] border border-[#D6DFF0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0E2A5C] transition hover:border-[#0E2A5C]"}
    >
      {children}
    </button>
  );
}

function FullSetGraph({
  page,
  selectedLodickaId,
  mode,
  onModeChange,
  onSelectLodicka,
}: {
  page: RvpGraphOverview;
  selectedLodickaId: string;
  mode: GraphMode;
  onModeChange: (mode: GraphMode) => void;
  onSelectLodicka: (lodickaId: string) => void;
}) {
  const graphData = useMemo(() => buildNetworkData(page, selectedLodickaId, mode), [page, selectedLodickaId, mode]);
  const handleNodeClick = useCallback((node: NetworkNode) => {
    if ((node.kind === "lodicka" || node.kind === "related-lodicka") && node.lodickaId) onSelectLodicka(node.lodickaId);
  }, [onSelectLodicka]);

  return (
    <div className="overflow-hidden rounded-[8px] border border-[#D6DFF0] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D6DFF0] bg-[#F7F9FC] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[#0E2A5C]">Interaktivní síť vazeb</p>
          <p className="text-xs text-[#4A5A7C]">
            Vzniká z tvrdých vazeb `M01LodickaOvuLink` a z RVP grafové projekce. Nejde o AI výpočet, semantické návrhy přijdou až v další vrstvě.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GraphModeButton active={mode === "focus"} onClick={() => onModeChange("focus")}>Okolí lodičky</GraphModeButton>
          <GraphModeButton active={mode === "whole"} onClick={() => onModeChange("whole")}>Celá sada</GraphModeButton>
        </div>
      </div>
      <div className="grid gap-3 border-b border-[#D6DFF0] bg-white px-4 py-3 text-xs text-[#4A5A7C] md:grid-cols-3">
        <div className="flex gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-[#0E2A5C]" aria-hidden={true} />
          <p><span className="font-semibold text-[#0E2A5C]">Červená hrana</span> je potvrzená vazba lodička - OVU nastavená správcem.</p>
        </div>
        <div className="flex gap-2">
          <Network className="mt-0.5 size-4 shrink-0 text-[#0E2A5C]" aria-hidden={true} />
          <p><span className="font-semibold text-[#0E2A5C]">Okolí</span> ukazuje nadřazený RVP kontext, související OVU a lodičky sdílející stejné OVU.</p>
        </div>
        <div className="flex gap-2">
          <MapIcon className="mt-0.5 size-4 shrink-0 text-[#0E2A5C]" aria-hidden={true} />
          <p><span className="font-semibold text-[#0E2A5C]">Hvězdice</span> typicky znamená, že hodně lodiček míří do stejného OVU nebo kontextu, ne chybu výpočtu.</p>
        </div>
      </div>
      <div className="h-[38rem] w-full">
        <ForceGraph2D
          graphData={graphData}
          nodeId="id"
          nodeLabel={(node) => `${(node as NetworkNode).label}: ${(node as NetworkNode).detail}`}
          nodeVal="val"
          nodeCanvasObject={drawNode}
          linkColor={(link) => {
            const kind = (link as NetworkLink).kind;
            if (kind === "confirmed") return "rgba(200,55,45,0.58)";
            if (kind === "semantic") return "rgba(217,119,6,0.5)";
            if (kind === "shared") return "rgba(14,42,92,0.28)";
            return "rgba(127,136,160,0.4)";
          }}
          linkWidth={(link) => ((link as NetworkLink).kind === "confirmed" ? 1.8 : 1)}
          linkLineDash={(link) => ((link as NetworkLink).kind === "semantic" || (link as NetworkLink).kind === "shared" ? [4, 4] : null)}
          linkDirectionalParticles={(link) => ((link as NetworkLink).kind === "confirmed" ? 1 : 0)}
          linkDirectionalParticleWidth={1.6}
          backgroundColor="#F7F9FC"
          cooldownTicks={120}
          enableNodeDrag={true}
          onNodeClick={(node) => handleNodeClick(node as NetworkNode)}
        />
      </div>
    </div>
  );
}

function OvuCard({ ovu, active, onClick }: { ovu: RvpGraphOvuLink; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? "w-full rounded-[8px] border border-[#C8372D] bg-[#FAEAE9] p-3 text-left"
        : "w-full rounded-[8px] border border-[#D6DFF0] bg-white p-3 text-left transition hover:border-[#C8372D] hover:bg-[#FAEAE9]/60"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{ovu.kod}</Badge>
        <span className="text-xs font-semibold text-[#4A5A7C]">{ovu.uzlovyBod ?? "bez uzlového bodu"}</span>
      </div>
      <p className="mt-2 text-sm text-[#0E2A5C]">{ovu.zneni}</p>
      <p className="mt-2 text-xs text-[#4A5A7C]">
        RVP cesta: <span className="font-semibold text-[#0E2A5C]">{trimLabel(verticalPathSummary(ovu), 120)}</span>
      </p>
    </button>
  );
}

function NeighborList({ title, items, empty }: { title: string; items: RvpGraphOvuLink["verticalNeighbors"]; empty: string }) {
  return (
    <div className="rounded-[8px] border border-[#D6DFF0] bg-white p-3">
      <p className="text-sm font-semibold text-[#0E2A5C]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-[#4A5A7C]">{empty}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.slice(0, 8).map((item, index) => (
            <div key={`${item.edgeType}-${item.code ?? item.title ?? index}`} className="rounded-[8px] bg-[#F7F9FC] p-2">
              <p className="text-xs font-semibold text-[#4A5A7C]">{edgeLabel(item.edgeType)} {item.code ? `· ${item.code}` : ""}</p>
              <p className="mt-1 text-sm text-[#0E2A5C]">{shortText(item.title ?? item.bodyText, 140)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VerticalPathList({ ovu }: { ovu: RvpGraphOvuLink }) {
  const paths = ovu.verticalPaths.length > 0 ? ovu.verticalPaths : [];
  return (
    <div className="rounded-[8px] border border-[#D6DFF0] bg-white p-3">
      <p className="text-sm font-semibold text-[#0E2A5C]">Vertikální RVP cesta</p>
      {paths.length === 0 ? (
        <p className="mt-2 text-xs text-[#4A5A7C]">Pro tohle OVU se nenačetla úplná RVP cesta.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {paths.map((path, pathIndex) => (
            <div key={`${ovu.id}-${path.label}-${pathIndex}`} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-[#4A5A7C]">{path.label}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {path.nodes.filter((node) => node.entityType !== "ovu").map((node, index, nodes) => (
                  <div key={node.id} className="flex items-center gap-1.5">
                    <span className="rounded-[8px] border border-[#D6DFF0] bg-[#F7F9FC] px-2 py-1 text-xs font-semibold text-[#0E2A5C]">
                      <span className="text-[#4A5A7C]">{entityTypeLabel(node.entityType)}:</span> {trimLabel(contextNodeLabel(node), 52)}
                    </span>
                    {index < nodes.length - 1 ? <span className="text-xs text-[#7F88A0]">&gt;</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function coverageTone(area: RvpGraphCoverageArea) {
  if (area.coveragePercent >= 75) return "bg-[#DFF3E8] text-[#14532D] border-[#9CD7B5]";
  if (area.coveragePercent >= 35) return "bg-[#FFF7ED] text-[#9A3412] border-[#FED7AA]";
  return "bg-[#FAEAE9] text-[#7F1D1D] border-[#F0B6B3]";
}

function CoverageOvuList({ title, items, empty }: { title: string; items: RvpGraphCoverageOvu[]; empty: string }) {
  return (
    <div className="rounded-[8px] border border-[#D6DFF0] bg-white p-3">
      <p className="text-sm font-semibold text-[#0E2A5C]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-[#4A5A7C]">{empty}</p>
      ) : (
        <div className="mt-2 max-h-72 space-y-2 overflow-auto pr-1">
          {items.map((ovu) => (
            <div key={ovu.id} className="rounded-[8px] bg-[#F7F9FC] p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-xs font-semibold text-[#0E2A5C]">{ovu.kod}</p>
                <Badge variant={ovu.linkedLodickyCount > 0 ? "secondary" : "outline"}>{ovu.linkedLodickyCount} lodiček</Badge>
              </div>
              <p className="mt-1 text-xs text-[#4A5A7C]">{shortText(ovu.zneni, 180)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SemanticCandidateList({ lodickaId }: { lodickaId: string }) {
  const [result, setResult] = useState<SemanticSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCandidates() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/m01/rvp/semantic?lodickaId=${encodeURIComponent(lodickaId)}&limit=10`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error ?? "Semantické kandidáty se nepodařilo načíst.");
        setResult(payload as SemanticSearchResult);
      } catch (nextError) {
        if (controller.signal.aborted) return;
        setError(nextError instanceof Error ? nextError.message : "Semantické kandidáty se nepodařilo načíst.");
        setResult(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadCandidates();
    return () => controller.abort();
  }, [lodickaId]);

  const candidates = result?.candidates ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Semantické okolí</CardTitle>
        <CardDescription>Obsahové souvislosti z Qdrant indexu. Teď běží baseline embedding, takže výsledek ber jako ověření pipeline.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-[8px] border border-dashed border-[#D97706] bg-[#FFF7ED] p-4 text-[#7C2D12]">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4" aria-hidden={true} />
            Kandidáti bez tvrdé vazby
          </div>
          <p className="mt-2 text-sm">
            Výpis porovnává knowledge text vybrané lodičky proti bodům `rvp_ovu` ve vektorové kolekci. Potvrzené vazby zůstávají oddělené v `M01LodickaOvuLink`.
          </p>
          {result ? (
            <p className="mt-2 text-xs font-semibold">
              {result.embedding.provider}/{result.embedding.model} · {result.embedding.dimensions} dim · {result.embedding.semantic ? "sémantický model" : "lokální baseline"}
            </p>
          ) : null}
        </div>

        {isLoading ? <div className="sv-placeholder">Načítám kandidáty z vektorového indexu...</div> : null}
        {error ? <div className="rounded-[8px] border border-[#F0B6B3] bg-[#FAEAE9] p-3 text-sm text-[#7F1D1D]">{error}</div> : null}
        {!isLoading && !error && candidates.length === 0 ? <div className="sv-placeholder">Pro vybranou lodičku zatím nejsou kandidáti.</div> : null}

        <div className="space-y-2">
          {candidates.map((candidate) => (
            <div key={candidate.pointId} className={candidate.alreadyConfirmed
              ? "rounded-[8px] border border-[#D6DFF0] bg-[#F7F9FC] p-3"
              : "rounded-[8px] border border-[#FED7AA] bg-white p-3"}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={candidate.alreadyConfirmed ? "secondary" : "outline"}>{candidate.sourceCode ?? "OVU"}</Badge>
                    {candidate.alreadyConfirmed ? <Badge variant="secondary">už potvrzeno</Badge> : <Badge variant="outline">kandidát</Badge>}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#0E2A5C]">{trimLabel(candidate.title, 120)}</p>
                </div>
                <span className="rounded-[8px] bg-[#FFF7ED] px-2 py-1 text-xs font-semibold text-[#9A3412]">
                  score {candidate.score.toFixed(3)}
                </span>
              </div>
              <p className="mt-2 text-xs text-[#4A5A7C]">{shortText(candidate.text, 240)}</p>
              <p className="mt-2 text-xs text-[#4A5A7C]">
                Kontext: <span className="font-semibold text-[#0E2A5C]">{candidate.contextTitle ?? "bez uzlového bodu"}</span>
                {candidate.grades.length > 0 ? ` · ${candidate.grades.join("/")}. ročník` : ""}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageHeatmap({ areas }: { areas: RvpGraphCoverageArea[] }) {
  const [selectedAreaId, setSelectedAreaId] = useState(() => initialCoverageId(areas));
  const [selectedLevel, setSelectedLevel] = useState("axis");
  const levels = useMemo(() => {
    const known = [...new Set(areas.map((area) => area.coverageLevel))].sort((a, b) => coverageLevelOrder(a) - coverageLevelOrder(b));
    return ["all", ...known];
  }, [areas]);
  const filteredAreas = selectedLevel === "all" ? areas : areas.filter((area) => area.coverageLevel === selectedLevel);
  const selectedArea = filteredAreas.find((area) => area.id === selectedAreaId) ?? filteredAreas[0] ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Heatmap pokrytí RVP</CardTitle>
            <CardDescription>Rozpad podle RVP vrstev. Klik na blok ukáže konkrétní pokrytá i nepokrytá OVU.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {levels.map((level) => (
              <GraphModeButton key={level} active={selectedLevel === level} onClick={() => setSelectedLevel(level)}>
                {coverageLevelLabel(level)}
              </GraphModeButton>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
        <div className="grid content-start gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAreas.slice(0, 48).map((area) => {
            const active = selectedArea?.id === area.id;
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => setSelectedAreaId(area.id)}
                className={`rounded-[8px] border p-3 text-left transition ${coverageTone(area)} ${active ? "ring-2 ring-[#0E2A5C]" : "hover:ring-1 hover:ring-[#0E2A5C]/50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-normal">{entityTypeLabel(area.entityType)}</p>
                  <span className="text-sm font-bold">{area.coveragePercent}%</span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-snug">{trimLabel(area.title, 58)}</p>
                <p className="mt-2 text-xs">{area.linkedOvu}/{area.totalOvu} OVU · {area.linkCount} vazeb</p>
              </button>
            );
          })}
          {filteredAreas.length === 0 ? <div className="sv-placeholder sm:col-span-2 xl:col-span-3">Pro tuhle vrstvu zatím nejsou data.</div> : null}
        </div>

        {selectedArea ? (
          <div className="space-y-3 rounded-[8px] border border-[#D6DFF0] bg-[#F7F9FC] p-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-[#4A5A7C]">{coverageLevelLabel(selectedArea.coverageLevel)} · {entityTypeLabel(selectedArea.entityType)}</p>
              <h3 className="mt-1 text-lg font-semibold text-[#0E2A5C]">{selectedArea.title}</h3>
              <p className="mt-1 text-sm text-[#4A5A7C]">
                Pokryto {selectedArea.linkedOvu} z {selectedArea.totalOvu} OVU. Nepokryto {Math.max(selectedArea.totalOvu - selectedArea.linkedOvu, 0)} OVU.
              </p>
            </div>
            <CoverageOvuList title="Pokrytá OVU" items={selectedArea.linkedOvuSamples} empty="Tahle oblast zatím nemá pokryté OVU." />
            <CoverageOvuList title="Mezery v pokrytí" items={selectedArea.unlinkedOvuSamples} empty="V ukázce nejsou nepokrytá OVU." />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function VazbyWorkspace({ page }: VazbyWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(() => initialLodickaId(page.lodicky));
  const [selectedOvuId, setSelectedOvuId] = useState("");
  const [graphMode, setGraphMode] = useState<GraphMode>("focus");
  const selectedLodicka = page.lodicky.find((lodicka) => lodicka.id === selectedId) ?? page.lodicky[0] ?? null;
  const selectedOvu = selectedLodicka?.confirmedOvu.find((ovu) => ovu.id === selectedOvuId) ?? selectedLodicka?.confirmedOvu[0] ?? null;
  const coveragePercent = page.selectedSvp?.lodickyCount
    ? Math.round((page.counts.linkedLodicky / page.selectedSvp.lodickyCount) * 100)
    : 0;

  const handleSelectLodicka = (lodickaId: string) => {
    setSelectedId(lodickaId);
    setSelectedOvuId("");
    setGraphMode("focus");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Celá sada jako RVP síť</CardTitle>
              <CardDescription>Potvrzené vazby, RVP okolí, pokrytí oblastí a připravený prostor pro semantické návrhy.</CardDescription>
            </div>
            <Badge variant="outline">
              <CheckCircle2 className="size-3" aria-hidden={true} />
              {page.counts.confirmedLinks} potvrzených vazeb
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-[8px] border border-[#D6DFF0] bg-[#F7F9FC] p-3">
              <p className="text-xs font-semibold text-[#4A5A7C]">Pokrytí lodiček</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full bg-[#C8372D]" style={{ width: `${Math.min(coveragePercent, 100)}%` }} />
              </div>
              <p className="mt-2 text-sm font-semibold text-[#0E2A5C]">{coveragePercent}% má OVU</p>
            </div>
            <div className="rounded-[8px] border border-[#D6DFF0] bg-white p-3">
              <p className="text-xs font-semibold text-[#4A5A7C]">Zobrazené lodičky</p>
              <p className="mt-1 text-2xl font-semibold text-[#0E2A5C]">{page.lodicky.length}</p>
            </div>
            <div className="rounded-[8px] border border-[#D6DFF0] bg-white p-3">
              <p className="text-xs font-semibold text-[#4A5A7C]">RVP uzly celkem</p>
              <p className="mt-1 text-2xl font-semibold text-[#0E2A5C]">{page.counts.graphNodes}</p>
            </div>
            <div className="rounded-[8px] border border-dashed border-[#D97706] bg-[#FFF7ED] p-3">
              <p className="text-xs font-semibold text-[#9A3412]">Semantická vrstva</p>
              <p className="mt-1 text-sm font-semibold text-[#7C2D12]">připravená pro embeddingy</p>
            </div>
          </div>

          <FullSetGraph
            page={page}
            selectedLodickaId={selectedLodicka?.id ?? ""}
            mode={graphMode}
            onModeChange={setGraphMode}
            onSelectLodicka={handleSelectLodicka}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Lodičky v síti</CardTitle>
            <CardDescription>Klikni tady nebo přímo na uzel v grafu.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[34rem] space-y-2 overflow-auto pr-1">
            {page.lodicky.map((lodicka) => {
              const active = selectedLodicka?.id === lodicka.id;
              return (
                <button
                  key={lodicka.id}
                  type="button"
                  onClick={() => handleSelectLodicka(lodicka.id)}
                  className={active
                    ? "w-full rounded-[8px] border border-[#C8372D] bg-[#FAEAE9] p-3 text-left"
                    : "w-full rounded-[8px] border border-[#D6DFF0] bg-white p-3 text-left transition hover:border-[#C8372D] hover:bg-[#FAEAE9]/60"}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#0E2A5C]">{lodicka.nazev}</p>
                      <p className="mt-1 text-xs text-[#4A5A7C]">{lodicka.kod} · {lodicka.predmet}</p>
                    </div>
                    <Badge variant={lodicka.confirmedOvu.length > 0 ? "secondary" : "outline"}>{lodicka.confirmedOvu.length} OVU</Badge>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Potvrzená vazba lodička - OVU</CardTitle>
            <CardDescription>Tvrdé vazby nastavené správcem. Tohle je provozní pravda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedLodicka ? (
              <>
                <div className="rounded-[8px] border border-[#D6DFF0] bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{selectedLodicka.kod}</Badge>
                    <span className="text-xs font-semibold text-[#4A5A7C]">{selectedLodicka.rocnikOd}. až {selectedLodicka.rocnikDo}. ročník</span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-[#0E2A5C]">{selectedLodicka.nazev}</h2>
                  <p className="mt-1 text-sm text-[#4A5A7C]">{selectedLodicka.predmet} · {selectedLodicka.oblast}</p>
                  <p className="mt-3 text-sm text-[#0E2A5C]">{shortText(selectedLodicka.popis, 460)}</p>
                </div>
                {selectedLodicka.confirmedOvu.length === 0 ? (
                  <div className="rounded-[8px] border border-dashed border-[#D6DFF0] bg-white p-4 text-sm text-[#4A5A7C]">Tahle lodička zatím nemá potvrzené OVU.</div>
                ) : (
                  selectedLodicka.confirmedOvu.map((ovu) => (
                    <OvuCard key={ovu.id} ovu={ovu} active={selectedOvu?.id === ovu.id} onClick={() => setSelectedOvuId(ovu.id)} />
                  ))
                )}
              </>
            ) : (
              <div className="sv-placeholder">Pro zadaný filtr nejsou žádné lodičky.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Okolí vybrané vazby</CardTitle>
            <CardDescription>Vertikálně = čistá RVP cesta. Metodická podpora je samostatný kontext. Horizontálně = související, předchozí a navazující OVU.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedOvu ? (
              <>
                <div className="rounded-[8px] border border-[#D6DFF0] bg-[#F7F9FC] p-3">
                  <div className="flex items-center gap-2">
                    <MousePointer2 className="size-4 text-[#C8372D]" aria-hidden={true} />
                    <p className="text-sm font-semibold text-[#0E2A5C]">Vybrané OVU: {selectedOvu.kod}</p>
                  </div>
                  <p className="mt-2 text-xs text-[#4A5A7C]">Kliknutím na OVU v prostředním panelu přepínáš, pro kterou tvrdou vazbu se okolí zobrazuje.</p>
                </div>
                <VerticalPathList ovu={selectedOvu} />
                <NeighborList title="Metodická podpora" items={selectedOvu.methodSupport} empty="Pro tohle OVU není v grafu metodická podpora." />
                <NeighborList title="Horizontální okolí" items={selectedOvu.horizontalNeighbors} empty="Žádné horizontální OVU souvislosti se nenačetly." />
              </>
            ) : (
              <div className="sv-placeholder">Vybraná lodička nemá OVU pro zobrazení okolí.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <CoverageHeatmap areas={page.coverageAreas} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>OVU s největším napojením</CardTitle>
            <CardDescription>Pomocný přehled ukazuje, kam se lodičky v RVP nejvíc sbíhají.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kód</TableHead>
                  <TableHead>Kontext</TableHead>
                  <TableHead>OVU</TableHead>
                  <TableHead>Lodičky</TableHead>
                  <TableHead>Hrany</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.ovuRows.slice(0, 16).map((ovu) => (
                  <TableRow key={ovu.id}>
                    <TableCell className="font-mono text-xs text-[#4A5A7C]">{ovu.kod}</TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      <span className="font-semibold text-[#0E2A5C]">{entityTypeLabel(ovu.parentType)}</span><br />
                      {ovu.parentTitle ?? ovu.uzlovyBod ?? "bez kontextu"}
                    </TableCell>
                    <TableCell className="text-sm text-[#0E2A5C]">{shortText(ovu.zneni, 180)}</TableCell>
                    <TableCell>
                      <Badge variant={ovu.linkedLodickyCount > 0 ? "secondary" : "outline"}>{ovu.linkedLodickyCount}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">{ovu.incomingEdges} / {ovu.outgoingEdges}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedLodicka ? <SemanticCandidateList lodickaId={selectedLodicka.id} /> : null}
      </div>
    </div>
  );
}
