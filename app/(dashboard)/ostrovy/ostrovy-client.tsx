"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, UsersRound, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RegistrationStatus = "REGISTERED" | "UNREGISTERED" | "WAITLIST" | "CANCELED_BY_GUIDE";

type RegistrationPolicy = {
  capacity: number | null;
  opensAt: string | null;
  closesAt: string | null;
};

type Child = {
  id: string;
  displayName: string;
  firstName?: string | null;
};

type MyRegistration = {
  personId: string;
  status: RegistrationStatus;
} | null;

type OfferGroup = {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
};

type OstrovEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  lifecycleStatus: string;
  metadata: unknown;
  offerGroup: OfferGroup | null;
  registrationPolicy: RegistrationPolicy | null;
  eligible: boolean;
  occupied: number;
  myRegistration: MyRegistration;
  kioskDisplayNumber: number | null;
  kioskDisplayColor: string | null;
};

type ChildResult = {
  child: Child;
  events: OstrovEvent[];
};

type LoadOptions = {
  showLoading?: boolean;
  includeChildren?: boolean;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function ostrovyMetadata(event: OstrovEvent): Record<string, unknown> {
  const metadata = metadataObject(event.metadata);
  return metadataObject(metadata.ostrovy);
}

function thumbnailUrl(event: OstrovEvent): string {
  const value = ostrovyMetadata(event).thumbnailUrl;
  return typeof value === "string" && value ? `/api/ostrovy/images/${event.id}` : "";
}

function focusLabel(event: OstrovEvent): string | null {
  const value = ostrovyMetadata(event).focus;
  if (value === "pohybovy") return "Pohybový";
  if (value === "vytvarny") return "Výtvarný";
  if (value === "hudebni") return "Hudební";
  if (value === "badatelsky") return "Badatelský";
  if (value === "online-svet") return "Online svět";
  return null;
}

function eventGuides(event: OstrovEvent): string[] {
  const value = ostrovyMetadata(event).guides;
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const guide = item as Record<string, unknown>;
      return typeof guide.name === "string" && guide.name.trim() ? guide.name.trim() : null;
    })
    .filter((value): value is string => Boolean(value));
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return DATE_FORMATTER.format(new Date(value));
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return DATE_TIME_FORMATTER.format(new Date(value));
}

function activeRegistration(registration: MyRegistration): boolean {
  return registration?.status === "REGISTERED" || registration?.status === "WAITLIST";
}

function isRegistrationOpen(event: OstrovEvent, now: Date): boolean {
  const opensAt = event.registrationPolicy?.opensAt ? new Date(event.registrationPolicy.opensAt) : null;
  const closesAt = event.registrationPolicy?.closesAt ? new Date(event.registrationPolicy.closesAt) : null;
  if (opensAt && now < opensAt) return false;
  if (closesAt && now > closesAt) return false;
  return true;
}

function hasCapacity(event: OstrovEvent): boolean {
  const capacity = event.registrationPolicy?.capacity;
  return capacity == null || event.occupied < capacity || activeRegistration(event.myRegistration);
}

function groupEvents(events: OstrovEvent[]) {
  const groups = new Map<string, { id: string; name: string; startsAt: string | null; events: OstrovEvent[] }>();
  for (const event of events) {
    const id = event.offerGroup?.id ?? event.id;
    const current = groups.get(id) ?? {
      id,
      name: event.offerGroup?.name ?? "Termín",
      startsAt: event.offerGroup?.startsAt ?? event.startsAt,
      events: [],
    };
    current.events.push(event);
    groups.set(id, current);
  }
  return [...groups.values()].sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text().catch(() => "");
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = {};
    }
  }
  if (!res.ok) {
    const errorMessage =
      body && typeof body === "object" && "error" in body ? (body as { error?: unknown }).error : null;
    const message = typeof errorMessage === "string" && errorMessage.trim()
      ? errorMessage
      : `Operace se nepodařila (HTTP ${res.status}).`;
    throw new Error(message);
  }
  return body as T;
}

