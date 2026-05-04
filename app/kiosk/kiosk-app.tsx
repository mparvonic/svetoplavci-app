"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KioskChild, KioskOstrov, KioskTermGroup } from "@/src/lib/kiosk";
import { SimpleMarkdown } from "@/components/ui/simple-markdown";

const INACTIVITY_MS = 30_000;
const API_KEY_PARAM = "k";
const API_KEY_STORAGE = "kiosk_api_key";
const SCAN_SUBMIT_DELAY_MS = 120;
const DEV_BYPASS_CHILD_STORAGE = "kiosk_dev_child_id";

type DevBypassChild = {
  id: string;
  displayName: string;
  legalName: string;
};

function formatTermDate(value: string): string {
  const raw = value.trim();
  if (!raw) return value;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTermTimeFrom(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Prague",
  }).format(date);
}

function formatTermLabel(termDate: string, termStartsAt: string | null | undefined): string {
  const datePart = formatTermDate(termDate);
  const timePart = formatTermTimeFrom(termStartsAt);
  return timePart ? `${datePart} od ${timePart}` : datePart;
}

function getStoredKey(): string {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get(API_KEY_PARAM);
  if (fromUrl) {
    sessionStorage.setItem(API_KEY_STORAGE, fromUrl);
    const url = new URL(window.location.href);
    url.searchParams.delete(API_KEY_PARAM);
    window.history.replaceState({}, "", url.toString());
    return fromUrl;
  }
  return sessionStorage.getItem(API_KEY_STORAGE) ?? "";
}

async function apiPost<T>(path: string, body: unknown, key: string): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-kiosk-key": key },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: { error?: string } = {};
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string };
    } catch {
      data = {};
    }
  }

  if (!res.ok) throw new Error(data.error ?? `Chyba serveru (HTTP ${res.status})`);
  return data as T;
}

async function apiDelete<T>(path: string, body: unknown, key: string): Promise<T> {
  const res = await fetch(path, {
    method: "DELETE",
    headers: { "content-type": "application/json", "x-kiosk-key": key },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: { error?: string } = {};
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string };
    } catch {
      data = {};
    }
  }

  if (!res.ok) throw new Error(data.error ?? `Chyba serveru (HTTP ${res.status})`);
  return data as T;
}

function ScreenMessage({
  title,
  subtitle,
  accent,
  spinner = false,
}: {
  title: string;
  subtitle?: string;
  accent: "blue" | "red" | "green";
  spinner?: boolean;
}) {
  const accentClasses = {
    blue: "border-sky-300/40 bg-sky-400/10 text-sky-100",
    red: "border-rose-300/50 bg-rose-500/10 text-rose-100",
    green: "border-emerald-300/50 bg-emerald-500/10 text-emerald-100",
  };

  return (
    <div className="flex h-full items-center justify-center px-16">
      <div className={`w-full max-w-[760px] rounded-[28px] border px-10 py-12 text-center shadow-2xl ${accentClasses[accent]}`}>
        {spinner ? (
          <div className="mx-auto mb-7 h-16 w-16 animate-spin rounded-full border-[6px] border-current border-t-transparent" />
        ) : (
          <div className="mx-auto mb-6 h-4 w-24 rounded-full bg-white/30" />
        )}
        <h2 className="sv-display-sm text-[44px] leading-[1.02] tracking-tight">{title}</h2>
        {subtitle && <p className="mt-4 text-[20px] text-white/80">{subtitle}</p>}
      </div>
    </div>
  );
}

