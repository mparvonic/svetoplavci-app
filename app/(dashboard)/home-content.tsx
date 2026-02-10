"use client";

import { useCallback, useEffect, useState } from "react";
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
  children,
}: {
  parentName: string;
  userEmail?: string;
  children: Child[];
}) {
  const [selectedChildId, setSelectedChildId] = useState<string>(
    children[0]?.rowId ?? ""
  );
  const [tableData, setTableData] = useState<Record<string, CodaRow[]> | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChild = children.find((c) => c.rowId === selectedChildId);

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

  if (children.length === 0) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Přihlášen jako: <span className="font-medium text-foreground">{parentName}</span>
          {userEmail && <span className="text-muted-foreground"> ({userEmail})</span>}
        </p>
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200">
          Nemáte přiřazená žádná děti. Kontaktujte správce, pokud to není v pořádku.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Přihlášen jako: <span className="font-medium text-foreground">{parentName}</span>
          {userEmail && <span className="text-muted-foreground"> ({userEmail})</span>}
        </p>
      </header>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Výsledky dítěte</h1>
        <p className="text-muted-foreground">
          Vyberte dítě a zobrazte jeho výsledky.
        </p>
      </div>

      {children.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="sr-only">Dítě:</span>
          {children.map((c) => (
            <Button
              key={c.rowId}
              type="button"
              variant={selectedChildId === c.rowId ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedChildId(c.rowId)}
            >
              {c.nickname || c.name}
              {c.currentYear || c.group ? ` · ${[c.currentYear, c.group].filter(Boolean).join(" ")}` : ""}
            </Button>
          ))}
        </div>
      )}

      {selectedChild && (
        <>
          <div>
            <h2 className="text-lg font-semibold">{selectedChild.name}</h2>
            <p className="text-sm text-muted-foreground">
              {[selectedChild.currentYear, selectedChild.group].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>

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
