"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CodaRow } from "@/src/lib/coda";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SailboatLoading } from "@/components/sailboat-loading";
import { VysvedceniGrafy } from "./vysvedceni-grafy";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

function getVal(row: CodaRow, ...keys: string[]): string {
  const v = row.values as Record<string, unknown>;
  for (const k of keys) {
    const val = v[k];
    if (val != null && val !== "") return String(val);
  }
  return "—";
}

/** Pro buňku může být key jeden název nebo pole alternativ (Coda může vracet jiný tvar). */
function getValForColumn(row: CodaRow, key: string | string[]): string {
  return getVal(row, ...(Array.isArray(key) ? key : [key]));
}

/** Stupně stavu lodičky (pořadí) a jejich barvy. */
const STAV_ORDER = ["Nezahájeno", "Zahájeno", "S dopomocí", "Částečně", "Samostatně"] as const;
const STAV_COLORS: Record<string, string> = {
  Nezahájeno: "bg-slate-100 text-slate-700 border-slate-300",
  Zahájeno: "bg-[#fff4e5] text-[#b45309] border-[#fdba74]",
  "S dopomocí": "bg-[#EEF2F7] text-[#0E2A5C] border-[#D6DFF0]",
  Částečně: "bg-[#e0f2fe] text-[#075985] border-[#7dd3fc]",
  Samostatně: "bg-[#dcfce7] text-[#166534] border-[#4ade80]",
};

function getStavClass(val: string): string | null {
  const v = val.trim();
  if (!v || v === "—") return null;
  for (const stav of STAV_ORDER) {
    if (v === stav || v.toLowerCase() === stav.toLowerCase()) return STAV_COLORS[stav] ?? null;
  }
  return null;
}

/** Sloupce, které zobrazují stav lodičky (stejné hodnoty jako Stav). */
const STAV_COLUMN_KEYS = new Set([
  "Stav",
  "Vstupní stav",
  "1. plavba",
  "2. plavba",
  "3. plavba",
  "4. plavba",
  "5. plavba",
]);

/** Buňka: u sloupce „Název lodičky“ přidá ikonu i s tooltipem (Popis lodičky + Znění RVP). */
function LodickaCell({
  row,
  colKey,
}: {
  row: CodaRow;
  colKey: string | string[];
}) {
  const keyStr = Array.isArray(colKey) ? colKey[0] : colKey;
  const isNazevLodicky = keyStr === "Název lodičky";
  const popis = getVal(row, "Název lodičky dlouhý", "Nazev lodicky dlouhy");
  const rvp = getVal(row, "Znění RVP", "Zneni RVP");

  if (isNazevLodicky) {
    return (
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 text-xs font-medium"
                aria-label={'Info o lodičce'}
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="max-w-md p-3 text-sm !bg-white !text-gray-900 border border-gray-200 shadow-lg [&>svg]:!fill-white [&>svg]:!bg-white"
            >
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-gray-900 mb-0.5">Popis lodičky</div>
                  <div className="text-gray-700 whitespace-pre-wrap text-xs">{popis}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900 mb-0.5">Znění RVP</div>
                  <div className="text-gray-700 whitespace-pre-wrap text-xs">{rvp}</div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          <span>{getValForColumn(row, colKey)}</span>
        </div>
      </TableCell>
    );
  }
  const val = getValForColumn(row, colKey);
  const stavClass = STAV_COLUMN_KEYS.has(keyStr) ? getStavClass(val) : null;
  if (stavClass) {
    return (
      <TableCell>
        <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-medium border", stavClass)}>
          {val}
        </span>
      </TableCell>
    );
  }
  return <TableCell>{val}</TableCell>;
}

function uniqueValues(rows: CodaRow[], key: string): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = getVal(row, key);
    if (v && v !== "—") set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "cs"));
}

