"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChildDetailTabs,
  type ChildDetailTabId,
} from "@/app/(dashboard)/portal/dite/[childId]/child-detail-tabs";
import { Button } from "@/components/ui/button";

interface Child {
  rowId: string;
  name: string;
  nickname: string;
  rocnik: string;
  currentYear: string;
  group: string;
}

const VYSVEDCENI_CHILD_DETAIL_TABS: ChildDetailTabId[] = ["vysvedceni"];

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

  const selectedChild = childrenList.find((c) => c.rowId === selectedChildId);

  if (childrenList.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="sv-card p-6">
            <p className="sv-eyebrow text-[#C8372D]">Vysvědčení</p>
            <h1 className="sv-display-sm mt-1 text-[#0E2A5C]">Výsledky dítěte</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Zatím tu nemáte žádné přiřazené dítě. Kontaktujte správce školy, pokud to není v pořádku.
            </p>
          </div>
          <div className="sv-card sv-card-ink p-6 text-sm md:col-start-2 md:row-start-1">
            <div className="flex flex-col gap-1">
              <span className="sv-eyebrow text-white/70">Rodič</span>
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
        <div className="sv-card p-6">
          <p className="sv-eyebrow text-[#C8372D]">Vysvědčení</p>
          <h1 className="sv-display-sm mt-1 text-[#0E2A5C]">
            Vysvědčení dítěte
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vyberte dítě a zobrazte jeho vysvědčení.
          </p>
        </div>
        <div className="sv-card border-[#C8372D] bg-[#C8372D] p-6 text-sm text-white md:col-start-2 md:row-start-1">
          <div className="flex flex-col gap-1">
            <span className="sv-eyebrow text-white/70">Rodič</span>
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
                  "sv-card-hover flex h-auto flex-col items-start justify-start rounded-[20px] border px-4 py-3 text-left shadow-[var(--sv-shadow-paper)]",
                  isSelected
                    ? "border-[#0E2A5C] bg-[#0E2A5C] text-white hover:bg-[#07173A]"
                    : "border-[#D6DFF0] bg-white text-[#0E2A5C] hover:border-[#0E2A5C] hover:bg-[#EEF2F7]"
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
        <ChildDetailTabs
          childId={selectedChildId}
          childName={selectedChild.name}
          tableData={{}}
          initialTab="vysvedceni"
          enabledTabs={VYSVEDCENI_CHILD_DETAIL_TABS}
          vysvedceniApiBasePath="/api/reports/child"
        />
      )}
    </div>
  );
}
