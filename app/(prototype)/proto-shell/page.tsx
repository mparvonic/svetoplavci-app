"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LODICKA_STAV_LABEL,
  PROTO_AKCE_ROWS,
  PROTO_LODICKA_HISTORY,
  PROTO_LODICKY_ROWS,
  PROTO_ROLES,
  type ProtoLodickaRow,
  type ProtoRoleId,
} from "@/lib/mock/proto-shell";

type MockState = "ready" | "loading" | "error" | "empty" | "readonly";

const MOCK_STATE_LABEL: Record<MockState, string> = {
  ready: "Aktivní mock",
  loading: "Načítání",
  error: "Chyba",
  empty: "Prázdný stav",
  readonly: "Pouze čtení",
};

const STAV_BADGE_CLASS: Record<ProtoLodickaRow["stav"], string> = {
  0: "bg-slate-100 text-slate-700",
  1: "bg-amber-100 text-amber-800",
  2: "bg-blue-100 text-blue-800",
  3: "bg-orange-100 text-orange-800",
  4: "bg-emerald-100 text-emerald-800",
};

export default function ProtoShellPage() {
  const [activeRole, setActiveRole] = useState<ProtoRoleId>("rodic");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [mockState, setMockState] = useState<MockState>("ready");
  const [lodickyRows, setLodickyRows] = useState(PROTO_LODICKY_ROWS);
  const [selectedLodickaId, setSelectedLodickaId] = useState<string | null>(PROTO_LODICKY_ROWS[0]?.id ?? null);
  const [registrations, setRegistrations] = useState<Record<string, boolean>>({});

  const role = useMemo(
    () => PROTO_ROLES.find((item) => item.id === activeRole) ?? PROTO_ROLES[0],
    [activeRole],
  );

  const visibleLodickyRows = useMemo(() => {
    if (mockState === "empty") return [];

    if (activeRole === "dite") {
      return lodickyRows.filter((row) => row.zak === "Kryštof Parvonič");
    }
    if (activeRole === "rodic") {
      return lodickyRows.filter((row) => row.zak.includes("Parvonič"));
    }
    if (activeRole === "spravce_site") {
      return [];
    }
    return lodickyRows;
  }, [activeRole, lodickyRows, mockState]);

  const effectiveSelectedLodickaId = useMemo(() => {
    if (!selectedLodickaId) return visibleLodickyRows[0]?.id ?? null;
    return visibleLodickyRows.some((row) => row.id === selectedLodickaId)
      ? selectedLodickaId
      : visibleLodickyRows[0]?.id ?? null;
  }, [selectedLodickaId, visibleLodickyRows]);

  const selectedLodicka =
    visibleLodickyRows.find((row) => row.id === effectiveSelectedLodickaId) ?? null;

  const selectedHistory = useMemo(
    () =>
      (selectedLodicka
        ? PROTO_LODICKA_HISTORY.filter((event) => event.lodickaId === selectedLodicka.id)
        : []
      ).sort((a, b) => (a.datumStavu === b.datumStavu ? a.zapsanoAt.localeCompare(b.zapsanoAt) : a.datumStavu.localeCompare(b.datumStavu))),
    [selectedLodicka],
  );

  function switchRole(nextRole: ProtoRoleId) {
    setActiveRole(nextRole);
    const next = PROTO_ROLES.find((item) => item.id === nextRole);
    setActiveSection(next?.nav[0]?.id ?? "dashboard");
    setMockState("ready");
    setSelectedLodickaId(null);
  }

  function shiftLodicka(id: string, delta: 1 | -1) {
    if (mockState === "readonly") return;

    setLodickyRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const nextStav = Math.max(0, Math.min(4, row.stav + delta)) as ProtoLodickaRow["stav"];
        return {
          ...row,
          stav: nextStav,
          updatedAt: new Date().toISOString().slice(0, 10),
        };
      }),
    );
  }

  function toggleRegistration(eventId: string) {
    if (mockState === "readonly") return;
    setRegistrations((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
  }

  return (
    <main className="min-h-screen bg-slate-50 py-6">
      <div className="max-w-screen-xl mx-auto px-4 space-y-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-[#002060]">Proto shell aplikace</CardTitle>
                <CardDescription>
                  Klikací kostra pro role, dashboard a referenční obrazovky (lodičky, akce).
                </CardDescription>
              </div>
              <Badge className="bg-[#002060] text-white">{MOCK_STATE_LABEL[mockState]}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PROTO_ROLES.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={item.id === activeRole ? "default" : "outline"}
                  className={item.id === activeRole ? "bg-[#002060] text-white hover:bg-[#001540]" : ""}
                  onClick={() => switchRole(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setMockState("loading")}>
                Načítání
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setMockState("error")}>
                Chyba
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setMockState("empty")}>
                Prázdný stav
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setMockState("readonly")}>
                Read-only
              </Button>
              <Button type="button" size="sm" className="bg-[#002060] text-white hover:bg-[#001540]" onClick={() => setMockState("ready")}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="h-fit border-slate-200">
            <CardHeader className="space-y-1">
              <CardTitle className="text-[#002060] text-lg">{role.label}</CardTitle>
              <CardDescription>{role.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {role.nav.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={item.id === activeSection ? "default" : "ghost"}
                  className={`w-full justify-start ${
                    item.id === activeSection ? "bg-[#002060] text-white hover:bg-[#001540]" : ""
                  }`}
                  onClick={() => setActiveSection(item.id)}
                >
                  <ArrowRight className="size-4" />
                  {item.label}
                </Button>
              ))}
            </CardContent>
          </Card>

          <section className="space-y-6">
            {activeSection === "dashboard" && (
              <div className="grid gap-4 md:grid-cols-3">
                {role.metrics.map((metric) => (
                  <Card key={metric.id} className="border-slate-200">
                    <CardHeader className="pb-2">
                      <CardDescription>{metric.label}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-end justify-between">
                      <div className="text-3xl font-semibold text-[#002060]">{metric.value}</div>
                      {metric.trend === "up" && <ArrowUpRight className="size-5 text-emerald-600" />}
                      {metric.trend === "down" && <ArrowDownRight className="size-5 text-[#DA0100]" />}
                      {metric.trend === "flat" && <ArrowRight className="size-5 text-slate-500" />}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeSection === "lodicky" && (
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-[#002060]">Lodičky (mock)</CardTitle>
                  <CardDescription>
                    Klikací změna stavu je simulace. V režimu read-only jsou akce uzamčené.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mockState === "loading" && (
                    <div className="flex items-center gap-2 rounded-md border border-slate-200 p-4 text-sm text-slate-600">
                      <RefreshCcw className="size-4 animate-spin" />
                      Načítám data lodiček...
                    </div>
                  )}

                  {mockState === "error" && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-[#DA0100]/30 bg-[#DA0100]/5 p-4">
                      <div className="flex items-center gap-2 text-sm text-[#DA0100]">
                        <AlertTriangle className="size-4" />
                        Nepodařilo se načíst data. Toto je simulovaný chybový stav.
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[#002060] text-white hover:bg-[#001540]"
                        onClick={() => setMockState("ready")}
                      >
                        Zkusit znovu
                      </Button>
                    </div>
                  )}

                  {mockState !== "loading" && mockState !== "error" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Žák</TableHead>
                          <TableHead>Předmět</TableHead>
                          <TableHead>Oblast</TableHead>
                          <TableHead>Lodička</TableHead>
                          <TableHead>Stav</TableHead>
                          <TableHead>Garant</TableHead>
                          <TableHead>Aktualizováno</TableHead>
                          <TableHead className="text-right">Akce</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleLodickyRows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                              V této roli není aktuálně žádná lodička k zobrazení.
                            </TableCell>
                          </TableRow>
                        )}
                        {visibleLodickyRows.map((row) => (
                          <TableRow
                            key={row.id}
                            data-state={selectedLodicka?.id === row.id ? "selected" : undefined}
                            className="cursor-pointer"
                            onClick={() => setSelectedLodickaId(row.id)}
                          >
                            <TableCell>{row.zak}</TableCell>
                            <TableCell>{row.predmet}</TableCell>
                            <TableCell>{row.oblast}</TableCell>
                            <TableCell>{row.lodicka}</TableCell>
                            <TableCell>
                              <Badge className={STAV_BADGE_CLASS[row.stav]}>
                                {row.stav} - {LODICKA_STAV_LABEL[row.stav]}
                              </Badge>
                            </TableCell>
                            <TableCell>{row.garant}</TableCell>
                            <TableCell>{row.updatedAt}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  disabled={mockState === "readonly" || row.stav === 0}
                                  onClick={() => shiftLodicka(row.id, -1)}
                                >
                                  -1
                                </Button>
                                <Button
                                  type="button"
                                  size="xs"
                                  className="bg-[#002060] text-white hover:bg-[#001540]"
                                  disabled={mockState === "readonly" || row.stav === 4}
                                  onClick={() => shiftLodicka(row.id, 1)}
                                >
                                  +1
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "lodicky" && mockState !== "loading" && mockState !== "error" && selectedLodicka && (
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-[#002060]">Detail lodičky (mock)</CardTitle>
                  <CardDescription>
                    Náhled detailu a historie změn vybrané osobní lodičky.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <InfoCard label="Žák" value={selectedLodicka.zak} />
                    <InfoCard label="Ročník" value={selectedLodicka.rocnik} />
                    <InfoCard label="Garant" value={selectedLodicka.garant} />
                    <InfoCard
                      label="Aktuální stav"
                      value={`${selectedLodicka.stav} - ${LODICKA_STAV_LABEL[selectedLodicka.stav]}`}
                    />
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum stavu</TableHead>
                        <TableHead>Zapsáno</TableHead>
                        <TableHead>Stav</TableHead>
                        <TableHead>Zapsal</TableHead>
                        <TableHead>Poznámka</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedHistory.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-6 text-center text-slate-500">
                            K této lodičce zatím není historie.
                          </TableCell>
                        </TableRow>
                      )}
                      {selectedHistory.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>{event.datumStavu}</TableCell>
                          <TableCell>{event.zapsanoAt}</TableCell>
                          <TableCell>
                            <Badge className={STAV_BADGE_CLASS[event.stav]}>
                              {event.stav} - {LODICKA_STAV_LABEL[event.stav]}
                            </Badge>
                          </TableCell>
                          <TableCell>{event.zapsal}</TableCell>
                          <TableCell>{event.poznamka ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {activeSection === "akce" && (
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-[#002060]">Akce/Ostrovy (mock)</CardTitle>
                  <CardDescription>
                    Jednoduchý klikací flow zápisu a odhlášení bez API volání.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {PROTO_AKCE_ROWS.map((event) => {
                    const isRegistered = Boolean(registrations[event.id]);
                    const canRegister = event.otevreno || isRegistered;
                    return (
                      <div
                        key={event.id}
                        className="flex flex-col gap-3 rounded-md border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-medium text-[#002060]">{event.nazev}</p>
                          <p className="text-sm text-slate-600">
                            {event.plavba} | {event.datum} | {event.cas} | {event.misto}
                          </p>
                          <p className="text-xs text-slate-500">
                            Kapacita {event.zapsano}/{event.kapacita}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isRegistered && (
                            <Badge className="bg-emerald-100 text-emerald-800">
                              Zapsáno
                            </Badge>
                          )}
                          {!event.otevreno && !isRegistered && (
                            <Badge className="bg-slate-100 text-slate-700">Uzavřeno</Badge>
                          )}
                          <Button
                            type="button"
                            disabled={!canRegister || mockState === "readonly"}
                            className="bg-[#002060] text-white hover:bg-[#001540]"
                            onClick={() => toggleRegistration(event.id)}
                          >
                            {isRegistered ? "Odhlásit" : "Zapsat"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {activeSection !== "dashboard" &&
              activeSection !== "lodicky" &&
              activeSection !== "akce" && (
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-[#002060]">Placeholder sekce</CardTitle>
                    <CardDescription>
                      Tady bude navazující obrazovka pro sekci {role.nav.find((n) => n.id === activeSection)?.label}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center gap-2 text-sm text-slate-600">
                    <ShieldCheck className="size-4" />
                    Sekce je připravená pro další detailní proto návrh.
                  </CardContent>
                </Card>
              )}
          </section>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-[#002060]">{value}</p>
    </div>
  );
}
