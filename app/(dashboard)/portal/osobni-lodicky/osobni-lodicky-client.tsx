"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Filter, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SailboatLoading } from "@/components/sailboat-loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ProtoDebugPanel,
  createProtoDebugEvent,
  type ProtoDebugEvent,
} from "@/components/proto/proto-debug-panel";

type Child = {
  id: string;
  name: string;
};

type Parent = {
  id: string;
  name: string;
};

type LodickaRow = {
  id: string;
  predmet: string;
  podpredmet: string;
  oblast: string;
  nazevLodicky: string;
  stav: string;
  uspech: string;
  poznamka: string;
  datumStavu: string | null;
};

type ChildrenResponse = {
  parent: Parent;
  userEmail: string | null;
  children: Child[];
};

type LodickyResponse = {
  parent: Parent;
  child: Child;
  lodicky: LodickaRow[];
};

type ViewMode = "po_lodickach" | "po_lidech";

type LodickaRecord = LodickaRow & {
  recordId: string;
  childId: string;
  childName: string;
  lodickaKey: string;
};

type LeftPaneItem = {
  id: string;
  label: string;
  subtitle: string | null;
  count: number;
};

export default function OsobniLodickyClient({ debugEnabled }: { debugEnabled: boolean }) {
  const [childrenData, setChildrenData] = useState<ChildrenResponse | null>(null);
  const [rowsByChild, setRowsByChild] = useState<Record<string, LodickaRow[]>>({});

  const [viewMode, setViewMode] = useState<ViewMode>("po_lodickach");
  const [searchInput, setSearchInput] = useState("");
  const [predmetFilter, setPredmetFilter] = useState<string[]>([]);
  const [podpredmetFilter, setPodpredmetFilter] = useState<string[]>([]);
  const [oblastFilter, setOblastFilter] = useState<string[]>([]);
  const [stavFilter, setStavFilter] = useState<string[]>([]);

  const [selectedLeftItemId, setSelectedLeftItemId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugEvents, setDebugEvents] = useState<ProtoDebugEvent[]>([]);

  const pushDebug = useCallback(
    (event: Omit<ProtoDebugEvent, "id" | "at">) => {
      if (!debugEnabled) return;
      setDebugEvents((prev) => [createProtoDebugEvent(event), ...prev].slice(0, 160));
    },
    [debugEnabled]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoadingChildren(true);
        setLoadingRows(false);
        setWarning(null);
        setError(null);

        const childrenRes = await fetch("/api/m01/my-children", { cache: "no-store" });
        if (!childrenRes.ok) {
          const body = await childrenRes.json().catch(() => ({}));
          throw new Error(body.error ?? "Nepodařilo se načíst děti.");
        }

        const childrenBody = (await childrenRes.json()) as ChildrenResponse;
        if (cancelled) return;

        setChildrenData(childrenBody);
        pushDebug({
          elementId: "API-M01-CHILDREN",
          label: "Načtení dětí",
          action: "load",
          hierarchy: "OSOBNI_LODICKY > INIT",
          payload: `children=${childrenBody.children.length}`,
        });

        if (childrenBody.children.length === 0) {
          setRowsByChild({});
          return;
        }

        setLoadingRows(true);

        const rowResults = await Promise.allSettled(
          childrenBody.children.map(async (child) => {
            const rowsRes = await fetch(`/api/m01/child/${child.id}/lodicky`, {
              cache: "no-store",
            });

            if (!rowsRes.ok) {
              const body = await rowsRes.json().catch(() => ({}));
              throw new Error(body.error ?? `Nepodařilo se načíst lodičky pro ${child.name}.`);
            }

            const rowsBody = (await rowsRes.json()) as LodickyResponse;
            return {
              childId: child.id,
              lodicky: rowsBody.lodicky,
            };
          })
        );

        if (cancelled) return;

        const nextRowsByChild: Record<string, LodickaRow[]> = {};
        let failedCount = 0;

        rowResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            nextRowsByChild[result.value.childId] = result.value.lodicky;
            return;
          }

          failedCount += 1;
          console.error("[portal/osobni-lodicky] load child rows failed", {
            childId: childrenBody.children[index]?.id,
            reason: result.reason,
          });
        });

        setRowsByChild(nextRowsByChild);

        if (failedCount > 0) {
          setWarning(`Nepodařilo se načíst data pro ${failedCount} děti.`);
        }

        const totalRows = Object.values(nextRowsByChild).reduce((sum, rows) => sum + rows.length, 0);
        pushDebug({
          elementId: "API-M01-LODICKY-BULK",
          label: "Načtení osobních lodiček",
          action: "load",
          hierarchy: "OSOBNI_LODICKY > INIT",
          payload: `children=${childrenBody.children.length}; rows=${totalRows}; failed=${failedCount}`,
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Nepodařilo se načíst osobní lodičky.");
      } finally {
        if (cancelled) return;
        setLoadingRows(false);
        setLoadingChildren(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [pushDebug]);

  const allRecords = useMemo<LodickaRecord[]>(() => {
    if (!childrenData) return [];

    const childNameById = new Map(childrenData.children.map((child) => [child.id, child.name]));

    return Object.entries(rowsByChild).flatMap(([childId, rows]) =>
      rows.map((row) => ({
        ...row,
        recordId: `${childId}:${row.id}`,
        childId,
        childName: childNameById.get(childId) ?? childId,
        lodickaKey: [row.nazevLodicky, row.predmet, row.podpredmet, row.oblast].join("|"),
      }))
    );
  }, [childrenData, rowsByChild]);

  const options = useMemo(
    () => ({
      predmety: uniqueSorted(allRecords.map((row) => row.predmet)),
      podpredmety: uniqueSorted(allRecords.map((row) => row.podpredmet)),
      oblasti: uniqueSorted(allRecords.map((row) => row.oblast)),
      stavy: uniqueSorted(allRecords.map((row) => row.stav)),
    }),
    [allRecords]
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchInput);

    return allRecords.filter((row) => {
      if (predmetFilter.length > 0 && !predmetFilter.includes(row.predmet)) return false;
      if (podpredmetFilter.length > 0 && !podpredmetFilter.includes(row.podpredmet)) return false;
      if (oblastFilter.length > 0 && !oblastFilter.includes(row.oblast)) return false;
      if (stavFilter.length > 0 && !stavFilter.includes(row.stav)) return false;

      if (!normalizedSearch) return true;

      const haystack = normalizeSearch(
        [
          row.childName,
          row.predmet,
          row.podpredmet,
          row.oblast,
          row.nazevLodicky,
          row.stav,
          row.uspech,
          row.poznamka,
        ].join(" ")
      );

      return haystack.includes(normalizedSearch);
    });
  }, [
    allRecords,
    searchInput,
    predmetFilter,
    podpredmetFilter,
    oblastFilter,
    stavFilter,
  ]);

  const leftPaneItems = useMemo<LeftPaneItem[]>(() => {
    if (viewMode === "po_lodickach") {
      const map = new Map<string, LeftPaneItem>();

      filteredRecords.forEach((row) => {
        const existing = map.get(row.lodickaKey);
        if (existing) {
          existing.count += 1;
          return;
        }

        const subtitleParts = [row.predmet];
        if (row.podpredmet !== "—") subtitleParts.push(row.podpredmet);
        subtitleParts.push(row.oblast);

        map.set(row.lodickaKey, {
          id: row.lodickaKey,
          label: row.nazevLodicky,
          subtitle: subtitleParts.join(" · "),
          count: 1,
        });
      });

      return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "cs"));
    }

    const map = new Map<string, LeftPaneItem>();

    filteredRecords.forEach((row) => {
      const existing = map.get(row.childId);
      if (existing) {
        existing.count += 1;
        return;
      }

      map.set(row.childId, {
        id: row.childId,
        label: row.childName,
        subtitle: null,
        count: 1,
      });
    });

    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "cs"));
  }, [filteredRecords, viewMode]);

  useEffect(() => {
    setSelectedLeftItemId((prev) => {
      if (prev && leftPaneItems.some((item) => item.id === prev)) return prev;
      return leftPaneItems[0]?.id ?? null;
    });
  }, [leftPaneItems]);

  const rightPaneRows = useMemo(() => {
    if (!selectedLeftItemId) return [];

    const rows =
      viewMode === "po_lodickach"
        ? filteredRecords.filter((row) => row.lodickaKey === selectedLeftItemId)
        : filteredRecords.filter((row) => row.childId === selectedLeftItemId);

    return [...rows].sort((a, b) => {
      if (viewMode === "po_lodickach") {
        const byChild = a.childName.localeCompare(b.childName, "cs");
        if (byChild !== 0) return byChild;
      }

      const byLodicka = a.nazevLodicky.localeCompare(b.nazevLodicky, "cs");
      if (byLodicka !== 0) return byLodicka;

      return a.oblast.localeCompare(b.oblast, "cs");
    });
  }, [filteredRecords, selectedLeftItemId, viewMode]);

  useEffect(() => {
    setSelectedRecordId((prev) => {
      if (prev && rightPaneRows.some((row) => row.recordId === prev)) return prev;
      return rightPaneRows[0]?.recordId ?? null;
    });
  }, [rightPaneRows]);

  const selectedRecord = useMemo(
    () => rightPaneRows.find((row) => row.recordId === selectedRecordId) ?? null,
    [rightPaneRows, selectedRecordId]
  );

  const isLoading = loadingChildren || loadingRows;

  const hasActiveFilters =
    searchInput.trim().length > 0 ||
    predmetFilter.length > 0 ||
    podpredmetFilter.length > 0 ||
    oblastFilter.length > 0 ||
    stavFilter.length > 0;

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setPredmetFilter([]);
    setPodpredmetFilter([]);
    setOblastFilter([]);
    setStavFilter([]);
    pushDebug({
      elementId: "BTN-CLEAR-FILTERS",
      label: "Vymazat filtry",
      action: "clear-filters",
      hierarchy: "OSOBNI_LODICKY > FILTERS",
    });
  }, [pushDebug]);

  const parentName = childrenData?.parent.name ?? "—";
  const childrenCount = childrenData?.children.length ?? 0;
  const recordsCount = allRecords.length;

  return (
    <div className="space-y-4 pb-32">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">Osobní lodičky</p>
        <h1 className="text-2xl font-semibold text-[#05204A]">Kompaktní přehled osobních lodiček</h1>
        <p className="text-sm text-slate-600">
          Proto layout je napojený na testovací DB data. Pohled můžeš přepnout po lodičkách nebo po dětech.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge className="bg-[#F2F7FF] text-[#0A4DA6] hover:bg-[#F2F7FF]">Rodič: {parentName}</Badge>
          <Badge className="bg-[#F8FAFC] text-slate-700 hover:bg-[#F8FAFC]">Dětí: {childrenCount}</Badge>
          <Badge className="bg-[#F8FAFC] text-slate-700 hover:bg-[#F8FAFC]">Osobních lodiček: {recordsCount}</Badge>
        </div>
      </header>

      <Card className="border-[#D9E4F2]">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-[#05204A]">Řízení pohledu a filtry</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[#D9E4F2]"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Vymazat filtry
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <SegmentControl
              label="Pohled"
              value={viewMode}
              options={[
                { id: "po_lodickach", label: "Po lodičkách" },
                { id: "po_lidech", label: "Po dětech" },
              ]}
              onChange={(nextValue) => {
                if (nextValue !== "po_lodickach" && nextValue !== "po_lidech") return;
                setViewMode(nextValue);
                pushDebug({
                  elementId: "SEG-VIEW",
                  label: "Přepnutí pohledu",
                  action: "change-view",
                  hierarchy: "OSOBNI_LODICKY > TOP_BAR",
                  payload: `view=${nextValue}`,
                });
              }}
            />

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Vyhledávání</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-[#0A4DA6]" />
                <Input
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    pushDebug({
                      elementId: "INP-SEARCH",
                      label: "Filtr lodiček",
                      action: "filter",
                      hierarchy: "OSOBNI_LODICKY > FILTERS",
                      payload: `query=${event.target.value}`,
                    });
                  }}
                  className="pl-9 pr-9"
                  placeholder={
                    viewMode === "po_lodickach"
                      ? "Vyhledat lodičku, dítě nebo oblast"
                      : "Vyhledat dítě nebo lodičku"
                  }
                />
                {searchInput.trim().length > 0 && (
                  <button
                    type="button"
                    className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    onClick={() => setSearchInput("")}
                    title="Vymazat vyhledávání"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 min-[1180px]:grid-cols-2">
            <FilterPills
              label="Předmět"
              icon={<Filter className="size-3.5" />}
              options={options.predmety}
              selected={predmetFilter}
              onToggle={(value) => setPredmetFilter((prev) => toggleValue(prev, value))}
            />
            <FilterPills
              label="Podpředmět"
              options={options.podpredmety}
              selected={podpredmetFilter}
              onToggle={(value) => setPodpredmetFilter((prev) => toggleValue(prev, value))}
            />
            <FilterPills
              label="Oblast"
              options={options.oblasti}
              selected={oblastFilter}
              onToggle={(value) => setOblastFilter((prev) => toggleValue(prev, value))}
            />
            <FilterPills
              label="Stav"
              options={options.stavy}
              selected={stavFilter}
              onToggle={(value) => setStavFilter((prev) => toggleValue(prev, value))}
            />
          </div>
        </CardContent>
      </Card>

      {warning && (
        <div className="rounded-lg border border-[#DA0100]/35 bg-[#FFF6F6] px-3 py-2 text-sm text-[#A30F15]">
          {warning}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[#DA0100]/35 bg-[#FFF6F6] px-3 py-2 text-sm text-[#A30F15]">
          {error}
        </div>
      )}

      {isLoading ? (
        <Card className="border-[#D9E4F2]">
          <CardContent className="py-12">
            <SailboatLoading message="Načítám osobní lodičky…" />
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 min-[1180px]:grid-cols-[minmax(0,0.32fr)_minmax(0,0.44fr)_minmax(0,0.24fr)]">
          <Card className="border-[#D9E4F2] min-[1180px]:max-h-[65vh] min-[1180px]:overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-[#05204A]">{viewMode === "po_lodickach" ? "Lodičky" : "Děti"}</CardTitle>
            </CardHeader>
            <CardContent className="min-[1180px]:h-[calc(65vh-76px)] min-[1180px]:overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{viewMode === "po_lodickach" ? "Název" : "Jméno"}</TableHead>
                    <TableHead className="text-right">Počet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leftPaneItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="py-8 text-center text-slate-500">
                        Žádná data pro zvolený filtr.
                      </TableCell>
                    </TableRow>
                  )}
                  {leftPaneItems.map((item) => {
                    const selected = selectedLeftItemId === item.id;
                    return (
                      <TableRow
                        key={item.id}
                        className={selected ? "bg-[#F2F7FF]" : undefined}
                        onClick={() => {
                          setSelectedLeftItemId(item.id);
                          pushDebug({
                            elementId: `LEFT-${item.id}`,
                            label: item.label,
                            action: "select-left",
                            tableId: "T321",
                            rowId: item.id,
                            hierarchy: "OSOBNI_LODICKY > LEFT",
                          });
                        }}
                      >
                        <TableCell>
                          <p className="font-medium text-[#05204A]">{item.label}</p>
                          {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-[#05204A]">{item.count}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-[#D9E4F2] min-[1180px]:max-h-[65vh] min-[1180px]:overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-[#05204A]">
                {viewMode === "po_lodickach" ? "Děti pro vybranou lodičku" : "Lodičky vybraného dítěte"}
              </CardTitle>
            </CardHeader>
            <CardContent className="min-[1180px]:h-[calc(65vh-76px)] min-[1180px]:overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{viewMode === "po_lodickach" ? "Dítě" : "Lodička"}</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead>Úspěch</TableHead>
                    <TableHead className="text-right">Datum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rightPaneRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                        Pravý panel je prázdný. Vyber položku vlevo nebo uprav filtry.
                      </TableCell>
                    </TableRow>
                  )}
                  {rightPaneRows.map((row) => {
                    const selected = selectedRecordId === row.recordId;
                    return (
                      <TableRow
                        key={row.recordId}
                        className={selected ? "bg-[#F2F7FF]" : undefined}
                        onClick={() => {
                          setSelectedRecordId(row.recordId);
                          pushDebug({
                            elementId: `RIGHT-${row.recordId}`,
                            label: viewMode === "po_lodickach" ? row.childName : row.nazevLodicky,
                            action: "select-right",
                            tableId: "T322",
                            rowId: row.recordId,
                            hierarchy: "OSOBNI_LODICKY > RIGHT",
                          });
                        }}
                      >
                        <TableCell>
                          <p className="font-medium text-[#05204A]">
                            {viewMode === "po_lodickach" ? row.childName : row.nazevLodicky}
                          </p>
                          {viewMode === "po_lodickach" ? (
                            <p className="text-xs text-slate-500">
                              {row.predmet} · {row.oblast}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500">{row.oblast}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(row.stav)}>{row.stav}</Badge>
                        </TableCell>
                        <TableCell>{row.uspech}</TableCell>
                        <TableCell className="text-right text-xs text-slate-600">{formatDateCz(row.datumStavu)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-[#D9E4F2] min-[1180px]:max-h-[65vh] min-[1180px]:overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-[#05204A]">Detail osobní lodičky</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 min-[1180px]:h-[calc(65vh-76px)] min-[1180px]:overflow-auto">
              {!selectedRecord ? (
                <p className="rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-600">
                  Vyber řádek ve středním panelu.
                </p>
              ) : (
                <>
                  <div className="rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Dítě</p>
                    <p className="text-sm font-semibold text-[#05204A]">{selectedRecord.childName}</p>
                  </div>
                  <InfoRow label="Název lodičky" value={selectedRecord.nazevLodicky} />
                  <InfoRow label="Předmět" value={selectedRecord.predmet} />
                  <InfoRow label="Podpředmět" value={selectedRecord.podpredmet} />
                  <InfoRow label="Oblast" value={selectedRecord.oblast} />
                  <InfoRow label="Stav" value={selectedRecord.stav} />
                  <InfoRow label="Úspěch" value={selectedRecord.uspech} />
                  <InfoRow label="Poznámka" value={selectedRecord.poznamka} />
                  <InfoRow label="Datum posledního stavu" value={formatDateCz(selectedRecord.datumStavu)} />
                </>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {debugEnabled && <ProtoDebugPanel events={debugEvents} onClear={() => setDebugEvents([])} />}
    </div>
  );
}

function SegmentControl({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="inline-flex rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] p-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              option.id === value ? `bg-[#002060] text-white hover:bg-[#001540] shadow-sm` : "text-slate-700 hover:bg-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterPills({
  label,
  options,
  selected,
  onToggle,
  icon,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  icon?: ReactNode;
}) {
  return (
    <div className="space-y-1.5 rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {icon}
        {label}
      </p>

      {options.length === 0 ? (
        <p className="text-xs text-slate-500">Bez hodnot</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => onToggle(option)}
                className={`rounded-lg border px-2 py-1 text-xs ${
                  isSelected
                    ? "border-[#002060] bg-[#002060] text-white"
                    : "border-[#CFE0F7] bg-white text-slate-700 hover:bg-[#EFF4FF]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D9E4F2] bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="text-sm text-slate-700">{value || "—"}</p>
    </div>
  );
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "cs"));
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function statusBadgeClass(stav: string): string {
  const normalized = normalizeSearch(stav);
  if (normalized.includes("samostat")) {
    return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
  }
  if (normalized.includes("rozprac")) {
    return "bg-amber-100 text-amber-800 hover:bg-amber-100";
  }
  if (normalized.includes("nezah")) {
    return "bg-slate-100 text-slate-700 hover:bg-slate-100";
  }
  return "bg-[#EAF2FF] text-[#0A4DA6] hover:bg-[#EAF2FF]";
}

function formatDateCz(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}
