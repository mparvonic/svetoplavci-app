"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function OsobniLodickyClient({ debugEnabled }: { debugEnabled: boolean }) {
  const [childrenData, setChildrenData] = useState<ChildrenResponse | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [lodickyData, setLodickyData] = useState<LodickyResponse | null>(null);
  const [query, setQuery] = useState("");
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingLodicky, setLoadingLodicky] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugEvents, setDebugEvents] = useState<ProtoDebugEvent[]>([]);

  const pushDebug = useCallback(
    (event: Omit<ProtoDebugEvent, "id" | "at">) => {
      if (!debugEnabled) return;
      setDebugEvents((prev) => [createProtoDebugEvent(event), ...prev].slice(0, 120));
    },
    [debugEnabled]
  );

  useEffect(() => {
    let cancelled = false;

    fetch("/api/m01/my-children")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Nepodařilo se načíst děti.");
        }
        return res.json() as Promise<ChildrenResponse>;
      })
      .then((body) => {
        if (cancelled) return;
        setChildrenData(body);
        const initialChildId = body.children[0]?.id ?? "";
        if (initialChildId) {
          setLoadingLodicky(true);
          setError(null);
          setLodickyData(null);
        }
        setSelectedChildId(initialChildId);
        pushDebug({
          elementId: "API-M01-CHILDREN",
          label: "Načtení dětí",
          action: "load",
          hierarchy: "OSOBNI_LODICKY > INIT",
          payload: `children=${body.children.length}`,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Nepodařilo se načíst děti.");
      })
      .finally(() => {
        if (!cancelled) setLoadingChildren(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pushDebug]);

  useEffect(() => {
    if (!selectedChildId) return;

    let cancelled = false;

    fetch(`/api/m01/child/${selectedChildId}/lodicky`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Nepodařilo se načíst osobní lodičky.");
        }
        return res.json() as Promise<LodickyResponse>;
      })
      .then((body) => {
        if (cancelled) return;
        setLodickyData(body);
        pushDebug({
          elementId: "API-M01-LODICKY",
          label: "Načtení osobních lodiček",
          action: "load",
          hierarchy: "OSOBNI_LODICKY > DETAIL",
          payload: `childId=${selectedChildId}; rows=${body.lodicky.length}`,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Nepodařilo se načíst osobní lodičky.");
      })
      .finally(() => {
        if (!cancelled) setLoadingLodicky(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pushDebug, selectedChildId]);

  const filteredRows = useMemo(() => {
    const rows = lodickyData?.lodicky ?? [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.predmet,
        row.podpredmet,
        row.oblast,
        row.nazevLodicky,
        row.stav,
        row.uspech,
        row.poznamka,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [lodickyData?.lodicky, query]);

  return (
    <div className="space-y-6 pb-28">
      <Card className="border-[#D9E4F2]">
        <CardHeader className="space-y-2">
          <CardTitle className="text-[#002060] font-semibold">Osobní lodičky</CardTitle>
          <p className="text-sm text-slate-600">
            Přehled aktuálních stavů osobních lodiček dětí přiřazených přihlášenému rodiči.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-[#002060]">Rodič: </span>
            {childrenData?.parent.name ?? "—"}
          </div>

          {loadingChildren ? (
            <SailboatLoading message="Načítám děti…" />
          ) : childrenData && childrenData.children.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {childrenData.children.map((child) => {
                const selected = selectedChildId === child.id;
                return (
                  <Button
                    key={child.id}
                    type="button"
                    variant="outline"
                    className={
                      selected
                        ? "justify-start border-[#002060] bg-[#002060] text-white hover:bg-[#001540]"
                        : "justify-start border-[#002060] text-[#002060] hover:bg-[#EFF4FF]"
                    }
                    onClick={() => {
                      setLoadingLodicky(true);
                      setError(null);
                      setLodickyData(null);
                      setSelectedChildId(child.id);
                      pushDebug({
                        elementId: `CHILD-${child.id}`,
                        label: child.name,
                        action: "select-child",
                        hierarchy: "OSOBNI_LODICKY > CHILD_SWITCH",
                      });
                    }}
                  >
                    {child.name}
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-[#D9E4F2] bg-white p-4 text-sm text-slate-600">
              K účtu nejsou přiřazené žádné děti.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#D9E4F2]">
        <CardHeader className="space-y-2">
          <CardTitle className="text-[#002060] font-semibold">
            {lodickyData?.child.name ? `Lodičky dítěte: ${lodickyData.child.name}` : "Lodičky dítěte"}
          </CardTitle>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                pushDebug({
                  elementId: "INP-SEARCH",
                  label: "Filtr lodiček",
                  action: "filter",
                  hierarchy: "OSOBNI_LODICKY > FILTER",
                  payload: `query=${event.target.value}`,
                });
              }}
              className="pl-9"
              placeholder="Hledat podle předmětu, oblasti nebo názvu lodičky"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loadingLodicky ? (
            <SailboatLoading message="Načítám osobní lodičky…" />
          ) : error ? (
            <div className="rounded-md border border-[#DA0100]/40 bg-[#fff1f1] p-4 text-sm text-[#DA0100]">
              {error}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader className="bg-[#002060]">
                  <TableRow>
                    <TableHead className="text-white">Předmět</TableHead>
                    <TableHead className="text-white">Podpředmět</TableHead>
                    <TableHead className="text-white">Oblast</TableHead>
                    <TableHead className="text-white">Název lodičky</TableHead>
                    <TableHead className="text-white">Stav</TableHead>
                    <TableHead className="text-white">Úspěch</TableHead>
                    <TableHead className="text-white">Poznámka</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-500">
                        Žádné lodičky pro aktuální filtr.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((row) => (
                      <TableRow
                        key={row.id}
                        onClick={() =>
                          pushDebug({
                            elementId: `ROW-${row.id}`,
                            label: row.nazevLodicky,
                            action: "open-row",
                            tableId: "T-OSOBNI-LODICKY",
                            rowId: row.id,
                            hierarchy: "OSOBNI_LODICKY > TABLE",
                          })
                        }
                      >
                        <TableCell>{row.predmet}</TableCell>
                        <TableCell>{row.podpredmet}</TableCell>
                        <TableCell>{row.oblast}</TableCell>
                        <TableCell className="font-medium">{row.nazevLodicky}</TableCell>
                        <TableCell>{row.stav}</TableCell>
                        <TableCell>{row.uspech}</TableCell>
                        <TableCell>{row.poznamka}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {debugEnabled && (
        <ProtoDebugPanel events={debugEvents} onClear={() => setDebugEvents([])} />
      )}
    </div>
  );
}
