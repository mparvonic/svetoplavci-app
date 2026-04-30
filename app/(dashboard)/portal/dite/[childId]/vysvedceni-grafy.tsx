"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { SailboatLoading } from "@/components/sailboat-loading";

const COLOR_PREV = "#1F4E79";
const COLOR_NEW = "#C00000";
const COLOR_REST = "#D9E8F5";
const LABELS_I = ["1/1", "2/1", "1/2", "2/2", "1/3", "2/3", "1/4", "2/4", "1/5", "2/5"];
const LABELS_II = ["1/6", "2/6", "1/7", "2/7", "1/8", "2/8", "1/9", "2/9"];

function num(x: unknown, def: number): number {
  if (x === null || x === undefined) return def;
  if (typeof x === "number") return Number.isFinite(x) ? x : def;
  const s = String(x).replace(/\u00a0/g, " ").replace(/\s/g, "").replace(/%/g, "").replace(/,/g, ".");
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : def;
}

function normStep(s: string): string {
  return String(s || "").replace(/\u00a0/g, " ").trim().toUpperCase();
}

function isStepI(stepenKey: string): boolean {
  const s = normStep(stepenKey);
  return s.startsWith("I") && !s.startsWith("II");
}

function isStepII(stepenKey: string): boolean {
  return normStep(stepenKey).startsWith("II");
}

interface CurveData {
  rocnik: string;
  stepen_key: string;
  highlight: number | null;
  milestones: (number | null)[];
  milestones2: (number | null)[];
}

interface AreaData {
  oblast: unknown;
  podpredmet: unknown;
  predchozi_body: unknown;
  body_celkem: unknown;
  zbyva_bodu: unknown;
}

interface PredmetData {
  predmet: string;
  hodnoceni: unknown;
  predchozi_hodnoceni: unknown;
  tempo_zmeny: unknown;
  oblasti: AreaData[];
}

type PlotlyApi = Pick<typeof import("plotly.js"), "newPlot">;
type PlotlyModule = PlotlyApi & { default?: PlotlyApi };
type PlotlyNewPlotArgs = Parameters<PlotlyApi["newPlot"]>;

function chooseCurveSet(
  curve: CurveData,
  subjectName: string,
  subSubjectName: string
): { milestones: number[]; highlight: number; using2: boolean } {
  const stepenKey = curve.stepen_key || "";
  const subject = String(subjectName || "").trim();
  const subSubject = String(subSubjectName || "").trim();
  const use2 =
    (isStepI(stepenKey) && subject === "Expedice") ||
    (isStepII(stepenKey) && subSubject === "Španělština");

  const m1 = (curve.milestones || []).map((p) => num(p, 0));
  const m2 = (curve.milestones2 || []).map((p) => num(p, 0));
  const h1 = num(curve.highlight, 0);
  let h2 = h1;
  const idx = m1.findIndex((v) => Math.abs(v - h1) < 1e-9);
  if (idx >= 0 && idx < m2.length) h2 = m2[idx];

  return {
    milestones: use2 ? m2 : m1,
    highlight: use2 ? h2 : h1,
    using2: use2,
  };
}