export default function OstrovyClient() {
  const [children, setChildren] = useState<Child[]>([]);
  const [results, setResults] = useState<ChildResult[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [imageErrorIds, setImageErrorIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedResult = results.find((row) => row.child.id === selectedChildId) ?? null;
  const grouped = useMemo(() => groupEvents(selectedResult?.events ?? []), [selectedResult?.events]);
  const now = new Date();

  const load = useCallback(async (childId?: string, options: LoadOptions = {}) => {
    const showLoading = options.showLoading ?? true;
    const includeChildren = options.includeChildren ?? !childId;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (childId) params.set("childId", childId);
      if (!includeChildren) params.set("includeChildren", "0");
      const query = params.size > 0 ? `?${params.toString()}` : "";
      const body = await fetch(`/api/ostrovy/my-children${query}`).then((res) =>
        readJson<{ children: Child[]; result: ChildResult[] }>(res),
      );
      if (includeChildren) setChildren(body.children);
      setResults((current) => {
        const next = new Map(current.map((row) => [row.child.id, row]));
        for (const row of body.result) next.set(row.child.id, row);
        if (!childId) return body.result;
        return [...next.values()];
      });
      setSelectedChildId((current) => {
        if (childId) return childId;
        if (current && body.children.some((child) => child.id === current)) return current;
        return body.result[0]?.child.id ?? body.children[0]?.id ?? current;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se načíst Ostrovy.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  function markImageError(eventId: string) {
    setImageErrorIds((current) => {
      if (current.has(eventId)) return current;
      const next = new Set(current);
      next.add(eventId);
      return next;
    });
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRegistration(event: OstrovEvent, action: "register" | "unregister", allowTransfer: boolean) {
    if (!selectedResult) return;
    setSavingEventId(event.id);
    setMessage(null);
    setError(null);
    try {
      await fetch("/api/ostrovy/my-children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId: selectedResult.child.id,
          eventId: event.id,
          action,
          allowTransfer,
        }),
      }).then((res) => readJson(res));
      setMessage(action === "register" ? "Zápis byl uložen." : "Odhlášení bylo uloženo.");
      void load(selectedResult.child.id, { showLoading: false, includeChildren: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operace se nepodařila.");
    } finally {
      setSavingEventId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#D6DFF0] bg-white p-5 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" />
        Načítám Ostrovy.
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header className="sv-section-header flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="sv-eyebrow text-[#C8372D]">Volitelná výuka</p>
          <h1 className="sv-display-md mt-1 text-[#0E2A5C]">Ostrovy</h1>
          <p className="mt-2 text-sm text-[#4A5A7C]">Nadcházející nabídka a vaše aktuální zápisy.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load(selectedChildId || undefined, { showLoading: false, includeChildren: false })}>
          <RefreshCw />
          Obnovit
        </Button>
      </header>

      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((child) => (
            <Button
              key={child.id}
              type="button"
              variant={selectedResult?.child.id === child.id ? "default" : "outline"}
              className={selectedResult?.child.id === child.id ? "bg-[#0E2A5C] text-white hover:bg-[#07173A]" : ""}
              onClick={() => {
                setSelectedChildId(child.id);
                void load(child.id, { includeChildren: false });
              }}
            >
              {child.firstName || child.displayName}
            </Button>
          ))}
        </div>
      )}

      {!selectedResult && (
        <Card className="border-[#D6DFF0]">
          <CardContent className="py-10 text-center text-sm text-slate-500">
            K účtu není přiřazené žádné dítě.
          </CardContent>
        </Card>
      )}

      {selectedResult && grouped.length === 0 && (
        <Card className="border-[#D6DFF0]">
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Pro {selectedResult.child.firstName || selectedResult.child.displayName} nejsou dostupné žádné nadcházející Ostrovy.
          </CardContent>
        </Card>
      )}

      {selectedResult && grouped.map((group) => {
        const registeredInGroup = group.events.find((event) => activeRegistration(event.myRegistration));
        return (
          <Card key={group.id} className="border-[#D6DFF0]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-[#0E2A5C]">{group.name}</CardTitle>
              <CardDescription>{formatDate(group.startsAt)}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.events.map((event) => {
                const image = imageErrorIds.has(event.id) ? "" : thumbnailUrl(event);
                const isMine = activeRegistration(event.myRegistration);
                const open = isRegistrationOpen(event, now);
                const available = event.eligible && open && hasCapacity(event);
                const canTransfer = available && registeredInGroup && registeredInGroup.id !== event.id;
                const capacityLabel = `${event.occupied}/${event.registrationPolicy?.capacity ?? "bez limitu"}`;
                const guides = eventGuides(event);
                return (
                  <article key={event.id} className="sv-card sv-card-hover flex min-h-[260px] flex-col overflow-hidden">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt=""
                        className="h-28 w-full object-cover"
                        onError={() => markImageError(event.id)}
                      />
                    ) : (
                      <div className="sv-placeholder h-28 min-h-0">
                        Ostrovy
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-3">
                          <h2 className="sv-display text-2xl text-[#0E2A5C]">{event.title}</h2>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {event.kioskDisplayNumber != null && event.kioskDisplayColor && (
                              <span
                                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white"
                                style={{ backgroundColor: event.kioskDisplayColor }}
                                title="Číslo ostrovu pro kiosek"
                              >
                                {event.kioskDisplayNumber}
                              </span>
                            )}
                            {isMine && <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Zapsáno</Badge>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {focusLabel(event) && <Badge variant="outline">{focusLabel(event)}</Badge>}
                          <Badge variant="outline">{capacityLabel}</Badge>
                        </div>
                      </div>
                      {event.description && (
                        <p className="text-sm text-slate-600">{event.description}</p>
                      )}
                      <div className="mt-auto space-y-2 text-xs text-slate-500">
                        <p>{event.location || "Místo bude upřesněno"}</p>
                        <p>Zápis: {formatDateTime(event.registrationPolicy?.opensAt)} - {formatDateTime(event.registrationPolicy?.closesAt)}</p>
                      </div>
                      <div className="space-y-3 rounded-xl border border-[#D6DFF0] bg-[#EEF2F7] p-3 text-sm">
                        <div className="grid gap-2 text-slate-700">
                          <div>
                            <span className="font-medium text-[#0E2A5C]">Kdy: </span>
                            {formatDateTime(event.startsAt)} - {formatDateTime(event.endsAt)}
                          </div>
                          {guides.length > 0 && (
                            <div>
                              <span className="font-medium text-[#0E2A5C]">Průvodci: </span>
                              {guides.join(", ")}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 font-medium text-[#0E2A5C]">
                            <UsersRound className="size-4" />
                            Přihlášení
                          </div>
                          {event.occupied > 0 ? (
                            <p className="text-sm text-slate-600">
                              Přihlášeno: {capacityLabel}
                            </p>
                          ) : (
                            <p className="text-sm text-slate-500">Zatím není nikdo přihlášený.</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isMine ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="border-[#C8372D] text-[#C8372D] hover:bg-[#FAEAE9]"
                            disabled={savingEventId === event.id}
                            onClick={() => void changeRegistration(event, "unregister", false)}
                          >
                            {savingEventId === event.id ? <Loader2 className="animate-spin" /> : <XCircle />}
                            Odhlásit
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            className={cn(
                              "bg-[#0E2A5C] text-white hover:bg-[#07173A]",
                              !available && "opacity-60",
                            )}
                            disabled={!available || savingEventId === event.id}
                            onClick={() => void changeRegistration(event, "register", Boolean(canTransfer))}
                          >
                            {savingEventId === event.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                            {canTransfer ? "Změnit" : "Přihlásit"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
