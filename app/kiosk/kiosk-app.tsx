"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KioskChild, KioskOstrov, KioskTermGroup } from "@/src/lib/kiosk";

// ─── Config ───────────────────────────────────────────────────────────────────

const INACTIVITY_MS = 30_000;
const API_KEY_PARAM = "k";
const API_KEY_STORAGE = "kiosk_api_key";

// ─── API helpers ──────────────────────────────────────────────────────────────

function getStoredKey(): string {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get(API_KEY_PARAM);
  if (fromUrl) {
    sessionStorage.setItem(API_KEY_STORAGE, fromUrl);
    // Clean URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.delete(API_KEY_PARAM);
    window.history.replaceState({}, "", url.toString());
    return fromUrl;
  }
  return sessionStorage.getItem(API_KEY_STORAGE) ?? "";
}

async function apiPost(path: string, body: unknown, key: string) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-kiosk-key": key },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Chyba serveru");
  return data;
}

async function apiDelete(path: string, body: unknown, key: string) {
  const res = await fetch(path, {
    method: "DELETE",
    headers: { "content-type": "application/json", "x-kiosk-key": key },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Chyba serveru");
  return data;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
  const num = island.kioskDisplayNumber;

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl border-4 shadow-lg"
      style={{ borderColor: color }}
    >
      {/* Color header with number */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ backgroundColor: color }}
      >
        {num != null && (
          <span className="text-3xl font-black leading-none text-white drop-shadow">{num}</span>
        )}
        {island.thumbnailUrl ? (
          <img
            src={island.thumbnailUrl}
            alt=""
            className="h-10 w-16 rounded object-cover opacity-90"
          />
        ) : (
          <div className="h-10 w-16 rounded bg-white/20" />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1 bg-white px-3 py-2">
        <div className="line-clamp-2 text-sm font-bold leading-tight text-gray-900">
          {island.title}
        </div>
        {island.location && (
          <div className="text-xs text-gray-500">{island.location}</div>
        )}
        {island.capacity != null && (
          <div className="text-xs text-gray-500">
            {island.occupied}/{island.capacity} míst
          </div>
        )}

        {/* Buttons */}
        <div className="mt-auto flex gap-2 pt-1">
          <button
            onClick={() => onInfo(island)}
            className="flex-1 rounded-lg border border-gray-300 bg-white py-1.5 text-xs font-semibold text-gray-700 active:bg-gray-50"
          >
            Info
          </button>
          {isMine ? (
            <button
              onClick={() => onUnregister(island)}
              disabled={!island.unregisterOpen}
              className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: island.unregisterOpen ? "#E74C3C" : "#9CA3AF" }}
            >
              Odhlásit
            </button>
          ) : (
            <button
              onClick={() => onRegister(island)}
              disabled={isFull || !island.registrationOpen}
              className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: isFull || !island.registrationOpen ? "#9CA3AF" : color }}
            >
              {isFull ? "Plno" : "Zapsat"}
            </button>
          )}
        </div>
      </div>
    </div>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative mx-4 max-w-sm w-full rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4" style={{ backgroundColor: color }}>
          {island.kioskDisplayNumber != null && (
            <span className="text-4xl font-black text-white drop-shadow">
              {island.kioskDisplayNumber}
            </span>
          )}
          <h2 className="flex-1 text-lg font-bold text-white leading-tight">{island.title}</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          {island.thumbnailUrl && (
            <img
              src={island.thumbnailUrl}
              alt=""
              className="w-full h-32 object-cover rounded-xl"
            />
          )}
          {island.description && (
            <p className="text-sm text-gray-700 leading-relaxed">{island.description}</p>
          )}
          {island.location && (
            <div className="text-sm text-gray-500">📍 {island.location}</div>
          )}
          {island.guides.length > 0 && (
            <div className="text-sm text-gray-500">👤 {island.guides.join(", ")}</div>
          )}
          {island.capacity != null && (
            <div className="text-sm text-gray-500">
              Obsazenost: {island.occupied}/{island.capacity}
            </div>
          )}
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700"
          >
            Zavřít
          </button>
          {isMine ? (
            <button
              onClick={() => { onUnregister(island); onClose(); }}
              disabled={!island.unregisterOpen}
              className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: "#E74C3C" }}
            >
              Odhlásit
            </button>
          ) : (
            <button
              onClick={() => { onRegister(island); onClose(); }}
              disabled={isFull || !island.registrationOpen}
              className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: isFull || !island.registrationOpen ? "#9CA3AF" : color }}
            >
              {isFull ? "Plno" : "Zapsat"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────

type Screen =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "islands"; child: KioskChild; terms: KioskTermGroup[] }
  | { kind: "success"; message: string };