function IslandCard({
  island,
  myIslandId,
  onInfo,
  onRegister,
  onUnregister,
}: {
  island: KioskOstrov;
  myIslandId: string | null;
  onInfo: (island: KioskOstrov) => void;
  onRegister: (island: KioskOstrov) => void;
  onUnregister: (island: KioskOstrov) => void;
}) {
  const isMine = myIslandId === island.id;
  const isFull = island.capacity != null && island.occupied >= island.capacity && !isMine;
  const color = island.kioskDisplayColor ?? "#607D8B";
  const occupancy = island.capacity && island.capacity > 0 ? Math.min(100, Math.round((island.occupied / island.capacity) * 100)) : 0;

  return (
    <article
      className="group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white/15 bg-[#061a40]/95 px-4 py-3 shadow-[0_12px_30px_rgba(2,7,24,0.45)]"
      style={{ boxShadow: `0 12px 30px rgba(2, 7, 24, 0.45), inset 0 0 0 1px ${color}44` }}
    >
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-[40px] opacity-40" style={{ background: `linear-gradient(145deg, ${color}AA, transparent)` }} />

      <div className="relative flex items-start justify-between gap-2">
        <div>
          {island.kioskDisplayNumber != null && (
            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-[18px] font-black text-white" style={{ backgroundColor: color }}>
              {island.kioskDisplayNumber}
            </span>
          )}
          <h3 className="mt-2 line-clamp-2 text-[19px] font-extrabold leading-[1.12] text-white">{island.title}</h3>
        </div>
        {island.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={island.thumbnailUrl} alt="" className="h-12 w-16 rounded-lg object-cover ring-1 ring-white/20" />
        ) : (
          <div className="h-12 w-16 rounded-lg bg-white/8" />
        )}
      </div>

      <div className="mt-2 space-y-1 text-[12px] text-slate-200/90">
        {island.location && <p className="line-clamp-1">Místo: {island.location}</p>}
        {island.guides.length > 0 && <p className="line-clamp-1">Průvodce: {island.guides.join(", ")}</p>}
      </div>

      {island.capacity != null && (
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/70">
            <span>Obsazenost</span>
            <span>
              {island.occupied}/{island.capacity}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/15">
            <div className="h-2 rounded-full" style={{ width: `${occupancy}%`, backgroundColor: color }} />
          </div>
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-3">
        <button
          onClick={() => onInfo(island)}
          className="flex-1 rounded-xl border border-white/20 bg-white/5 py-2 text-[12px] font-semibold text-white/90 transition active:scale-[0.99]"
        >
          Detail
        </button>
        {isMine ? (
          <button
            onClick={() => onUnregister(island)}
            disabled={!island.unregisterOpen}
            className="flex-1 rounded-xl bg-rose-500 py-2 text-[12px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
          >
            Odhlásit
          </button>
        ) : (
          <button
            onClick={() => onRegister(island)}
            disabled={isFull || !island.registrationOpen}
            className="flex-1 rounded-xl py-2 text-[12px] font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-500 disabled:opacity-60 active:scale-[0.99]"
            style={{ backgroundColor: color }}
          >
            {isFull ? "Plno" : "Přihlásit"}
          </button>
        )}
      </div>
    </article>
  );
}

function IslandModal({
  island,
  myIslandId,
  onClose,
  onRegister,
  onUnregister,
}: {
  island: KioskOstrov;
  myIslandId: string | null;
  onClose: () => void;
  onRegister: (island: KioskOstrov) => void;
  onUnregister: (island: KioskOstrov) => void;
}) {
  const isMine = myIslandId === island.id;
  const isFull = island.capacity != null && island.occupied >= island.capacity && !isMine;
  const color = island.kioskDisplayColor ?? "#607D8B";

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#020617]/85 px-10" onClick={onClose}>
      <div
        className="relative grid h-[520px] w-[920px] grid-cols-[1.02fr_1fr] overflow-hidden rounded-[30px] border border-white/15 bg-[#091a3f] shadow-[0_30px_70px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex flex-col overflow-hidden border-r border-white/10 bg-[#0d2554]">
          <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full opacity-30" style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }} />
          <div className="relative px-7 pb-5 pt-7">
            <div className="mb-3 inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-[20px] font-black text-white" style={{ backgroundColor: color }}>
              {island.kioskDisplayNumber ?? "-"}
            </div>
            <h2 className="sv-display-sm text-[38px] leading-[1.03] text-white">{island.title}</h2>
            {island.location && <p className="mt-3 text-[15px] text-slate-200">Místo: {island.location}</p>}
            {island.guides.length > 0 && <p className="mt-1 text-[15px] text-slate-200">Průvodce: {island.guides.join(", ")}</p>}
          </div>
          <div className="relative px-7 pb-7">
            {island.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={island.thumbnailUrl} alt="" className="h-[190px] w-full rounded-2xl object-cover" />
            ) : (
              <div className="h-[190px] w-full rounded-2xl bg-white/10" />
            )}
          </div>
        </div>

        <div className="flex flex-col px-7 pb-6 pt-7">
          {island.description ? (
            <SimpleMarkdown
              text={island.description}
              className="max-h-[250px] space-y-2 overflow-y-auto pr-1 text-[15px] leading-relaxed text-slate-100/90"
              paragraphClassName="leading-relaxed"
              listClassName="space-y-1"
            />
          ) : (
            <p className="text-[15px] text-slate-300">K tomuto ostrovu zatím není detailní popis.</p>
          )}

          <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-4">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">Přihlášení</div>
            {island.registrantNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {island.registrantNames.slice(0, 22).map((name, idx) => (
                  <span
                    key={idx}
                    className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-white"
                    style={{ backgroundColor: `${color}CC` }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-white/70">Zatím nikdo.</p>
            )}
          </div>

          {island.capacity != null && (
            <p className="mt-4 text-[14px] font-semibold text-white/80">
              Obsazenost: {island.occupied}/{island.capacity}
            </p>
          )}

          <div className="mt-auto flex gap-3 pt-5">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/25 bg-white/5 py-3 text-[14px] font-semibold text-white"
            >
              Zavřít
            </button>
            {isMine ? (
              <button
                onClick={() => {
                  onUnregister(island);
                  onClose();
                }}
                disabled={!island.unregisterOpen}
                className="flex-1 rounded-xl bg-rose-500 py-3 text-[14px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                Odhlásit
              </button>
            ) : (
              <button
                onClick={() => {
                  onRegister(island);
                  onClose();
                }}
                disabled={isFull || !island.registrationOpen}
                className="flex-1 rounded-xl py-3 text-[14px] font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-500 disabled:opacity-60"
                style={{ backgroundColor: color }}
              >
                {isFull ? "Plno" : "Přihlásit"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type Screen =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "islands"; child: KioskChild; terms: KioskTermGroup[] }
  | { kind: "success"; message: string };

export function KioskApp() {
  const [screen, setScreen] = useState<Screen>({ kind: "idle" });
  const [activeTerm, setActiveTerm] = useState(0);
  const [modalIsland, setModalIsland] = useState<KioskOstrov | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [devBypassUsers, setDevBypassUsers] = useState<DevBypassChild[]>([]);
  const [devBypassSelectedId, setDevBypassSelectedId] = useState("");
  const [devBypassLoading, setDevBypassLoading] = useState(false);
  const [lastScanDebug, setLastScanDebug] = useState<{
    raw: string;
    compact: string;
    at: string;
  } | null>(null);

  const apiKeyRef = useRef(getStoredKey());
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanSubmitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipBuffer = useRef("");
  const childRef = useRef<KioskChild | null>(null);

  useEffect(() => {
    if (screen.kind === "islands") {
      childRef.current = screen.child;
    }
  }, [screen]);

  const resolveApiKey = useCallback(() => {
    if (!apiKeyRef.current) {
      apiKeyRef.current = getStoredKey();
    }
    return apiKeyRef.current;
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const logout = useCallback(() => {
    setScreen({ kind: "idle" });
    setActiveTerm(0);
    setModalIsland(null);
    chipBuffer.current = "";
    childRef.current = null;
  }, []);

  const resetInactivity = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(logout, INACTIVITY_MS);
  }, [logout]);

  const stopInactivity = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  }, []);

  const stopScanSubmitTimer = useCallback(() => {
    if (scanSubmitTimer.current) clearTimeout(scanSubmitTimer.current);
    scanSubmitTimer.current = null;
  }, []);

  useEffect(() => {
    if (screen.kind === "islands") {
      resetInactivity();
      return () => stopInactivity();
    }
    stopInactivity();
  }, [screen.kind, resetInactivity, stopInactivity]);

  useEffect(() => {
    return () => stopScanSubmitTimer();
  }, [stopScanSubmitTimer]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    let cancelled = false;

    async function loadDevBypassUsers() {
      try {
        const res = await fetch("/api/kiosk/dev-users", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { users?: DevBypassChild[]; selectedId?: string | null };
        if (cancelled) return;

        const users = Array.isArray(body.users) ? body.users : [];
        setDevBypassUsers(users);
        if (users.length === 0) return;

        const storedId = sessionStorage.getItem(DEV_BYPASS_CHILD_STORAGE) ?? "";
        const fallbackId = body.selectedId ?? users[0]?.id ?? "";
        const nextId = users.some((user) => user.id === storedId) ? storedId : fallbackId;
        setDevBypassSelectedId(nextId);
      } catch {
        // Dev helper is optional; ignore load errors.
      }
    }

    void loadDevBypassUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChipSubmit = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;

      if (process.env.NODE_ENV === "development") {
        setLastScanDebug({
          raw: rawCode,
          compact: rawCode.replace(/\s+/g, ""),
          at: new Date().toLocaleTimeString("cs-CZ"),
        });
      }

      setScreen({ kind: "loading", message: "Ověřuji čip..." });
      try {
        const data = await apiPost<{ child: KioskChild; terms: KioskTermGroup[] }>(
          "/api/kiosk/chip",
          { chipCode: code },
          resolveApiKey(),
        );

        if (data.terms.length === 0) {
          const childName = data.child.nickname || data.child.displayName;
          setScreen({
            kind: "success",
            message: `Čip rozpoznán (${childName}), ale momentálně nejsou dostupné žádné ostrovy.`,
          });
          setTimeout(logout, 5000);
          return;
        }

        setActiveTerm(0);
        setScreen({ kind: "islands", child: data.child, terms: data.terms });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Nastala chyba.";
        setScreen({ kind: "error", message: msg });
        setTimeout(logout, 4000);
      }
    },
    [resolveApiKey, logout],
  );

  const handleDevBypassLogin = useCallback(async () => {
    if (!devBypassSelectedId) return;
    setDevBypassLoading(true);
    setScreen({ kind: "loading", message: "Načítám testovacího uživatele..." });
    try {
      const data = await apiPost<{ child: KioskChild; terms: KioskTermGroup[] }>(
        "/api/kiosk/chip",
        { childId: devBypassSelectedId },
        resolveApiKey(),
      );

      sessionStorage.setItem(DEV_BYPASS_CHILD_STORAGE, devBypassSelectedId);

      if (data.terms.length === 0) {
        const childName = data.child.nickname || data.child.displayName;
        setScreen({
          kind: "success",
          message: `Uživatel ${childName} nemá pro tento termín dostupné ostrovy.`,
        });
        setTimeout(logout, 4000);
        return;
      }

      setActiveTerm(0);
      setModalIsland(null);
      setScreen({ kind: "islands", child: data.child, terms: data.terms });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nastala chyba.";
      setScreen({ kind: "error", message: msg });
      setTimeout(logout, 4000);
    } finally {
      setDevBypassLoading(false);
    }
  }, [devBypassSelectedId, logout, resolveApiKey]);

  useEffect(() => {
    const submitFromBuffer = () => {
      const raw = chipBuffer.current.trim();
      chipBuffer.current = "";
      stopScanSubmitTimer();
      if (!raw) return;
      void handleChipSubmit(raw);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (screen.kind === "loading") return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      resetInactivity();

      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        submitFromBuffer();
        return;
      }

      if (e.key === "Backspace") {
        chipBuffer.current = chipBuffer.current.slice(0, -1);
        stopScanSubmitTimer();
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        chipBuffer.current += e.key;
        stopScanSubmitTimer();
        scanSubmitTimer.current = setTimeout(() => submitFromBuffer(), SCAN_SUBMIT_DELAY_MS);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [screen.kind, resetInactivity, handleChipSubmit, stopScanSubmitTimer]);

  const handleRegister = useCallback(
    async (island: KioskOstrov) => {
      if (!childRef.current) return;
      resetInactivity();
      try {
        await apiPost<{ ok: true }>(
          "/api/kiosk/register",
          { childId: childRef.current.id, islandId: island.id },
          resolveApiKey(),
        );
        setScreen({ kind: "success", message: `Přihlášení na "${island.title}" proběhlo úspěšně.` });
        setTimeout(logout, 3000);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Chyba při přihlašování.");
      }
    },
    [resolveApiKey, resetInactivity, logout, showToast],
  );

  const handleUnregister = useCallback(
    async (island: KioskOstrov) => {
      if (!childRef.current) return;
      resetInactivity();
      try {
        await apiDelete<{ ok: true }>(
          "/api/kiosk/register",
          { childId: childRef.current.id, islandId: island.id },
          resolveApiKey(),
        );
        showToast("Byli jste odhlášeni z ostrovu.");

        const refreshData = await apiPost<{ child: KioskChild; terms: KioskTermGroup[] }>(
          "/api/kiosk/chip",
          { childId: childRef.current.id },
          resolveApiKey(),
        ).catch(() => null);

        if (refreshData?.terms) {
          setScreen((prev) => (prev.kind === "islands" ? { ...prev, terms: refreshData.terms } : prev));
          return;
        }

        setScreen((prev) => {
          if (prev.kind !== "islands") return prev;
          return {
            ...prev,
            terms: prev.terms.map((term) => ({
              ...term,
              myRegistrationId: term.myRegistrationId === island.id ? null : term.myRegistrationId,
              islands: term.islands.map((isl) =>
                isl.id === island.id
                  ? { ...isl, myRegistrationId: null, occupied: Math.max(0, isl.occupied - 1) }
                  : isl,
              ),
            })),
          };
        });
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Chyba při odhlašování.");
      }
    },
    [resolveApiKey, resetInactivity, showToast],
  );

  const currentTerms = screen.kind === "islands" ? screen.terms : [];
  const activeTGroup = currentTerms[activeTerm] ?? currentTerms[0];

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#041236] text-white select-none"
      onPointerMove={screen.kind === "islands" ? resetInactivity : undefined}
    >
      <div className="pointer-events-none absolute -left-20 -top-24 h-[380px] w-[380px] rounded-full bg-[#2b6e8a]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-[320px] w-[320px] rounded-full bg-[#c68a2d]/25 blur-3xl" />

      {screen.kind === "idle" && (
        <div className="relative grid h-full grid-cols-[1.12fr_0.88fr] gap-5 p-8">
          <section className="relative overflow-hidden rounded-[30px] border border-white/12 bg-[#071c46]/95 p-10 shadow-2xl">
            <div className="mb-6 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#a9c7ff]">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#7cd3ff]" />
              Kiosk Ostrovy
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/svetoplavci_logo.png" alt="Světoplavci" className="mb-7 h-auto w-[170px]" />

            <h1 className="sv-display-md text-[74px] leading-[0.92] text-white">
              Přilož čip
              <br />
              <span className="text-[#b7d7ff]">a vyber ostrov</span>
            </h1>
            <p className="mt-6 max-w-[540px] text-[22px] leading-[1.3] text-white/78">
              Přihlášení trvá jen pár sekund. Po načtení čipu se hned zobrazí dostupné ostrovy.
            </p>

          </section>

          <section className="relative flex flex-col justify-between rounded-[30px] border border-white/12 bg-[#0b275d]/95 p-9 shadow-2xl">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#98b8ee]">Jak to funguje</p>
              <ol className="mt-5 space-y-4 text-[21px] font-semibold leading-[1.25] text-white/92">
                <li>1. Přilož čip ke čtečce.</li>
                <li>2. Vyber ostrov.</li>
                <li>3. Potvrď tlačítkem Přihlásit.</li>
              </ol>
            </div>

            <div className="relative mt-8 rounded-3xl border border-white/15 bg-[#071b45] p-6">
              <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[#7cd3ff]/25" />
              <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#7cd3ff] bg-[#0d2f67] text-[13px] font-bold uppercase tracking-[0.14em] text-[#d2e7ff]">
                ČIP
              </div>
              <p className="mt-4 text-center text-[15px] font-medium text-white/75">Čtečka je aktivní a připravená.</p>
            </div>

            {process.env.NODE_ENV === "development" && devBypassUsers.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-300/35 bg-amber-100/10 p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-amber-100">Dev bypass</p>
                <p className="mt-1 text-[13px] text-amber-100/80">Testovací vstup bez čipu (jen localhost dev).</p>
                <div className="mt-3 flex gap-2">
                  <select
                    value={devBypassSelectedId}
                    onChange={(event) => setDevBypassSelectedId(event.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-white/20 bg-[#0d2f67] px-3 text-[13px] text-white outline-none"
                  >
                    {devBypassUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleDevBypassLogin()}
                    disabled={!devBypassSelectedId || devBypassLoading}
                    className="rounded-xl bg-amber-400 px-4 text-[13px] font-bold text-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Přepnout
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {screen.kind === "loading" && (
        <ScreenMessage title="Načítám" subtitle={screen.message} accent="blue" spinner />
      )}

      {screen.kind === "error" && (
        <ScreenMessage title="Nepodařilo se pokračovat" subtitle={`${screen.message} Za chvíli to zkusíme znovu.`} accent="red" />
      )}

      {screen.kind === "success" && (
        <ScreenMessage title="Hotovo" subtitle={screen.message} accent="green" />
      )}

      {screen.kind === "islands" && activeTGroup && (
        <div className="relative flex h-full gap-5 p-5">
          <aside className="flex w-[290px] flex-col rounded-[26px] border border-white/12 bg-[#081f4d]/95 p-5 shadow-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#9ec1fa]">Přihlášený</p>
            <h2 className="mt-2 text-[34px] font-extrabold leading-[1.03] text-white">
              {screen.child.nickname || screen.child.displayName}
            </h2>
            <p className="mt-2 text-[14px] text-white/70">Vyber ostrov pro tento termín.</p>

            <div className="mt-6 space-y-2">
              {currentTerms.map((term, idx) => (
                <button
                  key={term.termId}
                  onClick={() => {
                    setActiveTerm(idx);
                    resetInactivity();
                  }}
                  className="w-full rounded-xl border px-3 py-2.5 text-left text-[14px] font-semibold transition"
                  style={{
                    borderColor: idx === activeTerm ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)",
                    backgroundColor: idx === activeTerm ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                    color: idx === activeTerm ? "#FFFFFF" : "rgba(255,255,255,0.72)",
                  }}
                >
                  {formatTermDate(term.termDate)}
                </button>
              ))}
            </div>

            {process.env.NODE_ENV === "development" && devBypassUsers.length > 0 && (
              <div className="mt-4 space-y-2 rounded-xl border border-amber-300/30 bg-amber-100/10 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100">Dev přepínač uživatele</p>
                <select
                  value={devBypassSelectedId}
                  onChange={(event) => setDevBypassSelectedId(event.target.value)}
                  className="h-9 w-full rounded-lg border border-white/20 bg-[#0d2f67] px-2 text-[12px] text-white outline-none"
                >
                  {devBypassUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleDevBypassLogin()}
                  disabled={!devBypassSelectedId || devBypassLoading}
                  className="w-full rounded-lg bg-amber-400 py-1.5 text-[12px] font-bold text-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Přepnout bez čipu
                </button>
              </div>
            )}

            <div className="mt-auto space-y-3 pt-6">
              <button
                onClick={logout}
                className="w-full rounded-xl border border-white/20 bg-white/8 py-3 text-[14px] font-bold text-white"
              >
                Odhlásit se
              </button>
              <p className="text-center text-[12px] text-white/55">Po 30 sekundách nečinnosti se kiosk automaticky odhlásí.</p>
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col rounded-[26px] border border-white/12 bg-[#061a43]/95 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9ec1fa]">Dostupné ostrovy</p>
                <h3 className="sv-display-sm mt-1 text-[44px] leading-[0.95] text-white">
                  {formatTermLabel(activeTGroup.termDate, activeTGroup.termStartsAt)}
                </h3>
              </div>
              <div className="rounded-full border border-white/20 bg-white/8 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/80">
                {activeTGroup.islands.length} možností
              </div>
            </div>

            {activeTGroup.islands.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 text-[22px] text-white/72">
                Žádný ostrov není k dispozici.
              </div>
            ) : (
              <div
                className="grid h-full gap-3 overflow-hidden"
                style={{
                  gridTemplateRows: "1fr 1fr",
                  gridTemplateColumns: `repeat(${Math.ceil(activeTGroup.islands.length / 2)}, minmax(0, 1fr))`,
                }}
              >
                {activeTGroup.islands.map((island) => (
                  <IslandCard
                    key={island.id}
                    island={island}
                    myIslandId={activeTGroup.myRegistrationId}
                    onInfo={setModalIsland}
                    onRegister={handleRegister}
                    onUnregister={handleUnregister}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {modalIsland && screen.kind === "islands" && (
        <IslandModal
          island={modalIsland}
          myIslandId={activeTGroup?.myRegistrationId ?? null}
          onClose={() => setModalIsland(null)}
          onRegister={handleRegister}
          onUnregister={handleUnregister}
        />
      )}

      {toastMsg && (
        <div className="absolute bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/20 bg-[#091d45] px-5 py-3 text-[14px] font-semibold text-white shadow-2xl">
          {toastMsg}
        </div>
      )}

      {process.env.NODE_ENV === "development" && lastScanDebug && (
        <div className="absolute bottom-4 right-4 z-50 max-w-[520px] rounded-xl border border-white/20 bg-black/55 px-3 py-2 text-[11px] text-white/90 shadow-2xl">
          <div className="font-semibold">DEV scan debug ({lastScanDebug.at})</div>
          <div className="font-mono">raw: {JSON.stringify(lastScanDebug.raw)}</div>
          <div className="font-mono">compact: {JSON.stringify(lastScanDebug.compact)}</div>
          <div className="font-mono">length: {lastScanDebug.raw.length}</div>
        </div>
      )}
    </div>
  );
}
