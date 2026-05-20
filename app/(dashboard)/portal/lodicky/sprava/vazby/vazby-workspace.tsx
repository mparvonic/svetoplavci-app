"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, MousePointer2, Sparkles } from "lucide-react";

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

type VazbyWorkspaceProps = {
  page: RvpGraphOverview;
};

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

type LodickaOvuFilter = "all" | "linked" | "unlinked";
type LodickaGroupBy = "oblast" | "predmet" | "rocnik" | "ovu";

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

function lodickaGradeLabel(lodicka: RvpGraphLodickaLink) {
  if (!lodicka.rocnikOd && !lodicka.rocnikDo) return "bez ročníku";
  if (lodicka.rocnikOd === lodicka.rocnikDo) return `${lodicka.rocnikOd}. ročník`;
  return `${lodicka.rocnikOd}. až ${lodicka.rocnikDo}. ročník`;
}

function lodickaGroupLabel(lodicka: RvpGraphLodickaLink, groupBy: LodickaGroupBy) {
  if (groupBy === "oblast") return lodicka.oblast || "Bez oblasti";
  if (groupBy === "predmet") return lodicka.predmet || "Bez předmětu";
  if (groupBy === "rocnik") return lodickaGradeLabel(lodicka);
  return lodicka.confirmedOvu.length > 0 ? "S potvrzeným OVU" : "Bez potvrzeného OVU";
}

