"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ChildDetailTabs } from "@/app/(dashboard)/portal/dite/[childId]/child-detail-tabs";
import { Button } from "@/components/ui/button";
import { SailboatLoading } from "@/components/sailboat-loading";
import type { CodaRow } from "@/src/lib/coda";

interface Child {
  rowId: string;
  name: string;
  nickname: string;
  rocnik: string;
  currentYear: string;
  group: string;
}

export function HomeContent({
  parentName,
  userEmail,
  childrenList,
}: {
  parentName: string;
  userEmail?: string;
  childrenList: Child[];
}) {
  const [selectedChildId, setSelectedChildId] = useState<string>(
    childrenList[0]?.rowId ?? ""
  );
  const [tableData, setTableData] = useState<Record<string, CodaRow[]> | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChild = childrenList.find((c) => c.rowId === selectedChildId);

  const loadData = useCallback(async (childId: string) => {
    if (!childId) {
      setTableData(null);
      return;
    }
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await fetch(`/api/coda/child/${childId}/data`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Nepodařilo se načíst data");
      }
      const { tableData: data } = await res.json();
      setTableData(data ?? {});
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === "AbortError") {
        setError("Načítání trvalo příliš dlouho. Zkuste to znovu.");
      } else {
        setError(e instanceof Error ? e.message : "Chyba při načítání");
      }
      setTableData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChildId) loadData(selectedChildId);
    else setTableData(null);
  }, [selectedChildId, loadData]);

  if (childrenList.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h1 className="text-xl font-semibold text-[#0E2A5C]">Výsledky dítěte</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Zatím tu nemáte žádné přiřazené dítě. Kontaktujte správce školy, pokud to není v pořádku.
            </p>
          </div>
          <div className="rounded-xl border bg-[#0E2A5C] p-4 text-sm text-white shadow-sm md:col-start-2 md:row-start-1">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-normal opacity-80">Rodič</span>
              <span className="text-base font-semibold">{parentName}</span>
              {userEmail && <span className="text-xs opacity-90">{userEmail}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-[#0E2A5C] bg-card p-4 shadow-sm">
          <h1 className="text-2xl font-bold tracking-normal text-[#0E2A5C]">Výsledky dítěte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vyberte dítě a zobrazte jeho výsledky v přehledných dlaždicích.
          </p>
        </div>
        <div className="rounded-xl border border-[#C8372D] bg-[#C8372D] p-4 text-sm text-white shadow-sm md:col-start-2 md:row-start-1">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-normal opacity-80">Rodič</span>
            <span className="text-base font-semibold">{parentName}</span>
            {userEmail && <span className="text-xs opacity-90">{userEmail}</span>}
          </div>
        </div>
      </div>

      {childrenList.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only">Dítě:</span>
          {childrenList.map((c) => {
            const isSelected = selectedChildId === c.rowId;
            return (
              <Button
                key={c.rowId}
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "flex h-auto flex-col items-start justify-start rounded-xl border px-4 py-3 text-left shadow-sm",
                  isSelected
                    ? "border-[#0E2A5C] bg-[#0E2A5C] text-white hover:bg-[#07173A]"
                    : "border-[#0E2A5C] bg-white text-[#0E2A5C] hover:bg-[#eef2ff]"
                )}
                onClick={() => setSelectedChildId(c.rowId)}
              >
                <span className="text-sm font-semibold">
                  {c.nickname || c.name}
                </span>
                {(c.currentYear || c.group) && (
                  <span className={cn("mt-1 text-xs", isSelected ? "text-white/80" : "text-slate-500")}>
                    {[c.currentYear, c.group].filter(Boolean).join(" · ")}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      )}

      {selectedChild && (
        <>
          {loading && (
            <SailboatLoading message="Načítám lodičky…" />
          )}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && tableData && (
            <ChildDetailTabs
              childId={selectedChildId}
              childName={selectedChild.name}
              tableData={tableData}
            />
          )}
        </>
      )}
    </div>
  );
}