async function buildAreaPlot(
  Plotly: PlotlyApi,
  divId: string,
  area: AreaData,
  curve: CurveData,
  subjectName: string
): Promise<void> {
  const prev = num(area.predchozi_body, 0);
  const curr = num(area.body_celkem, 0);
  const rest = num(area.zbyva_bodu, 0);
  const newv = Math.max(0, curr - prev);
  const maxv = prev + newv + rest;

  const traces = [
    {
      type: "bar",
      orientation: "h",
      y: [""],
      x: [prev],
      name: "Předchozí",
      marker: { color: COLOR_PREV },
      hovertemplate: "Předchozí body: %{x}<extra></extra>",
    },
    {
      type: "bar",
      orientation: "h",
      y: [""],
      x: [newv],
      name: "Nové",
      marker: { color: COLOR_NEW },
      hovertemplate: "Nové body: %{x}<extra></extra>",
    },
    {
      type: "bar",
      orientation: "h",
      y: [""],
      x: [rest],
      name: "Zbývá",
      marker: { color: COLOR_REST },
      hovertemplate: "Zbývá bodů: %{x}<extra></extra>",
    },
  ];

  const chosen = chooseCurveSet(curve, subjectName, String(area.podpredmet || ""));
  let milestones = chosen.milestones;
  if (isStepII(curve.stepen_key) && String(area.podpredmet || "").trim() === "Španělština") {
    milestones = milestones.slice(1);
  }
  const highlightPct = chosen.highlight;

  let labels: string[] = [];
  if (isStepI(curve.stepen_key)) {
    labels = LABELS_I;
  } else if (isStepII(curve.stepen_key)) {
    labels = String(area.podpredmet || "").trim() === "Španělština" ? LABELS_II.slice(2) : LABELS_II;
  }

  const shapes: { type: string; x0: number; x1: number; y0: number; y1: number; xref: string; yref: string; line: { dash: string; width: number; color: string } }[] = [];
  const annotations: { x: number; y: number; xref: string; yref: string; text: string; showarrow: boolean; yanchor: string; xanchor: string; xshift: number; font: { size: number; family: string; color: string }; bgcolor: string; bordercolor: string; borderwidth: number; borderpad: number }[] = [];

  const xFromPct = (pct: number) => (maxv > 0 ? (maxv * pct) / 100 : 0);
  const addLine = (pct: number, dash: string, width: number) => {
    const x = xFromPct(pct);
    shapes.push({
      type: "line",
      x0: x,
      x1: x,
      y0: -0.5,
      y1: 0.5,
      xref: "x",
      yref: "y",
      line: { dash, width, color: "#000" },
    });
  };

  const useDrawnIndex = isStepII(curve.stepen_key) && String(area.podpredmet || "").trim() === "Španělština";
  let drawn = 0;

  milestones.forEach((p, i) => {
    addLine(p, "dot", 1);
    if (p <= 0) return;
    const idx = useDrawnIndex ? drawn : i;
    if (idx < labels.length) {
      const x = xFromPct(p);
      const nearEnd = p >= 99.5;
      const isHighlightBubble = Math.abs(p - highlightPct) < 1e-9;
      annotations.push({
        x,
        y: -0.5,
        xref: "x",
        yref: "y",
        text: labels[idx],
        showarrow: false,
        yanchor: "middle",
        xanchor: nearEnd ? "right" : "center",
        xshift: nearEnd ? -6 : 0,
        font: {
          size: 16,
          family: "Cambria, Georgia, serif",
          color: isHighlightBubble ? "#FFFFFF" : "#000000",
        },
        bgcolor: isHighlightBubble ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.75)",
        bordercolor: "rgba(0,0,0,0.2)",
        borderwidth: isHighlightBubble ? 2 : 1,
        borderpad: 2,
      });
      if (useDrawnIndex) drawn++;
    }
  });
  addLine(highlightPct, "dot", 3);

  const layout = {
    barmode: "stack",
    margin: { l: 10, r: 10, t: 2, b: 8 },
    showlegend: false,
    font: { family: "Cambria, Georgia, serif", size: 14 },
    xaxis: {
      range: [0, maxv > 0 ? maxv : 1],
      fixedrange: true,
      showgrid: false,
      zeroline: false,
      showline: false,
      showticklabels: false,
    },
    yaxis: {
      fixedrange: true,
      showticklabels: false,
      showgrid: false,
      zeroline: false,
    },
    shapes,
    annotations,
    height: 54,
  };

  const config = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["select2d", "lasso2d", "zoom2d", "pan2d", "autoScale2d", "resetScale2d"],
  };

  const el = document.getElementById(divId);
  if (!el) return;
  await Plotly.newPlot(
    el,
    traces as PlotlyNewPlotArgs[1],
    layout as PlotlyNewPlotArgs[2],
    config as PlotlyNewPlotArgs[3]
  );
}

export function VysvedceniGrafy({
  childId,
}: {
  childId: string;
  childName: string;
}) {
  const [data, setData] = useState<{
    curve: CurveData | null;
    report: { jmeno: string; predmety: PredmetData[] };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const plotRefs = useRef<{ plotId: string; area: AreaData; curve: CurveData; subjectName: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/reports/child/${childId}/vysvedceni-grafy`)
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.error ?? "Chyba")));
        return r.json();
      })
      .then((body) => {
        if (!cancelled) setData({ curve: body.curve ?? null, report: body.report ?? { jmeno: "", predmety: [] } });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Nepodařilo se načíst data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [childId]);

  const drawPlots = useCallback(async () => {
    if (plotRefs.current.length === 0) return;
    const PlotlyModule = (await import("plotly.js-basic-dist-min")) as PlotlyModule;
    const Plotly = PlotlyModule.default ?? PlotlyModule;
    for (const { plotId, area, curve, subjectName } of plotRefs.current) {
      try {
        await buildAreaPlot(Plotly, plotId, area, curve, subjectName);
      } catch (e) {
        console.error("Plot", plotId, e);
      }
    }
  }, []);

  useEffect(() => {
    if (!data || plotRefs.current.length === 0) return;
    drawPlots();
  }, [data, drawPlots]);

  if (loading) {
    return <SailboatLoading message="Načítám grafy…" />;
  }
  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { curve, report } = data;
  if (!curve) {
    return (
      <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200">
        Tabulka křivky plnění není nakonfigurována (CODA_TABLE_CURVE) nebo pro tento ročník nejsou data.
      </div>
    );
  }

  plotRefs.current = [];
  const predmety = (report.predmety || []).slice().sort((a, b) => a.predmet.localeCompare(b.predmet, "cs"));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Ročník: {curve.rocnik} | Křivka: {curve.stepen_key} | Zvýraznění: {curve.highlight ?? "—"}%
      </p>

      {predmety.map((p, si) => (
        <div key={p.predmet} className="subject space-y-4 border-t pt-4 first:border-t-0 first:pt-0">
          <div className="flex flex-wrap items-baseline gap-4">
            <h2 className="text-2xl font-semibold uppercase tracking-normal">{p.predmet}</h2>
            <p className="text-muted-foreground">
              <strong>Hodnocení:</strong> {String(p.hodnoceni ?? "—")}
            </p>
          </div>

          {(p.oblasti || []).map((a, ai) => {
            const plotId = `plot_${si}_${ai}`;
            plotRefs.current.push({
              plotId,
              area: a,
              curve,
              subjectName: p.predmet,
            });
            return (
              <div key={`${si}-${ai}`} className="area">
                <p className="mb-1 text-lg font-medium">{String(a.oblast || "—")}</p>
                <div id={plotId} className="h-[54px] w-full" />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
