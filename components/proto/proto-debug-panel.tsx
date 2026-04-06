"use client";

import { useMemo, useState } from "react";
import { Bug, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ProtoDebugEvent = {
  id: string;
  at: string;
  elementId: string;
  label: string;
  action: string;
  tableId?: string;
  rowId?: string;
  hierarchy?: string;
  payload?: string;
  undoActionId?: string;
};

export function createProtoDebugEvent(input: Omit<ProtoDebugEvent, "id" | "at">): ProtoDebugEvent {
  const now = new Date();
  return {
    id: `dbg-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    at: now.toISOString(),
    ...input,
  };
}

export function ProtoDebugPanel({
  events,
  onClear,
  onUndoAction,
  canUndoAction,
}: {
  events: ProtoDebugEvent[];
  onClear: () => void;
  onUndoAction?: (undoActionId: string) => void;
  canUndoAction?: (undoActionId: string) => boolean;
}) {
  const [open, setOpen] = useState(true);

  const latest = useMemo(() => events[0] ?? null, [events]);

  return (
    <aside className="fixed right-3 bottom-3 z-40 w-[420px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#D9E4F2] bg-white/95 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-[#E8EEF8] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[#EAF2FF] text-[#0A4DA6]">
            <Bug className="size-4" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0A4DA6]">Debug</p>
            <p className="text-[11px] text-slate-500">{events.length} záznamů</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            onClick={onClear}
            title="Vyčistit debug log"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            onClick={() => setOpen((prev) => !prev)}
            title={open ? "Sbalit" : "Rozbalit"}
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 p-3">
          {!latest && <p className="text-xs text-slate-500">Zatím bez interakce.</p>}

          {latest && (
            <div className="rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] p-2">
              <p className="text-[11px] font-semibold text-[#05204A]">Poslední interakce</p>
              <p className="mt-1 text-xs text-slate-700">
                <span className="font-semibold">{latest.elementId}</span> · {latest.action}
              </p>
              <p className="text-[11px] text-slate-500">{latest.label}</p>
              {latest.tableId && (
                <p className="text-[11px] text-slate-500">
                  tabulka: <span className="font-mono">{latest.tableId}</span>
                  {latest.rowId ? ` · řádek: ${latest.rowId}` : ""}
                </p>
              )}
              {latest.hierarchy && (
                <p className="text-[11px] text-slate-500">hierarchie: {latest.hierarchy}</p>
              )}
              {latest.payload && (
                <p className="mt-1 rounded-md bg-white px-2 py-1 font-mono text-[10px] text-slate-600">
                  {latest.payload}
                </p>
              )}
              {latest.undoActionId && onUndoAction && (
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => onUndoAction(latest.undoActionId as string)}
                    disabled={canUndoAction ? !canUndoAction(latest.undoActionId) : false}
                  >
                    Vzít zpět
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="max-h-52 overflow-y-auto rounded-xl border border-[#E6EDF8] bg-white">
            {events.length === 0 && (
              <div className="px-2 py-2 text-[11px] text-slate-500">Debug log je prázdný.</div>
            )}
            {events.map((event) => (
              <div key={event.id} className="border-t border-[#EEF3FA] px-2 py-1.5 first:border-t-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-[#05204A]">{event.elementId}</p>
                    <p className="text-[11px] text-slate-600">{event.action}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {event.undoActionId && onUndoAction && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => onUndoAction(event.undoActionId as string)}
                        disabled={canUndoAction ? !canUndoAction(event.undoActionId) : false}
                      >
                        Vzít zpět
                      </Button>
                    )}
                    <p className="text-[10px] text-slate-500">{event.at.slice(11, 19)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