function lodickaSearchText(lodicka: RvpGraphLodickaLink) {
  return [
    lodicka.kod,
    lodicka.nazev,
    lodicka.popis,
    lodicka.predmet,
    lodicka.oblast,
    ...lodicka.confirmedOvu.flatMap((ovu) => [ovu.kod, ovu.zneni, ovu.uzlovyBod, ovu.contextTitle]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("cs-CZ");
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

function ExpandableDetail({
  eyebrow,
  title,
  bodyText,
  code,
}: {
  eyebrow: string;
  title: string | null;
  bodyText: string | null;
  code?: string | null;
}) {
  return (
    <details className="group rounded-[8px] border border-[#D6DFF0] bg-[#F7F9FC] p-2 transition open:border-[#C8372D] open:bg-[#FAEAE9]/45">
      <summary className="cursor-pointer list-none">
        <p className="text-xs font-semibold text-[#4A5A7C]">{eyebrow}{code ? ` · ${code}` : ""}</p>
        <p className="mt-1 text-sm font-semibold text-[#0E2A5C]">{shortText(title ?? bodyText, 140)}</p>
        <p className="mt-1 text-xs text-[#C8372D] group-open:hidden">Zobrazit detail</p>
        <p className="mt-1 hidden text-xs text-[#C8372D] group-open:block">Zobrazit detail</p>
      </summary>
      <div className="mt-3 rounded-[8px] border border-[#D6DFF0] bg-white p-3">
        {title && bodyText && title !== bodyText ? <p className="text-sm font-semibold text-[#0E2A5C]">{title}</p> : null}
        <p className="mt-1 text-sm leading-relaxed text-[#4A5A7C]">
          {bodyText ? bodyText : "Pro tenhle uzel zatím není v RVP grafu delší textový detail."}
        </p>
      </div>
    </details>
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
            <ExpandableDetail
              key={`${item.edgeType}-${item.code ?? item.title ?? index}`}
              eyebrow={edgeLabel(item.edgeType)}
              code={item.code}
              title={item.title ?? item.code ?? edgeLabel(item.edgeType)}
              bodyText={item.bodyText}
            />
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
              <div className="space-y-2">
                {path.nodes.filter((node) => node.entityType !== "ovu").map((node, index, nodes) => (
                  <div key={node.id} className="grid gap-1">
                    <ExpandableDetail
                      eyebrow={entityTypeLabel(node.entityType)}
                      code={node.code}
                      title={node.title ?? contextNodeLabel(node)}
                      bodyText={node.bodyText}
                    />
                    {index < nodes.length - 1 ? <span className="pl-3 text-xs text-[#7F88A0]">↓ další úroveň RVP</span> : null}
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
        <div className="mt-2 space-y-2">
          {items.map((ovu) => (
            <details key={ovu.id} className="group rounded-[8px] border border-[#D6DFF0] bg-[#F7F9FC] p-3 transition open:border-[#C8372D] open:bg-white">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-xs font-semibold text-[#0E2A5C]">{ovu.kod}</p>
                  <Badge variant={ovu.linkedLodickyCount > 0 ? "secondary" : "outline"}>{ovu.linkedLodickyCount} lodiček</Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#4A5A7C]">{shortText(ovu.zneni, 220)}</p>
                <p className="mt-2 text-xs font-semibold text-[#C8372D] group-open:hidden">Zobrazit detail</p>
                <p className="mt-2 hidden text-xs font-semibold text-[#C8372D] group-open:block">Zobrazit detail</p>
              </summary>
              <div className="mt-3 rounded-[8px] border border-[#D6DFF0] bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-[#4A5A7C]">Plné znění OVU</p>
                <p className="mt-2 text-sm leading-relaxed text-[#0E2A5C]">{ovu.zneni}</p>
                <p className="mt-3 text-xs text-[#4A5A7C]">
                  Pokrytí: <span className="font-semibold text-[#0E2A5C]">{ovu.linkedLodickyCount} lodiček</span>
                </p>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function CoverageAreaRow({ area }: { area: RvpGraphCoverageArea }) {
  const missing = Math.max(area.totalOvu - area.linkedOvu, 0);
  return (
    <details className="group rounded-[8px] border border-[#D6DFF0] bg-white p-3 transition open:border-[#C8372D] open:bg-[#FAEAE9]/25">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-[#4A5A7C]">
              {coverageLevelLabel(area.coverageLevel)} · {entityTypeLabel(area.entityType)}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#0E2A5C]">{area.title}</p>
          </div>
          <span className="rounded-[8px] bg-[#EEF2F7] px-2 py-1 text-xs font-semibold text-[#0E2A5C]">{area.coveragePercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF2F7]">
          <div className="h-full bg-[#C8372D]" style={{ width: `${Math.min(Math.max(area.coveragePercent, 0), 100)}%` }} />
        </div>
        <p className="mt-2 text-xs text-[#4A5A7C]">
          {area.linkedOvu}/{area.totalOvu} OVU pokryto · {missing} bez lodičky · {area.linkCount} vazeb
        </p>
        <p className="mt-2 text-xs font-semibold text-[#C8372D] group-open:hidden">Zobrazit konkrétní OVU</p>
        <p className="mt-2 hidden text-xs font-semibold text-[#C8372D] group-open:block">Zobrazit konkrétní OVU</p>
      </summary>
      <div className="mt-3 grid gap-3">
        <CoverageOvuList title="Mezery v pokrytí" items={area.unlinkedOvuSamples} empty="V ukázce nejsou nepokrytá OVU." />
        <CoverageOvuList title="Pokrytá OVU" items={area.linkedOvuSamples} empty="Tahle část zatím nemá pokryté OVU." />
      </div>
    </details>
  );
}

function GlobalRvpInsights({ areas }: { areas: RvpGraphCoverageArea[] }) {
  const axisAreas = areas
    .filter((area) => area.coverageLevel === "axis")
    .sort((a, b) => a.coveragePercent - b.coveragePercent || b.totalOvu - a.totalOvu)
    .slice(0, 8);
  const largestGaps = areas
    .filter((area) => area.totalOvu - area.linkedOvu > 0)
    .sort((a, b) => (b.totalOvu - b.linkedOvu) - (a.totalOvu - a.linkedOvu) || a.coveragePercent - b.coveragePercent)
    .slice(0, 6);
  const strongestHubs = areas
    .filter((area) => area.linkCount > 0)
    .sort((a, b) => b.linkCount - a.linkCount || b.linkedOvu - a.linkedOvu)
    .slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rychlé čtení pokrytí RVP</CardTitle>
        <CardDescription>Kde jsou mezery, kde je hodně vazeb a jak vypadají hlavní osy RVP.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#0E2A5C]">Hlavní osy RVP</p>
          {axisAreas.map((area) => <CoverageAreaRow key={area.id} area={area} />)}
          {axisAreas.length === 0 ? <div className="sv-placeholder">Nejsou dostupná data hlavních os.</div> : null}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#0E2A5C]">Největší mezery</p>
          {largestGaps.map((area) => <CoverageAreaRow key={area.id} area={area} />)}
          {largestGaps.length === 0 ? <div className="sv-placeholder">V zobrazených datech nejsou nepokryté části.</div> : null}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#0E2A5C]">Nejvíc napojené části</p>
          {strongestHubs.map((area) => <CoverageAreaRow key={area.id} area={area} />)}
          {strongestHubs.length === 0 ? <div className="sv-placeholder">Nejsou dostupné napojené části.</div> : null}
        </div>
      </CardContent>
    </Card>
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
      <CardContent className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(28rem,0.8fr)]">
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
          <div className="space-y-3 rounded-[8px] border border-[#D6DFF0] bg-[#F7F9FC] p-4">
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
  const [lodickaQuery, setLodickaQuery] = useState("");
  const [lodickaOvuFilter, setLodickaOvuFilter] = useState<LodickaOvuFilter>("all");
  const [lodickaGroupBy, setLodickaGroupBy] = useState<LodickaGroupBy>("oblast");
  const selectedLodicka = page.lodicky.find((lodicka) => lodicka.id === selectedId) ?? page.lodicky[0] ?? null;
  const selectedOvu = selectedLodicka?.confirmedOvu.find((ovu) => ovu.id === selectedOvuId) ?? selectedLodicka?.confirmedOvu[0] ?? null;
  const coveragePercent = page.selectedSvp?.lodickyCount
    ? Math.round((page.counts.linkedLodicky / page.selectedSvp.lodickyCount) * 100)
    : 0;
  const filteredLodicky = useMemo(() => {
    const query = lodickaQuery.trim().toLocaleLowerCase("cs-CZ");
    return page.lodicky.filter((lodicka) => {
      const matchesOvuFilter =
        lodickaOvuFilter === "all" ||
        (lodickaOvuFilter === "linked" && lodicka.confirmedOvu.length > 0) ||
        (lodickaOvuFilter === "unlinked" && lodicka.confirmedOvu.length === 0);
      if (!matchesOvuFilter) return false;
      return query.length === 0 || lodickaSearchText(lodicka).includes(query);
    });
  }, [lodickaOvuFilter, lodickaQuery, page.lodicky]);
  const groupedLodicky = useMemo(() => {
    const groups = new Map<string, RvpGraphLodickaLink[]>();
    for (const lodicka of filteredLodicky) {
      const label = lodickaGroupLabel(lodicka, lodickaGroupBy);
      groups.set(label, [...(groups.get(label) ?? []), lodicka]);
    }
    return Array.from(groups.entries())
      .map(([label, items]) => ({
        label,
        items: items.sort((a, b) => (a.kod || a.nazev).localeCompare(b.kod || b.nazev, "cs-CZ")),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "cs-CZ"));
  }, [filteredLodicky, lodickaGroupBy]);

  const handleSelectLodicka = (lodickaId: string) => {
    setSelectedId(lodickaId);
    setSelectedOvuId("");
  };

  const handleSelectOvu = (ovuId: string) => {
    setSelectedOvuId(ovuId);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[8px] border border-[#D6DFF0] bg-[#F7F9FC] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#4A5A7C]">Pracovní režimy</p>
            <h2 className="mt-1 text-xl font-semibold text-[#0E2A5C]">RVP vazby podle měřítka pohledu</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#4A5A7C]">
              Nejdřív ukazuje RVP jako celek včetně pokrytí oblastí, potom detail vybrané lodičky včetně tvrdých vazeb, okolí a semantických návrhů.
            </p>
          </div>
          <Badge variant="outline">
            <CheckCircle2 className="size-3" aria-hidden={true} />
            {page.counts.confirmedLinks} potvrzených vazeb
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-[8px] border border-[#D6DFF0] bg-white p-3">
            <p className="text-xs font-semibold text-[#4A5A7C]">Pokrytí lodiček</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF2F7]">
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
            <p className="text-xs font-semibold text-[#9A3412]">Semantické návrhy</p>
            <p className="mt-1 text-sm font-semibold text-[#7C2D12]">testovací index běží</p>
            <p className="mt-1 text-xs text-[#9A3412]">Qdrant + lokální baseline, ne finální AI model.</p>
            <a className="mt-2 inline-flex text-xs font-semibold text-[#7C2D12] underline underline-offset-4" href="#rvp-lodicka">
              Zobrazit u vybrané lodičky
            </a>
          </div>
        </div>
      </div>

      <nav className="sticky top-[5.75rem] z-20 overflow-x-auto rounded-[8px] border border-[#D6DFF0] bg-white/95 p-2 backdrop-blur">
        <div className="flex min-w-max flex-wrap gap-2">
          <a className="rounded-full border border-[#D6DFF0] px-3 py-1.5 text-sm font-semibold text-[#0E2A5C] transition hover:border-[#0E2A5C] hover:bg-[#EEF2F7]" href="#rvp-celek">RVP jako celek</a>
          <a className="rounded-full border border-[#D6DFF0] px-3 py-1.5 text-sm font-semibold text-[#0E2A5C] transition hover:border-[#0E2A5C] hover:bg-[#EEF2F7]" href="#rvp-lodicka">Vybraná lodička v RVP</a>
        </div>
      </nav>

      <section id="rvp-celek" className="scroll-mt-28 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-[#4A5A7C]">Měřítko: celé RVP</p>
          <h2 className="text-xl font-semibold text-[#0E2A5C]">RVP jako celek: pokrytí, mezery a nejsilnější sběhy vazeb</h2>
        </div>
        <GlobalRvpInsights areas={page.coverageAreas} />
        <CoverageHeatmap areas={page.coverageAreas} />

          <Card>
            <CardHeader>
              <CardTitle>OVU s největším napojením</CardTitle>
              <CardDescription>Globální přehled ukazuje, kam se lodičky v RVP nejvíc sbíhají.</CardDescription>
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
      </section>

      <section id="rvp-lodicka" className="scroll-mt-28 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-[#4A5A7C]">Měřítko: vybraná lodička v RVP</p>
          <h2 className="text-xl font-semibold text-[#0E2A5C]">Tvrdé vazby, RVP okolí a semantické návrhy</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Lodičky v aktuální sadě</CardTitle>
              <CardDescription>
                Katalogové lodičky z vybrané SVP sady. Zúžení a seskupení tady slouží jen pro pohodlnější výběr.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 rounded-[8px] border border-[#D6DFF0] bg-[#F7F9FC] p-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[#4A5A7C]">Hledat v lodičkách, OVU a popisech</span>
                  <input
                    type="search"
                    value={lodickaQuery}
                    onChange={(event) => setLodickaQuery(event.target.value)}
                    placeholder="Název, kód, předmět, oblast nebo OVU..."
                    className="mt-1 h-9 w-full rounded-[8px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none transition placeholder:text-[#8A96AF] focus:border-[#0E2A5C] focus:ring-2 focus:ring-[#0E2A5C]/15"
                  />
                </label>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#4A5A7C]">Filtr vazeb</p>
                  <div className="flex flex-wrap gap-2">
                    <GraphModeButton active={lodickaOvuFilter === "all"} onClick={() => setLodickaOvuFilter("all")}>Vše</GraphModeButton>
                    <GraphModeButton active={lodickaOvuFilter === "linked"} onClick={() => setLodickaOvuFilter("linked")}>S OVU</GraphModeButton>
                    <GraphModeButton active={lodickaOvuFilter === "unlinked"} onClick={() => setLodickaOvuFilter("unlinked")}>Bez OVU</GraphModeButton>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#4A5A7C]">Seskupit podle</p>
                  <div className="flex flex-wrap gap-2">
                    <GraphModeButton active={lodickaGroupBy === "oblast"} onClick={() => setLodickaGroupBy("oblast")}>Oblast</GraphModeButton>
                    <GraphModeButton active={lodickaGroupBy === "predmet"} onClick={() => setLodickaGroupBy("predmet")}>Předmět</GraphModeButton>
                    <GraphModeButton active={lodickaGroupBy === "rocnik"} onClick={() => setLodickaGroupBy("rocnik")}>Ročníky</GraphModeButton>
                    <GraphModeButton active={lodickaGroupBy === "ovu"} onClick={() => setLodickaGroupBy("ovu")}>Stav OVU</GraphModeButton>
                  </div>
                </div>
                <p className="text-xs font-semibold text-[#4A5A7C]">
                  Zobrazeno {filteredLodicky.length} z {page.lodicky.length} lodiček · {groupedLodicky.length} skupin
                </p>
              </div>

              <div className="max-h-[34rem] space-y-3 overflow-auto pr-1">
                {groupedLodicky.map((group) => (
                  <section key={group.label} className="space-y-2">
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-[8px] border border-[#D6DFF0] bg-white px-3 py-2">
                      <h3 className="text-xs font-semibold uppercase tracking-normal text-[#4A5A7C]">{group.label}</h3>
                      <Badge variant="outline">{group.items.length}</Badge>
                    </div>
                    {group.items.map((lodicka) => {
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
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-snug text-[#0E2A5C]">{lodicka.nazev}</p>
                              <p className="mt-1 text-xs text-[#4A5A7C]">{lodicka.kod} · {lodicka.predmet || "bez předmětu"} · {lodickaGradeLabel(lodicka)}</p>
                              <p className="mt-1 text-xs text-[#4A5A7C]">{lodicka.oblast || "bez oblasti"}</p>
                            </div>
                            <Badge variant={lodicka.confirmedOvu.length > 0 ? "secondary" : "outline"}>{lodicka.confirmedOvu.length} OVU</Badge>
                          </div>
                        </button>
                      );
                    })}
                  </section>
                ))}
                {groupedLodicky.length === 0 ? (
                  <div className="sv-placeholder">Pro zadané hledání a filtr nejsou žádné lodičky.</div>
                ) : null}
              </div>
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
                      <OvuCard key={ovu.id} ovu={ovu} active={selectedOvu?.id === ovu.id} onClick={() => handleSelectOvu(ovu.id)} />
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
              <CardDescription>Detail jedné vazby: vertikální RVP cesta, metodická podpora a horizontální OVU souvislosti.</CardDescription>
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

        <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Semantika k vybrané lodičce</CardTitle>
              <CardDescription>Tenhle režim není tvrdá vazba. Porovnává popis lodičky s knowledge korpusem RVP.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedLodicka ? (
                <div className="rounded-[8px] border border-[#D6DFF0] bg-white p-4">
                  <Badge variant="secondary">{selectedLodicka.kod}</Badge>
                  <h2 className="mt-3 text-xl font-semibold text-[#0E2A5C]">{selectedLodicka.nazev}</h2>
                  <p className="mt-1 text-sm text-[#4A5A7C]">{selectedLodicka.predmet} · {selectedLodicka.oblast} · {selectedLodicka.rocnikOd}. až {selectedLodicka.rocnikDo}. ročník</p>
                  <p className="mt-3 text-sm text-[#0E2A5C]">{shortText(selectedLodicka.popis, 520)}</p>
                </div>
              ) : (
                <div className="sv-placeholder">Vyber lodičku v režimu Lodička a vazba.</div>
              )}
              <div className="rounded-[8px] border border-dashed border-[#D97706] bg-[#FFF7ED] p-3 text-sm text-[#7C2D12]">
                Semantický pohled slouží k návrhům možných souvislostí. Potvrzení vazby musí zůstat oddělené v tvrdých vazbách.
              </div>
            </CardContent>
          </Card>

          {selectedLodicka ? <SemanticCandidateList lodickaId={selectedLodicka.id} /> : null}
        </div>
      </section>
    </div>
  );
}