/** Seřadí řádky lodiček: Předmět → Podpředmět → Oblast → Název lodičky (abecedně, česky). */
function sortLodickyRows(rows: CodaRow[]): CodaRow[] {
  const cmp = (a: string, b: string) => (a || "").localeCompare(b || "", "cs");
  return [...rows].sort((ra, rb) => {
    const p1 = getVal(ra, "Předmět");
    const p2 = getVal(rb, "Předmět");
    if (p1 !== p2) return cmp(p1, p2);
    const pp1 = getVal(ra, "Podpředmět");
    const pp2 = getVal(rb, "Podpředmět");
    if (pp1 !== pp2) return cmp(pp1, pp2);
    const o1 = getVal(ra, "Oblast");
    const o2 = getVal(rb, "Oblast");
    if (o1 !== o2) return cmp(o1, o2);
    const n1 = getVal(ra, "Název lodičky");
    const n2 = getVal(rb, "Název lodičky");
    return cmp(n1, n2);
  });
}

const TAB1_COLUMNS = [
  { key: "Předmět", label: "Předmět" },
  { key: "Podpředmět", label: "Podpředmět" },
  { key: "Oblast", label: "Oblast" },
  { key: "Název lodičky", label: "Název lodičky" },
  { key: "Stav", label: "Stav" },
  { key: "Úspěch", label: "Úspěch" },
  { key: "Poznámka", label: "Poznámka" },
];

/** Lodičky po plavbách – stejná data jako Lodičky dítěte, jiné sloupce. View v Coda (po ročnících) musí obsahovat sloupce Vstupní stav, 1.–5. plavba. */
const TAB2_COLUMNS: { key: string | string[]; label: string }[] = [
  { key: "Předmět", label: "Předmět" },
  { key: "Podpředmět", label: "Podpředmět" },
  { key: "Oblast", label: "Oblast" },
  { key: "Název lodičky", label: "Název lodičky" },
  { key: ["Vstupní stav", "Vstupni stav"], label: "Vstupní stav" },
  { key: ["1. plavba", "1.plavba"], label: "1. plavba" },
  { key: ["2. plavba", "2.plavba"], label: "2. plavba" },
  { key: ["3. plavba", "3.plavba"], label: "3. plavba" },
  { key: ["4. plavba", "4.plavba"], label: "4. plavba" },
  { key: ["5. plavba", "5.plavba"], label: "5. plavba" },
];

type VysvedceniColumn = { key: string; label: string; format?: "integer" };

const TAB3_COLUMNS: VysvedceniColumn[] = [
  { key: "Předmět", label: "Předmět" },
  { key: "Předmět celkem", label: "Předmět celkem" },
  { key: "Body celkem", label: "Body celkem" },
  { key: "Norma", label: "Norma", format: "integer" },
  { key: "Hodnocení", label: "Hodnocení" },
];

const TAB4_COLUMNS: VysvedceniColumn[] = [
  { key: "Předmět", label: "Předmět" },
  { key: "Oblast", label: "Oblast" },
  { key: "Oblast celkem", label: "Oblast celkem" },
  { key: "Dopočet při přestupu", label: "Dopočet při přestupu" },
  { key: "Historické lodičky", label: "Historické lodičky" },
  { key: "Aktuální body", label: "Aktuální body" },
  { key: "Body celkem", label: "Body celkem" },
  { key: "Norma", label: "Norma", format: "integer" },
  { key: "Hodnocení", label: "Hodnocení" },
];