export function KioskApp() {
  const [apiKey, setApiKey] = useState("");
  const [screen, setScreen] = useState<Screen>({ kind: "idle" });
  const [activeTerm, setActiveTerm] = useState(0);
  const [modalIsland, setModalIsland] = useState<KioskOstrov | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const chipInputRef = useRef<HTMLInputElement>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipBuffer = useRef("");
  const childRef = useRef<KioskChild | null>(null);
  const termsRef = useRef<KioskTermGroup[]>([]);

  // Keep refs in sync
  if (screen.kind === "islands") {
    childRef.current = screen.child;
    termsRef.current = screen.terms;
  }

  useEffect(() => {
    setApiKey(getStoredKey());
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const logout = useCallback(() => {
    setScreen({ kind: "idle" });
    setActiveTerm(0);
    setModalIsland(null);
    chipBuffer.current = "";
    childRef.current = null;
    termsRef.current = [];
  }, []);

  // Inactivity timer
  const resetInactivity = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(logout, INACTIVITY_MS);
  }, [logout]);

  const stopInactivity = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  }, []);

  // Start/stop inactivity based on screen
  useEffect(() => {
    if (screen.kind === "islands") {
      resetInactivity();
      return () => stopInactivity();
    } else {
      stopInactivity();
    }
  }, [screen.kind, resetInactivity, stopInactivity]);

  // Keep focus on chip input always
  useEffect(() => {
    const focus = () => { chipInputRef.current?.focus(); };
    focus();
    document.addEventListener("click", focus);
    document.addEventListener("touchend", focus);
    return () => {
      document.removeEventListener("click", focus);
      document.removeEventListener("touchend", focus);
    };
  }, []);

  // Chip input handling — accumulate keystrokes, submit on Enter
  const handleChipKey = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (screen.kind === "loading") return;
      resetInactivity();

      if (e.key === "Enter") {
        const code = chipBuffer.current.trim();
        chipBuffer.current = "";
        if (chipInputRef.current) chipInputRef.current.value = "";
        if (!code) return;

        setScreen({ kind: "loading", message: "Ověřuji čip…" });
        try {
          const data = await apiPost("/api/kiosk/chip", { chipCode: code }, apiKey);
          if ((data.terms as KioskTermGroup[]).length === 0) {
            setScreen({ kind: "error", message: "Momentálně nejsou dostupné žádné ostrovy." });
            setTimeout(logout, 4000);
          } else {
            setActiveTerm(0);
            setScreen({ kind: "islands", child: data.child as KioskChild, terms: data.terms as KioskTermGroup[] });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Nastala chyba.";
          setScreen({ kind: "error", message: msg });
          setTimeout(logout, 4000);
        }
      } else {
        chipBuffer.current += e.key;
      }
    },
    [screen.kind, apiKey, resetInactivity, logout],
  );

  const handleRegister = useCallback(
    async (island: KioskOstrov) => {
      if (!childRef.current) return;
      resetInactivity();
      try {
        await apiPost("/api/kiosk/register", { childId: childRef.current.id, islandId: island.id }, apiKey);
        // Auto-logout after register
        setScreen({ kind: "success", message: `Přihlášení na „${island.title}" proběhlo úspěšně!` });
        setTimeout(logout, 3000);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Chyba při přihlašování.");
      }
    },
    [apiKey, resetInactivity, logout, showToast],
  );

  const handleUnregister = useCallback(
    async (island: KioskOstrov) => {
      if (!childRef.current) return;
      resetInactivity();
      try {
        await apiDelete("/api/kiosk/register", { childId: childRef.current.id, islandId: island.id }, apiKey);
        showToast("Odhlásili jste se z ostrovu.");
        // Refresh terms from server
        const refreshData = await apiPost("/api/kiosk/chip", { childId: childRef.current.id }, apiKey).catch(() => null);
        if (refreshData?.terms) {
          setScreen((prev) =>
            prev.kind === "islands"
              ? { ...prev, terms: refreshData.terms as KioskTermGroup[] }
              : prev,
          );
        } else {
          // Optimistic local update if refresh fails
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
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Chyba při odhlašování.");
      }
    },
    [apiKey, resetInactivity, showToast],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const currentTerms = screen.kind === "islands" ? screen.terms : [];
  const activeTGroup = currentTerms[activeTerm] ?? currentTerms[0];

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#F0F4FA] select-none"
      onPointerMove={screen.kind === "islands" ? resetInactivity : undefined}
    >
      {/* Hidden chip input — always captures keyboard */}
      <input
        ref={chipInputRef}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        onKeyDown={handleChipKey}
        readOnly
        tabIndex={0}
        aria-hidden
      />

      {/* ── IDLE ─────────────────────────────────────────────────────────── */}
      {screen.kind === "idle" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
          <div className="text-8xl">🏝️</div>
          <h1 className="text-center text-4xl font-black text-[#0E2A5C]">
            Přilož čip
          </h1>
          <p className="text-center text-xl text-[#4A5A7C]">
            a přihlaš se na ostrov
          </p>
        </div>
      )}

      {/* ── LOADING ──────────────────────────────────────────────────────── */}
      {screen.kind === "loading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#3498DB] border-t-transparent" />
          <p className="text-xl text-[#4A5A7C]">{screen.message}</p>
        </div>
      )}

      {/* ── ERROR ────────────────────────────────────────────────────────── */}
      {screen.kind === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8">
          <div className="text-6xl">⚠️</div>
          <p className="text-center text-2xl font-bold text-[#C8372D]">{screen.message}</p>
          <p className="text-center text-lg text-[#7F88A0]">Vracíme se za chvíli…</p>
        </div>
      )}

      {/* ── SUCCESS ──────────────────────────────────────────────────────── */}
      {screen.kind === "success" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8">
          <div className="text-6xl">✅</div>
          <p className="text-center text-2xl font-bold text-[#2ECC71]">{screen.message}</p>
        </div>
      )}

      {/* ── ISLANDS ──────────────────────────────────────────────────────── */}
      {screen.kind === "islands" && activeTGroup && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between bg-[#0E2A5C] px-4 py-2.5">
            <div>
              <span className="text-sm font-semibold text-white/70">Ahoj, </span>
              <span className="text-base font-bold text-white">
                {screen.child.nickname || screen.child.displayName}
              </span>
            </div>

            {/* Term tabs */}
            {currentTerms.length > 1 && (
              <div className="flex gap-1">
                {currentTerms.map((term, idx) => (
                  <button
                    key={term.termId}
                    onClick={() => { setActiveTerm(idx); resetInactivity(); }}
                    className="rounded-lg px-3 py-1 text-sm font-semibold transition-colors"
                    style={{
                      backgroundColor: idx === activeTerm ? "white" : "transparent",
                      color: idx === activeTerm ? "#0E2A5C" : "rgba(255,255,255,0.7)",
                    }}
                  >
                    {term.termDate}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={logout}
              className="rounded-lg bg-white/10 px-3 py-1 text-sm font-semibold text-white active:bg-white/20"
            >
              Odhlásit
            </button>
          </div>

          {/* Island grid */}
          <div className="flex-1 overflow-hidden p-3">
            {activeTGroup.islands.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xl text-[#4A5A7C]">
                Žádné ostrovy nejsou dostupné.
              </div>
            ) : (
              <div
                className="h-full grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.ceil(activeTGroup.islands.length / 2)}, 1fr)`,
                  gridTemplateRows: "1fr 1fr",
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
          </div>
        </div>
      )}

      {/* Modal */}
      {modalIsland && screen.kind === "islands" && (
        <IslandModal
          island={modalIsland}
          myIslandId={activeTGroup?.myRegistrationId ?? null}
          onClose={() => setModalIsland(null)}
          onRegister={handleRegister}
          onUnregister={handleUnregister}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl bg-[#0E2A5C] px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