function formatCellValue(row: CodaRow, col: VysvedceniColumn): string {
  const raw = getVal(row, col.key);
  if (col.format === "integer") {
    const num = Number(String(raw).replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(num) ? String(Math.round(num)) : (raw || "—");
  }
  return raw;
}

function DataTable({
  rows,
  columns,
}: {
  rows: CodaRow[];
  columns: VysvedceniColumn[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader className="bg-[#0E2A5C]">
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className="whitespace-nowrap text-xs font-semibold uppercase tracking-normal text-white"
              >
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                Žádná data
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((col) => (
                  <TableCell key={col.key}>{formatCellValue(row, col)}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** Strom Předmět -> Podpředmět -> Oblast -> řádky (řazené abecedně). */
function buildLodickyTree(rows: CodaRow[]): Map<string, Map<string, Map<string, CodaRow[]>>> {
  const tree = new Map<string, Map<string, Map<string, CodaRow[]>>>();
  for (const row of rows) {
    const p = getVal(row, "Předmět") || "—";
    const pp = getVal(row, "Podpředmět") || "—";
    const o = getVal(row, "Oblast") || "—";
    if (!tree.has(p)) tree.set(p, new Map());
    const byPod = tree.get(p)!;
    if (!byPod.has(pp)) byPod.set(pp, new Map());
    const byObl = byPod.get(pp)!;
    if (!byObl.has(o)) byObl.set(o, []);
    byObl.get(o)!.push(row);
  }
  const cmp = (a: string, b: string) => (a || "").localeCompare(b || "", "cs");
  for (const byPod of tree.values()) {
    for (const arr of byPod.values()) {
      for (const rows of arr.values()) {
        rows.sort((ra, rb) => cmp(getVal(ra, "Název lodičky"), getVal(rb, "Název lodičky")));
      }
    }
  }
  return tree;
}

/** Jedna hodnota Podpředmět "—" se při zobrazení přeskočí (oblasti jdou rovnou pod Předmět). */
function isSkipPodpredmet(p: string, byPod: Map<string, Map<string, CodaRow[]>>): boolean {
  const podpredmety = Array.from(byPod.keys());
  return podpredmety.length === 1 && (podpredmety[0] === "—" || podpredmety[0] === "");
}

function CollapsibleLodickyTable({
  rows,
  columns,
}: {
  rows: CodaRow[];
  columns: { key: string | string[]; label: string }[];
}) {
  const columnKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const tree = useMemo(() => buildLodickyTree(rows), [rows]);
  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    const predmety = Array.from(tree.keys()).sort((a, b) => (a || "").localeCompare(b || "", "cs"));
    for (const p of predmety) {
      keys.add(`p:${p}`);
      const byPod = tree.get(p)!;
      const skipPP = isSkipPodpredmet(p, byPod);
      const podpredmety = Array.from(byPod.keys()).sort((a, b) => (a || "").localeCompare(b || "", "cs"));
      for (const pp of podpredmety) {
        if (!skipPP) keys.add(`p:${p}|pp:${pp}`);
      }
    }
    return keys;
  }, [tree]);
  // Výchozí stav: vše plně rozbalené (všechny Předměty i Podpředměty)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(allKeys));

  // Po změně dat (např. filtr, jiné dítě) znovu vše rozbalit
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded(new Set(allKeys));
  }, [allKeys]);
  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const expandAll = useCallback(() => setExpanded(new Set(allKeys)), [allKeys]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);
  const cmp = (a: string, b: string) => (a || "").localeCompare(b || "", "cs");
  const predmety = useMemo(() => Array.from(tree.keys()).sort(cmp), [tree]);

  const colKey = (key: string | string[]) => (Array.isArray(key) ? key.join("-") : key);
  if (rows.length === 0) {
    return (
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={colKey(col.key)}
                  className="whitespace-nowrap bg-[#0E2A5C] text-xs font-semibold uppercase tracking-normal text-white"
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                Žádná data
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={expandAll}
          className="text-xs rounded-md border border-input bg-background px-2 py-1.5 hover:bg-muted"
        >
          Rozbalit vše
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="text-xs rounded-md border border-input bg-background px-2 py-1.5 hover:bg-muted"
        >
          Sbalit vše
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 shrink-0 bg-[#0E2A5C]" />
              {columns.map((col) => (
                <TableHead
                  key={colKey(col.key)}
                  className="whitespace-nowrap bg-[#0E2A5C] text-xs font-semibold uppercase tracking-normal text-white"
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {predmety.map((p, predmetIdx) => {
              const keyP = `p:${p}`;
              const isOpenP = expanded.has(keyP);
              const byPod = tree.get(p)!;
              const podpredmety = Array.from(byPod.keys()).sort(cmp);
              const skipPP = isSkipPodpredmet(p, byPod);

              // Střídání výrazných, ale čitelných kombinací pro řádky Předmětů
              // Jemnější, čitelné kombinace pro řádky Předmětů – střídáme jen levý proužek a jemný podklad
              const subjectColorIndex = predmetIdx % 2;
              const subjectVariant =
                subjectColorIndex === 0
                  ? "border-l-4 border-l-[#0E2A5C] bg-[#EEF2F7] text-[#0E2A5C] hover:bg-[#D6DFF0]"
                  : "border-l-4 border-l-[#C8372D] bg-[#FAEAE9] text-[#A42A22] hover:bg-[#FAEAE9]";

              return (
                <React.Fragment key={keyP}>
                  <TableRow
                    key={keyP}
                    className={cn(
                      "cursor-pointer",
                      subjectVariant,
                      predmetIdx > 0 && "mt-1"
                    )}
                    onClick={() => toggle(keyP)}
                  >
                    <TableCell className="w-8 p-1">
                      {isOpenP ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell colSpan={columns.length} className="font-medium">
                      Předmět: {p}
                    </TableCell>
                  </TableRow>
                  {isOpenP &&
                    podpredmety.map((pp) => {
                      const keyPP = `p:${p}|pp:${pp}`;
                      const isOpenPP = expanded.has(keyPP);
                      const byObl = byPod.get(pp)!;
                      const oblasti = Array.from(byObl.keys()).sort(cmp);
                      const rowIndent = skipPP ? "pl-10" : "pl-14";
                      if (skipPP) {
                        return (
                          <React.Fragment key={`p:${p}|o:${pp}-wrap`}>
                            {oblasti.map((o) => {
                              const keyO = `p:${p}|o:${o}`;
                              const groupRows = byObl.get(o)!;
                              return (
                                <React.Fragment key={keyO}>
                                  {groupRows.map((row) => (
                                    <TableRow key={row.id}>
                                      <TableCell className={cn("w-8 p-1", rowIndent)} />
                                      {columnKeys.map((colKey) => (
                                        <LodickaCell key={Array.isArray(colKey) ? colKey[0] : colKey} row={row} colKey={colKey} />
                                      ))}
                                    </TableRow>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      }
                      return (
                        <React.Fragment key={keyPP}>
                          <TableRow
                            key={keyPP}
                            className={cn(
                              "cursor-pointer border-t border-slate-100 bg-white text-[#0E2A5C] hover:bg-[#f9fafb]",
                              subjectColorIndex === 0
                                ? "border-l-4 border-l-[#0E2A5C]"
                                : "border-l-4 border-l-[#C8372D]"
                            )}
                            onClick={() => toggle(keyPP)}
                          >
                            <TableCell className="w-8 p-1 pl-6">
                              {isOpenPP ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </TableCell>
                            <TableCell className="text-muted-foreground">—</TableCell>
                            <TableCell colSpan={columns.length - 1}>Podpředmět: {pp}</TableCell>
                          </TableRow>
                          {isOpenPP &&
                            oblasti.map((o) => {
                              const keyO = `p:${p}|pp:${pp}|o:${o}`;
                              const groupRows = byObl.get(o)!;
                              return (
                                <React.Fragment key={keyO}>
                                  {groupRows.map((row) => (
                                    <TableRow key={row.id}>
                                      <TableCell className={cn("w-8 p-1", rowIndent)} />
                                      {columnKeys.map((colKey) => (
                                        <LodickaCell key={Array.isArray(colKey) ? colKey[0] : colKey} row={row} colKey={colKey} />
                                      ))}
                                    </TableRow>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
      >
        <option value="">Vše</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

interface VysvedceniData {
  predmetu: CodaRow[];
  oblasti: CodaRow[];
}

export type ChildDetailTabId = "lodicky" | "lodicky-po-plavbach" | "vysvedceni" | "vysvedceni-grafy";

const DEFAULT_CHILD_DETAIL_TABS: ChildDetailTabId[] = [
  "lodicky",
  "lodicky-po-plavbach",
  "vysvedceni",
  "vysvedceni-grafy",
];

export function ChildDetailTabs({
  childId,
  childName: _childName,
  tableData,
  initialTab = "lodicky",
  enabledTabs = DEFAULT_CHILD_DETAIL_TABS,
  vysvedceniApiBasePath = "/api/coda/child",
}: {
  childId: string;
  childName: string;
  tableData: Record<string, CodaRow[]>;
  initialTab?: ChildDetailTabId;
  enabledTabs?: ChildDetailTabId[];
  vysvedceniApiBasePath?: string;
}) {
  const lodicky = useMemo(() => tableData["table-RuXGEEn2z4"] ?? [], [tableData]);
  const lodickyPoPlavbach = useMemo(() => tableData["table-1wVyfFAjX2"] ?? [], [tableData]);

  const [vysvedceniData, setVysvedceniData] = useState<VysvedceniData | null>(null);
  const [vysvedceniLoading, setVysvedceniLoading] = useState(false);
  const [vysvedceniError, setVysvedceniError] = useState<string | null>(null);

  useEffect(() => {
    setVysvedceniData(null);
    setVysvedceniError(null);
  }, [childId]);

  const loadVysvedceni = useCallback(async () => {
    if (!childId || vysvedceniData !== null || vysvedceniLoading) return;
    setVysvedceniLoading(true);
    setVysvedceniError(null);
    try {
      const res = await fetch(`${vysvedceniApiBasePath}/${childId}/vysvedceni`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Nepodařilo se načíst vysvědčení");
      }
      const data = await res.json();
      setVysvedceniData({ predmetu: data.predmetu ?? [], oblasti: data.oblasti ?? [] });
    } catch (e) {
      setVysvedceniError(e instanceof Error ? e.message : "Chyba při načítání");
    } finally {
      setVysvedceniLoading(false);
    }
  }, [childId, vysvedceniApiBasePath, vysvedceniData, vysvedceniLoading]);

  const hodnoceniPredmetu = vysvedceniData?.predmetu ?? [];
  const hodnoceniOblasti = vysvedceniData?.oblasti ?? [];

  const [f1Predmet, setF1Predmet] = useState("");
  const [f1Podpredmet, setF1Podpredmet] = useState("");
  const [f1Oblast, setF1Oblast] = useState("");
  const [f1Lodicka, setF1Lodicka] = useState("");
  const [f1Stav, setF1Stav] = useState("");
  const [f2Predmet, setF2Predmet] = useState("");
  const [f2Podpredmet, setF2Podpredmet] = useState("");
  const [f2Oblast, setF2Oblast] = useState("");
  const [f2Lodicka, setF2Lodicka] = useState("");

  const lodickyFiltered = useMemo(() => {
    const filtered = lodicky.filter((row) => {
      if (f1Predmet && getVal(row, "Předmět") !== f1Predmet) return false;
      if (f1Podpredmet && getVal(row, "Podpředmět") !== f1Podpredmet) return false;
      if (f1Oblast && getVal(row, "Oblast") !== f1Oblast) return false;
      if (f1Lodicka && getVal(row, "Název lodičky") !== f1Lodicka) return false;
      if (f1Stav && getVal(row, "Stav") !== f1Stav) return false;
      return true;
    });
    return sortLodickyRows(filtered);
  }, [lodicky, f1Predmet, f1Podpredmet, f1Oblast, f1Lodicka, f1Stav]);

  const lodickyPoPlavbachFiltered = useMemo(() => {
    const filtered = lodickyPoPlavbach.filter((row) => {
      if (f2Predmet && getVal(row, "Předmět") !== f2Predmet) return false;
      if (f2Podpredmet && getVal(row, "Podpředmět") !== f2Podpredmet) return false;
      if (f2Oblast && getVal(row, "Oblast") !== f2Oblast) return false;
      if (f2Lodicka && getVal(row, "Název lodičky") !== f2Lodicka) return false;
      return true;
    });
    return sortLodickyRows(filtered);
  }, [lodickyPoPlavbach, f2Predmet, f2Podpredmet, f2Oblast, f2Lodicka]);

  const tab1Filters = useMemo(() => ({
    predmet: uniqueValues(lodicky, "Předmět"),
    podpredmet: uniqueValues(lodicky, "Podpředmět"),
    oblast: uniqueValues(lodicky, "Oblast"),
    lodicka: uniqueValues(lodicky, "Název lodičky"),
    stav: uniqueValues(lodicky, "Stav"),
  }), [lodicky]);

  const tab2Filters = useMemo(() => ({
    predmet: uniqueValues(lodickyPoPlavbach, "Předmět"),
    podpredmet: uniqueValues(lodickyPoPlavbach, "Podpředmět"),
    oblast: uniqueValues(lodickyPoPlavbach, "Oblast"),
    lodicka: uniqueValues(lodickyPoPlavbach, "Název lodičky"),
  }), [lodickyPoPlavbach]);

  const [activeTab, setActiveTab] = useState<ChildDetailTabId>(initialTab);
  const enabledTabSet = useMemo(() => new Set(enabledTabs), [enabledTabs]);
  const tabsGridClass = enabledTabs.length <= 2
    ? "md:grid-cols-2"
    : enabledTabs.length === 3
      ? "md:grid-cols-3"
      : "md:grid-cols-4";

  const handleTabChange = useCallback(
    (value: string) => {
      if (!enabledTabSet.has(value as ChildDetailTabId)) return;
      setActiveTab(value as ChildDetailTabId);
      if (value === "vysvedceni") loadVysvedceni();
    },
    [enabledTabSet, loadVysvedceni]
  );

  useEffect(() => {
    if (!enabledTabSet.has(initialTab)) return;
    setActiveTab(initialTab);
    if (initialTab === "vysvedceni") void loadVysvedceni();
  }, [enabledTabSet, initialTab, loadVysvedceni]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="w-full mt-4 mb-4"
    >
      <TabsList className={`mx-2 flex w-full flex-col gap-3 bg-transparent text-sm h-auto md:mx-0 md:flex-row md:grid ${tabsGridClass} md:px-1`}>
        {enabledTabSet.has("lodicky") && (
          <TabsTrigger
            value="lodicky"
            className="flex w-full items-center justify-center rounded-xl border px-4 py-4 text-xs font-semibold uppercase tracking-normal text-[#C8372D] data-[state=active]:bg-[#C8372D] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:border-[#C8372D] data-[state=active]:border-[#C8372D] focus-visible:ring-offset-0 data-[state=active]:shadow-none"
          >
            Lodičky dítěte
          </TabsTrigger>
        )}
        {enabledTabSet.has("lodicky-po-plavbach") && (
          <TabsTrigger
            value="lodicky-po-plavbach"
            className="flex w-full items-center justify-center rounded-xl border px-4 py-4 text-xs font-semibold uppercase tracking-normal text-[#C8372D] data-[state=active]:bg-[#C8372D] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:border-[#C8372D] data-[state=active]:border-[#C8372D] focus-visible:ring-offset-0 data-[state=active]:shadow-none"
          >
            Lodičky po plavbách
          </TabsTrigger>
        )}
        {enabledTabSet.has("vysvedceni") && (
          <TabsTrigger
            value="vysvedceni"
            className="flex w-full items-center justify-center rounded-xl border px-4 py-4 text-xs font-semibold uppercase tracking-normal text-[#C8372D] data-[state=active]:bg-[#C8372D] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:border-[#C8372D] data-[state=active]:border-[#C8372D] focus-visible:ring-offset-0 data-[state=active]:shadow-none"
          >
            Vysvědčení – data
          </TabsTrigger>
        )}
        {enabledTabSet.has("vysvedceni-grafy") && (
          <TabsTrigger
            value="vysvedceni-grafy"
            className="hidden w-full items-center justify-center rounded-xl border px-4 py-4 text-xs font-semibold uppercase tracking-normal text-[#C8372D] data-[state=active]:bg-[#C8372D] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:border-[#C8372D] data-[state=active]:border-[#C8372D] focus-visible:ring-offset-0 data-[state=active]:shadow-none md:flex"
          >
            Vysvědčení – grafy
          </TabsTrigger>
        )}
      </TabsList>
      {enabledTabSet.has("lodicky") && (
        <TabsContent value="lodicky" className="mt-0 space-y-4">
          <div className="mt-4 rounded-xl border border-[#0E2A5C] bg-white p-4">
            <div className="flex flex-wrap gap-4">
              <FilterSelect label="Předmět" value={f1Predmet} options={tab1Filters.predmet} onChange={setF1Predmet} />
              <FilterSelect label="Podpředmět" value={f1Podpredmet} options={tab1Filters.podpredmet} onChange={setF1Podpredmet} />
              <FilterSelect label="Oblast" value={f1Oblast} options={tab1Filters.oblast} onChange={setF1Oblast} />
              <FilterSelect label="Lodička" value={f1Lodicka} options={tab1Filters.lodicka} onChange={setF1Lodicka} />
              <FilterSelect label="Stav" value={f1Stav} options={tab1Filters.stav} onChange={setF1Stav} />
            </div>
          </div>
          <CollapsibleLodickyTable rows={lodickyFiltered} columns={TAB1_COLUMNS} />
        </TabsContent>
      )}
      {enabledTabSet.has("lodicky-po-plavbach") && (
        <TabsContent value="lodicky-po-plavbach" className="mt-0 space-y-4">
          <div className="mt-4 rounded-xl border border-[#0E2A5C] bg-white p-4">
            <div className="flex flex-wrap gap-4">
              <FilterSelect label="Předmět" value={f2Predmet} options={tab2Filters.predmet} onChange={setF2Predmet} />
              <FilterSelect label="Podpředmět" value={f2Podpredmet} options={tab2Filters.podpredmet} onChange={setF2Podpredmet} />
              <FilterSelect label="Oblast" value={f2Oblast} options={tab2Filters.oblast} onChange={setF2Oblast} />
              <FilterSelect label="Lodička" value={f2Lodicka} options={tab2Filters.lodicka} onChange={setF2Lodicka} />
            </div>
          </div>
          <CollapsibleLodickyTable rows={lodickyPoPlavbachFiltered} columns={TAB2_COLUMNS} />
        </TabsContent>
      )}
      {enabledTabSet.has("vysvedceni") && (
        <TabsContent value="vysvedceni" className="mt-0 space-y-8">
          {vysvedceniLoading && (
            <SailboatLoading message="Načítám vysvědčení…" />
          )}
          {vysvedceniError && !vysvedceniLoading && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
              {vysvedceniError}
            </div>
          )}
          {!vysvedceniLoading && !vysvedceniError && (
            <>
              <section>
                <h3 className="text-lg font-semibold mb-3">Hodnocení předmětů</h3>
                <DataTable rows={hodnoceniPredmetu} columns={TAB3_COLUMNS} />
              </section>
              <section>
                <h3 className="text-lg font-semibold mb-3">Hodnocení oblastí</h3>
                <DataTable rows={hodnoceniOblasti} columns={TAB4_COLUMNS} />
              </section>
            </>
          )}
        </TabsContent>
      )}
      {enabledTabSet.has("vysvedceni-grafy") && (
        <TabsContent value="vysvedceni-grafy" className="mt-0 hidden md:block">
          <VysvedceniGrafy childId={childId} childName={_childName} />
        </TabsContent>
      )}
    </Tabs>
  );
}
