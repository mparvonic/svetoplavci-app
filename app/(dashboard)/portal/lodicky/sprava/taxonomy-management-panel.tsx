"use client";

import { useMemo, useState, useTransition } from "react";
import type { DragEvent, ReactNode } from "react";
import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Search, UserPlus, X } from "lucide-react";

import { SailboatLoading } from "@/components/sailboat-loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  moveTaxonomyLodickaAction,
  moveTaxonomyManagementAction,
  updateTaxonomyLodickaDetailAction,
  updateTaxonomyOblastPeopleAction,
  upsertTaxonomyManagementAction,
} from "./actions";
import { LodickaAssignmentFields } from "./lodicka-assignment-fields";
import type { LodickyManagementOvuOption, LodickyManagementPersonOption, TaxonomyLodickaOption, TaxonomyOption } from "./data";

type Stupen = "I_STUPEN" | "II_STUPEN";
type ItemType = "predmet" | "podpredmet" | "oblast" | "lodicka";
type DragPayload = { itemType: ItemType; itemId: string };
type AddContextBase = { key: string; svpVersionId: string; returnTo: string; insertAfterId: string };
type AddContext =
  | (AddContextBase & { itemType: "predmet"; stupen: Stupen })
  | (AddContextBase & { itemType: "podpredmet"; predmet: TaxonomyOption })
  | (AddContextBase & { itemType: "oblast"; predmet: TaxonomyOption; podpredmet?: TaxonomyOption });
type AddContextInput =
  | { itemType: "predmet"; stupen: Stupen; insertAfterId: string }
  | { itemType: "podpredmet"; predmet: TaxonomyOption; insertAfterId: string }
  | { itemType: "oblast"; predmet: TaxonomyOption; podpredmet?: TaxonomyOption; insertAfterId: string };

const inputClass =
  "h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20 disabled:bg-[#EEF2F7] disabled:text-[#7F88A0]";
const compactCellClass = "px-3 py-2 align-middle";
const compactActionButtonClass = "h-8 rounded-full px-2 text-xs";
const dragButtonClass = "inline-flex size-6 items-center justify-center rounded-full border border-[#D6DFF0] text-[#7F88A0] hover:border-[#0E2A5C] hover:text-[#0E2A5C] disabled:cursor-not-allowed disabled:opacity-40";

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatStupen(value: string) {
  if (value === "I_STUPEN") return "I. stupeň";
  if (value === "II_STUPEN") return "II. stupeň";
  return value;
}

function sortTaxonomy(a: TaxonomyOption, b: TaxonomyOption) {
  return (a.poradi ?? 9999) - (b.poradi ?? 9999)
    || a.nazev.localeCompare(b.nazev, "cs")
    || (a.kod ?? "").localeCompare(b.kod ?? "", "cs");
}

function formatLodickyCount(count: number) {
  if (count === 1) return "1 lodička";
  if (count > 1 && count < 5) return `${count} lodičky`;
  return `${count} lodiček`;
}

function addCount(map: Map<string, number>, key: string | null | undefined, value: number) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + value);
}

const gradeByStupen: Record<Stupen, number[]> = {
  I_STUPEN: [1, 2, 3, 4, 5],
  II_STUPEN: [6, 7, 8, 9],
};

function searchText(option: TaxonomyOption, predmetById: Map<string, TaxonomyOption>, podpredmetById: Map<string, TaxonomyOption>) {
  const predmet = option.predmetId ? predmetById.get(option.predmetId) : null;
  const podpredmet = option.podpredmetId ? podpredmetById.get(option.podpredmetId) : null;
  return normalizeSearchValue([
    option.kod,
    option.nazev,
    option.stupen,
    predmet?.kod,
    predmet?.nazev,
    podpredmet?.kod,
    podpredmet?.nazev,
  ].filter(Boolean).join(" "));
}

function dragPayload(event: DragEvent): DragPayload | null {
  try {
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DragPayload>;
    if (
      (parsed.itemType === "predmet" || parsed.itemType === "podpredmet" || parsed.itemType === "oblast" || parsed.itemType === "lodicka") &&
      typeof parsed.itemId === "string" &&
      parsed.itemId
    ) {
      return { itemType: parsed.itemType, itemId: parsed.itemId };
    }
  } catch {
    return null;
  }
  return null;
}

function DragHandle({ itemType, itemId, disabled }: { itemType: ItemType; itemId: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/json", JSON.stringify({ itemType, itemId } satisfies DragPayload));
      }}
      className={dragButtonClass}
      disabled={disabled}
      aria-label="Přesunout"
      title="Přesunout tažením"
    >
      <GripVertical className="size-3.5" aria-hidden={true} />
    </button>
  );
}

function HiddenBaseFields({
  svpVersionId,
  returnTo,
  itemType,
  itemId,
}: {
  svpVersionId: string;
  returnTo: string;
  itemType: ItemType;
  itemId?: string;
}) {
  return (
    <>
      <input type="hidden" name="svpVersionId" value={svpVersionId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="itemType" value={itemType} />
      {itemId && <input type="hidden" name="itemId" value={itemId} />}
    </>
  );
}

function AddLine({
  context,
  activeKey,
  setActiveKey,
  onDropMove,
  canEdit,
}: {
  context: AddContext;
  activeKey: string | null;
  setActiveKey: (key: string | null) => void;
  onDropMove: (payload: DragPayload, context: AddContext) => void;
  canEdit: boolean;
}) {
  const isOpen = activeKey === context.key;
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <TableRow
      className="group border-0 hover:bg-transparent"
      onDragOver={(event) => {
        if (!canEdit) return;
        event.preventDefault();
        setIsDragOver(true);
        event.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        if (!canEdit) return;
        event.preventDefault();
        setIsDragOver(false);
        const payload = dragPayload(event);
        if (payload) onDropMove(payload, context);
      }}
    >
      <TableCell colSpan={4} className={isOpen ? "py-1" : "p-0"}>
        {isOpen ? (
          <form action={upsertTaxonomyManagementAction} className="grid gap-2 rounded-[12px] border border-[#B9C8E4] bg-[#F8FAFC] p-3 md:grid-cols-[minmax(14rem,1fr)_8rem_auto_auto]">
            <HiddenBaseFields svpVersionId={context.svpVersionId} returnTo={context.returnTo} itemType={context.itemType} />
            <input type="hidden" name="insertAfterId" value={context.insertAfterId} />
            {context.itemType === "predmet" && <input type="hidden" name="stupen" value={context.stupen} />}
            {context.itemType !== "predmet" && <input type="hidden" name="predmetId" value={context.predmet.id} />}
            {context.itemType === "oblast" && <input type="hidden" name="podpredmetId" value={context.podpredmet?.id ?? ""} />}
            <Input name="nazev" placeholder={addPlaceholder(context)} required />
            <Input name="kod" placeholder="Kód" />
            <Button type="submit">
              <Plus className="size-4" aria-hidden={true} />
              Přidat
            </Button>
            <Button type="button" variant="outline" onClick={() => setActiveKey(null)}>
              <X className="size-4" aria-hidden={true} />
              Zavřít
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setActiveKey(context.key)}
            disabled={!canEdit}
            className={`flex w-full items-center justify-center overflow-hidden rounded-full border border-dashed font-semibold text-[#7F88A0] transition-all disabled:hidden ${
              isDragOver
                ? "h-8 border-[#0E2A5C] bg-[#EEF2F7] text-xs opacity-100"
                : "h-2 border-transparent text-[0px] opacity-0 group-hover:h-6 group-hover:border-[#B9C8E4] group-hover:text-xs group-hover:opacity-100"
            }`}
          >
            <Plus className="mr-1 size-3" aria-hidden={true} />
            {addLabel(context)}
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}

function addLabel(context: AddContext) {
  if (context.itemType === "predmet") return "Přidat předmět sem";
  if (context.itemType === "podpredmet") return "Přidat podpředmět sem";
  return "Přidat oblast sem";
}

function addPlaceholder(context: AddContext) {
  if (context.itemType === "predmet") return "Název předmětu";
  if (context.itemType === "podpredmet") return `Název podpředmětu pro ${context.predmet.nazev}`;
  return context.podpredmet
    ? `Název oblasti pod ${context.podpredmet.nazev}`
    : `Název oblasti přímo pod ${context.predmet.nazev}`;
}

function makeAddContext(input: AddContextInput & { svpVersionId: string; returnTo: string }): AddContext {
  const parentId = input.itemType === "predmet"
    ? input.stupen
    : input.itemType === "podpredmet"
      ? input.predmet.id
      : input.podpredmet?.id ?? input.predmet.id;
  return {
    ...input,
    key: `${input.itemType}:${parentId}:${input.insertAfterId || "__start__"}`,
  } as AddContext;
}

export function TaxonomyManagementPanel({
  svpVersionId,
  returnTo,
  predmetOptions,
  podpredmetOptions,
  oblastOptions,
  lodickaOptions,
  ovuOptions,
  spravceOptions,
  garantOptions,
  canEdit,
}: {
  svpVersionId: string;
  returnTo: string;
  predmetOptions: TaxonomyOption[];
  podpredmetOptions: TaxonomyOption[];
  oblastOptions: TaxonomyOption[];
  lodickaOptions: TaxonomyLodickaOption[];
  ovuOptions: LodickyManagementOvuOption[];
  spravceOptions: LodickyManagementPersonOption[];
  garantOptions: LodickyManagementPersonOption[];
  canEdit: boolean;
}) {
  const [stage, setStage] = useState<Stupen>("I_STUPEN");
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [search, setSearch] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [activeAddKey, setActiveAddKey] = useState<string | null>(null);
  const [selectedLodickaId, setSelectedLodickaId] = useState<string | null>(null);
  const [selectedOblastId, setSelectedOblastId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEditing = canEdit && mode === "edit";
  const columnCount = isEditing ? 4 : 3;
  const predmetById = useMemo(() => new Map(predmetOptions.map((option) => [option.id, option])), [predmetOptions]);
  const podpredmetById = useMemo(() => new Map(podpredmetOptions.map((option) => [option.id, option])), [podpredmetOptions]);
  const lodickaById = useMemo(() => new Map(lodickaOptions.map((option) => [option.id, option])), [lodickaOptions]);
  const selectedLodicka = selectedLodickaId ? lodickaById.get(selectedLodickaId) ?? null : null;
  const selectedOblast = selectedOblastId ? oblastOptions.find((option) => option.id === selectedOblastId) ?? null : null;
  const aggregatedLodickyCounts = useMemo(() => {
    const predmety = new Map<string, number>();
    const podpredmety = new Map<string, number>();
    for (const oblast of oblastOptions) {
      const count = oblast.lodickyCount ?? 0;
      addCount(predmety, oblast.predmetId, count);
      addCount(podpredmety, oblast.podpredmetId, count);
    }
    return { predmety, podpredmety };
  }, [oblastOptions]);
  const normalizedQuery = normalizeSearchValue(search);
  const matchesSearch = (option: TaxonomyOption) =>
    !normalizedQuery || searchText(option, predmetById, podpredmetById).includes(normalizedQuery);
  const stagePredmety = predmetOptions
    .filter((predmet) => predmet.stupen === stage)
    .filter((predmet) => {
      if (matchesSearch(predmet)) return true;
      return podpredmetOptions.some((podpredmet) => podpredmet.predmetId === predmet.id && matchesSearch(podpredmet))
        || oblastOptions.some((oblast) => oblast.predmetId === predmet.id && matchesSearch(oblast));
    })
    .sort(sortTaxonomy);

  const counts = {
    predmety: predmetOptions.filter((option) => option.stupen === stage).length,
    podpredmety: podpredmetOptions.filter((option) => option.stupen === stage).length,
    oblasti: oblastOptions.filter((option) => option.stupen === stage).length,
  };

  function moveItem(payload: DragPayload, context: AddContext) {
    if (!isEditing) return;
    if (context.itemType === "predmet" && payload.itemType !== "predmet") return;
    if (context.itemType === "podpredmet" && payload.itemType !== "podpredmet") return;
    if (context.itemType === "oblast" && payload.itemType !== "oblast") return;

    const formData = new FormData();
    formData.set("svpVersionId", svpVersionId);
    formData.set("returnTo", returnTo);
    formData.set("itemType", payload.itemType);
    formData.set("itemId", payload.itemId);
    formData.set("insertAfterId", context.insertAfterId);
    if (context.itemType === "oblast") {
      formData.set("targetPredmetId", context.predmet.id);
      formData.set("targetPodpredmetId", context.podpredmet?.id ?? "");
    }
    startTransition(() => {
      void moveTaxonomyManagementAction(formData);
    });
  }

  function addContext(context: AddContextInput) {
    return makeAddContext({ ...context, svpVersionId, returnTo });
  }

  function moveLodickaToArea(lodickaId: string, targetOblastId: string) {
    if (!isEditing) return;
    const formData = new FormData();
    formData.set("svpVersionId", svpVersionId);
    formData.set("returnTo", returnTo);
    formData.set("lodickaId", lodickaId);
    formData.set("targetOblastId", targetOblastId);
    startTransition(() => {
      void moveTaxonomyLodickaAction(formData);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Předměty, podpředměty a oblasti</CardTitle>
              <CardDescription>
                {isEditing
                  ? "Editační režim umožňuje přidávání, úpravy a přesuny ve struktuře."
                  : "Zobrazovací režim ukazuje aktuální strom struktury bez editačních ovládacích prvků."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <div className="inline-flex rounded-full border border-[#D6DFF0] bg-white p-1">
                  <Button
                    type="button"
                    variant={mode === "view" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setMode("view");
                      setEditingKey(null);
                      setActiveAddKey(null);
                    }}
                    className={mode === "view" ? "bg-[#002060] text-white hover:bg-[#001540]" : "text-[#0E2A5C]"}
                  >
                    Zobrazení
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "edit" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setMode("edit")}
                    className={mode === "edit" ? "bg-[#002060] text-white hover:bg-[#001540]" : "text-[#0E2A5C]"}
                  >
                    Editace
                  </Button>
                </div>
              )}
              <Badge variant="outline">{counts.predmety} / {counts.podpredmety} / {counts.oblasti}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[12rem_minmax(16rem,1fr)]">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">Stupeň</span>
              <select value={stage} onChange={(event) => setStage(event.target.value as Stupen)} className={inputClass}>
                <option value="I_STUPEN">{formatStupen("I_STUPEN")}</option>
                <option value="II_STUPEN">{formatStupen("II_STUPEN")}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">Hledat</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7F88A0]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Název nebo kód..."
                  autoComplete="off"
                  className={`${inputClass} pl-9`}
                />
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{formatStupen(stage)}</CardTitle>
              <CardDescription>Tabulkový přehled struktury: předmět → podpředmět → oblast.</CardDescription>
            </div>
            <Badge variant="outline">{stagePredmety.length} předmětů v zobrazení</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-3 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Předmět</TableHead>
                <TableHead>Podpředmět</TableHead>
                <TableHead>Oblast</TableHead>
                {isEditing && <TableHead className="text-right">Akce</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isEditing && (
                <AddLine
                  context={addContext({ itemType: "predmet", stupen: stage, insertAfterId: "__start__" })}
                  activeKey={activeAddKey}
                  setActiveKey={setActiveAddKey}
                  onDropMove={moveItem}
                  canEdit={isEditing}
                />
              )}
              {stagePredmety.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="py-8 text-center text-sm text-[#7F88A0]">
                    V tomto stupni není žádná struktura odpovídající filtru.
                  </TableCell>
                </TableRow>
              ) : stagePredmety.map((predmet) => {
                const directAreas = oblastOptions
                  .filter((oblast) => oblast.predmetId === predmet.id && !oblast.podpredmetId)
                  .filter(matchesSearch)
                  .sort(sortTaxonomy);
                const podpredmety = podpredmetOptions
                  .filter((podpredmet) => podpredmet.predmetId === predmet.id)
                  .filter((podpredmet) => {
                    if (matchesSearch(podpredmet)) return true;
                    return oblastOptions.some((oblast) => oblast.podpredmetId === podpredmet.id && matchesSearch(oblast));
                  })
                  .sort(sortTaxonomy);
                return (
                  <RowGroup key={predmet.id}>
                    {isEditing && editingKey === `predmet:${predmet.id}` ? (
                      <EditRow
                        svpVersionId={svpVersionId}
                        returnTo={returnTo}
                        itemType="predmet"
                        item={predmet}
                        hiddenFields={<input type="hidden" name="stupen" value={predmet.stupen} />}
                        onCancel={() => setEditingKey(null)}
                      />
                    ) : (
                      <TableRow className="bg-[#F8FAFC]">
                        <TableCell className={`${compactCellClass} font-semibold text-[#0E2A5C]`}>
                          <div className="flex items-center gap-2">
                            {isEditing && <DragHandle itemType="predmet" itemId={predmet.id} />}
                            <span>{predmet.nazev}</span>
                            {predmet.kod && <span className="text-xs text-[#7F88A0]">{predmet.kod}</span>}
                            <Badge variant="secondary">{formatLodickyCount(aggregatedLodickyCounts.predmety.get(predmet.id) ?? 0)}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className={compactCellClass} />
                        <TableCell className={compactCellClass} />
                        {isEditing && (
                          <TableCell className={`${compactCellClass} text-right`}>
                            <Button type="button" variant="outline" size="sm" className={compactActionButtonClass} onClick={() => setEditingKey(`predmet:${predmet.id}`)}>
                              <Pencil className="size-3.5" aria-hidden={true} />
                              Upravit
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )}

                    {isEditing && (
                      <AddLine
                        context={addContext({ itemType: "oblast", predmet, insertAfterId: "__start__" })}
                        activeKey={activeAddKey}
                        setActiveKey={setActiveAddKey}
                        onDropMove={moveItem}
                        canEdit={isEditing}
                      />
                    )}
                    {directAreas.map((oblast) => (
                      <RowGroup key={oblast.id}>
                        <AreaRow
                          svpVersionId={svpVersionId}
                          returnTo={returnTo}
                          oblast={oblast}
                          predmet={predmet}
                          lodicky={lodickaOptions.filter((lodicka) => lodicka.oblastId === oblast.id)}
                          onOpenLodicka={setSelectedLodickaId}
                          onDropLodicka={moveLodickaToArea}
                          onEditOblastPeople={setSelectedOblastId}
                          editingKey={editingKey}
                          setEditingKey={setEditingKey}
                          canEdit={isEditing}
                        />
                        {isEditing && (
                          <AddLine
                            context={addContext({ itemType: "oblast", predmet, insertAfterId: oblast.id })}
                            activeKey={activeAddKey}
                            setActiveKey={setActiveAddKey}
                            onDropMove={moveItem}
                            canEdit={isEditing}
                          />
                        )}
                      </RowGroup>
                    ))}

                    {isEditing && (
                      <AddLine
                        context={addContext({ itemType: "podpredmet", predmet, insertAfterId: "__start__" })}
                        activeKey={activeAddKey}
                        setActiveKey={setActiveAddKey}
                        onDropMove={moveItem}
                        canEdit={isEditing}
                      />
                    )}
                    {podpredmety.map((podpredmet) => {
                      const areas = oblastOptions
                        .filter((oblast) => oblast.podpredmetId === podpredmet.id)
                        .filter(matchesSearch)
                        .sort(sortTaxonomy);
                      return (
                        <RowGroup key={podpredmet.id}>
                          {isEditing && editingKey === `podpredmet:${podpredmet.id}` ? (
                            <EditRow
                              svpVersionId={svpVersionId}
                              returnTo={returnTo}
                              itemType="podpredmet"
                              item={podpredmet}
                              hiddenFields={<input type="hidden" name="predmetId" value={predmet.id} />}
                              onCancel={() => setEditingKey(null)}
                            />
                          ) : (
                            <TableRow>
                              <TableCell className={compactCellClass} />
                              <TableCell className={`${compactCellClass} font-semibold text-[#0E2A5C]`}>
                                <div className="flex items-center gap-2">
                                  {isEditing && <DragHandle itemType="podpredmet" itemId={podpredmet.id} />}
                                  <span>{podpredmet.nazev}</span>
                                  {podpredmet.kod && <span className="text-xs text-[#7F88A0]">{podpredmet.kod}</span>}
                                  <Badge variant="secondary">{formatLodickyCount(aggregatedLodickyCounts.podpredmety.get(podpredmet.id) ?? 0)}</Badge>
                                </div>
                              </TableCell>
                              <TableCell className={compactCellClass} />
                              {isEditing && (
                                <TableCell className={`${compactCellClass} text-right`}>
                                  <Button type="button" variant="outline" size="sm" className={compactActionButtonClass} onClick={() => setEditingKey(`podpredmet:${podpredmet.id}`)}>
                                    <Pencil className="size-3.5" aria-hidden={true} />
                                    Upravit
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          )}
                          {isEditing && (
                            <AddLine
                              context={addContext({ itemType: "oblast", predmet, podpredmet, insertAfterId: "__start__" })}
                              activeKey={activeAddKey}
                              setActiveKey={setActiveAddKey}
                              onDropMove={moveItem}
                              canEdit={isEditing}
                            />
                          )}
                          {areas.map((oblast) => (
                            <RowGroup key={oblast.id}>
                              <AreaRow
                                svpVersionId={svpVersionId}
                                returnTo={returnTo}
                                oblast={oblast}
                                predmet={predmet}
                                podpredmet={podpredmet}
                                lodicky={lodickaOptions.filter((lodicka) => lodicka.oblastId === oblast.id)}
                                onOpenLodicka={setSelectedLodickaId}
                                onDropLodicka={moveLodickaToArea}
                                onEditOblastPeople={setSelectedOblastId}
                                editingKey={editingKey}
                                setEditingKey={setEditingKey}
                                canEdit={isEditing}
                              />
                              {isEditing && (
                                <AddLine
                                  context={addContext({ itemType: "oblast", predmet, podpredmet, insertAfterId: oblast.id })}
                                  activeKey={activeAddKey}
                                  setActiveKey={setActiveAddKey}
                                  onDropMove={moveItem}
                                  canEdit={isEditing}
                                />
                              )}
                            </RowGroup>
                          ))}
                          {isEditing && (
                            <AddLine
                              context={addContext({ itemType: "podpredmet", predmet, insertAfterId: podpredmet.id })}
                              activeKey={activeAddKey}
                              setActiveKey={setActiveAddKey}
                              onDropMove={moveItem}
                              canEdit={isEditing}
                            />
                          )}
                        </RowGroup>
                      );
                    })}
                    {isEditing && (
                      <AddLine
                        context={addContext({ itemType: "predmet", stupen: stage, insertAfterId: predmet.id })}
                        activeKey={activeAddKey}
                        setActiveKey={setActiveAddKey}
                        onDropMove={moveItem}
                        canEdit={isEditing}
                      />
                    )}
                  </RowGroup>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LodickaTreeDetailDialog
        lodicka={selectedLodicka}
        returnTo={returnTo}
        ovuOptions={ovuOptions}
        onOpenChange={(open) => {
          if (!open) setSelectedLodickaId(null);
        }}
      />

      <OblastPeopleDialog
        svpVersionId={svpVersionId}
        returnTo={returnTo}
        oblast={selectedOblast}
        spravceOptions={spravceOptions}
        garantOptions={garantOptions}
        onOpenChange={(open) => {
          if (!open) setSelectedOblastId(null);
        }}
      />

      {isPending && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#EEF2F7]/80 px-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label="Ukládám změnu ve stromu lodiček"
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#D6DFF0] bg-white/95 px-6 py-4 shadow-xl">
            <SailboatLoading className="py-6" message="Ukládám změnu ve stromu lodiček…" />
          </div>
        </div>
      )}
    </div>
  );
}

function RowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function EditRow({
  svpVersionId,
  returnTo,
  itemType,
  item,
  hiddenFields,
  onCancel,
}: {
  svpVersionId: string;
  returnTo: string;
  itemType: ItemType;
  item: TaxonomyOption;
  hiddenFields: ReactNode;
  onCancel: () => void;
}) {
  return (
    <TableRow className="bg-[#FFFDF7]">
      <TableCell colSpan={4} className="px-3 py-2">
        <form action={upsertTaxonomyManagementAction} className="grid gap-2 md:grid-cols-[minmax(14rem,1fr)_8rem_auto_auto]">
          <HiddenBaseFields svpVersionId={svpVersionId} returnTo={returnTo} itemType={itemType} itemId={item.id} />
          {hiddenFields}
          <Input name="nazev" defaultValue={item.nazev} required />
          <Input name="kod" defaultValue={item.kod ?? ""} placeholder="Kód" />
          <Button type="submit">Uložit</Button>
          <Button type="button" variant="outline" onClick={onCancel}>Storno</Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

function AreaRow({
  svpVersionId,
  returnTo,
  oblast,
  predmet,
  podpredmet,
  lodicky,
  onOpenLodicka,
  onDropLodicka,
  onEditOblastPeople,
  editingKey,
  setEditingKey,
  canEdit,
}: {
  svpVersionId: string;
  returnTo: string;
  oblast: TaxonomyOption;
  predmet: TaxonomyOption;
  podpredmet?: TaxonomyOption;
  lodicky: TaxonomyLodickaOption[];
  onOpenLodicka: (lodickaId: string) => void;
  onDropLodicka: (lodickaId: string, targetOblastId: string) => void;
  onEditOblastPeople: (oblastId: string) => void;
  editingKey: string | null;
  setEditingKey: (key: string | null) => void;
  canEdit: boolean;
}) {
  const [isLodickyOpen, setIsLodickyOpen] = useState(false);
  const [isLodickaDragOver, setIsLodickaDragOver] = useState(false);
  const lodickyCount = oblast.lodickyCount ?? 0;

  if (canEdit && editingKey === `oblast:${oblast.id}`) {
    return (
      <EditRow
        svpVersionId={svpVersionId}
        returnTo={returnTo}
        itemType="oblast"
        item={oblast}
        hiddenFields={
          <>
            <input type="hidden" name="predmetId" value={predmet.id} />
            <input type="hidden" name="podpredmetId" value={podpredmet?.id ?? ""} />
          </>
        }
        onCancel={() => setEditingKey(null)}
      />
    );
  }

  return (
    <>
      <TableRow
        className={isLodickaDragOver ? "bg-[#EEF2F7]" : undefined}
        onDragOver={(event) => {
          if (!canEdit) return;
          event.preventDefault();
          const payload = dragPayload(event);
          if (payload?.itemType === "lodicka") setIsLodickaDragOver(true);
          event.dataTransfer.dropEffect = "move";
        }}
        onDragLeave={() => setIsLodickaDragOver(false)}
        onDrop={(event) => {
          if (!canEdit) return;
          event.preventDefault();
          setIsLodickaDragOver(false);
          const payload = dragPayload(event);
          if (payload?.itemType === "lodicka") onDropLodicka(payload.itemId, oblast.id);
        }}
      >
        <TableCell className={compactCellClass} />
        <TableCell className={`${compactCellClass} text-sm text-[#7F88A0]`}>
          {podpredmet ? "" : "Přímo pod předmětem"}
        </TableCell>
        <TableCell className={compactCellClass}>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && <DragHandle itemType="oblast" itemId={oblast.id} />}
            <span className="font-semibold text-[#0E2A5C]">{oblast.nazev}</span>
            {oblast.kod && <span className="text-xs text-[#7F88A0]">{oblast.kod}</span>}
            <Badge variant={lodickyCount > 0 ? "secondary" : "outline"}>
              {formatLodickyCount(lodickyCount)}
            </Badge>
            {lodickyCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsLodickyOpen((current) => !current)}
                className="h-7 px-1.5 text-xs text-[#0E2A5C]"
              >
                {isLodickyOpen ? <ChevronDown className="size-3.5" aria-hidden={true} /> : <ChevronRight className="size-3.5" aria-hidden={true} />}
                Zobrazit
              </Button>
            )}
          </div>
        </TableCell>
        {canEdit && (
          <TableCell className={`${compactCellClass} text-right`}>
            <Button type="button" variant="outline" size="sm" className={compactActionButtonClass} onClick={() => onEditOblastPeople(oblast.id)}>
              Lidé
            </Button>
            <Button type="button" variant="outline" size="sm" className={`${compactActionButtonClass} ml-1`} onClick={() => setEditingKey(`oblast:${oblast.id}`)}>
              <Pencil className="size-3.5" aria-hidden={true} />
              Upravit
            </Button>
          </TableCell>
        )}
      </TableRow>
      {isLodickyOpen && lodicky.map((lodicka) => (
        <TableRow key={lodicka.id} className="bg-white">
          <TableCell className={compactCellClass} />
          <TableCell className={compactCellClass} />
          <TableCell className={compactCellClass}>
            <button
              type="button"
              draggable={canEdit}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/json", JSON.stringify({ itemType: "lodicka", itemId: lodicka.id } satisfies DragPayload));
              }}
              onClick={() => onOpenLodicka(lodicka.id)}
              className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1 text-left text-sm font-medium text-[#0E2A5C] hover:bg-[#EEF2F7]"
            >
              {canEdit && <GripVertical className="size-4 shrink-0 text-[#7F88A0]" aria-hidden={true} />}
              <span>{lodicka.nazev}</span>
            </button>
          </TableCell>
          {canEdit && <TableCell className={compactCellClass} />}
        </TableRow>
      ))}
    </>
  );
}

function LodickaTreeDetailDialog({
  lodicka,
  returnTo,
  ovuOptions,
  onOpenChange,
}: {
  lodicka: TaxonomyLodickaOption | null;
  returnTo: string;
  ovuOptions: LodickyManagementOvuOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const stupen = lodicka?.stupen === "II_STUPEN" ? "II_STUPEN" : "I_STUPEN";
  const grades = gradeByStupen[stupen];

  return (
    <Dialog open={Boolean(lodicka)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        {lodicka && (
          <form key={lodicka.id} action={updateTaxonomyLodickaDetailAction}>
            <DialogHeader>
              <DialogTitle>{lodicka.nazev}</DialogTitle>
              <DialogDescription>Detail lodičky ve stromu. Zařazení do oblasti se v této obrazovce mění pouze přetažením.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 p-4">
              <input type="hidden" name="lodickaId" value={lodicka.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="stupen" value={stupen} />
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-[#4A5A7C]">Ročník od</span>
                  <select name="rocnikOd" defaultValue={lodicka.rocnikOd} className={inputClass}>
                    {grades.map((grade) => <option key={grade} value={grade}>{grade}. ročník</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-[#4A5A7C]">Ročník do</span>
                  <select name="rocnikDo" defaultValue={lodicka.rocnikDo} className={inputClass}>
                    {grades.map((grade) => <option key={grade} value={grade}>{grade}. ročník</option>)}
                  </select>
                </label>
              </div>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Popis</span>
                <textarea
                  name="popis"
                  defaultValue={lodicka.popis ?? ""}
                  rows={5}
                  className="w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 py-2 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
                />
              </label>
              <LodickaAssignmentFields
                canEditFleetFields={false}
                ovuOptions={ovuOptions}
                initialOvuIds={lodicka.ovuIds}
                initialOvuNotApplicable={lodicka.ovuNotApplicable}
                initialStupen={stupen}
                spravceOptions={[]}
                initialSpravceIds={[]}
                garantOptions={[]}
                initialGarantIds={[]}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Storno</Button>
              <Button type="submit">Uložit lodičku</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OblastPeopleDialog({
  svpVersionId,
  returnTo,
  oblast,
  spravceOptions,
  garantOptions,
  onOpenChange,
}: {
  svpVersionId: string;
  returnTo: string;
  oblast: TaxonomyOption | null;
  spravceOptions: LodickyManagementPersonOption[];
  garantOptions: LodickyManagementPersonOption[];
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(oblast)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {oblast && (
          <form key={oblast.id} action={updateTaxonomyOblastPeopleAction}>
            <DialogHeader>
              <DialogTitle>{oblast.nazev}</DialogTitle>
              <DialogDescription>
                Správci se ukládají k oblasti. Garanti se použijí na všechny aktuální lodičky v této oblasti.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 p-4">
              <input type="hidden" name="svpVersionId" value={svpVersionId} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="oblastId" value={oblast.id} />
              <PersonMultiSelect
                label="Správci lodiček v oblasti"
                name="spravcePersonIds"
                options={spravceOptions}
                initialIds={oblast.spravcePersonIds ?? []}
                placeholder="Vyhledat správce"
              />
              <PersonMultiSelect
                label="Garanti lodiček v oblasti"
                name="garantPersonIds"
                options={garantOptions}
                initialIds={oblast.garantPersonIds ?? []}
                placeholder="Vyhledat garanta"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Storno</Button>
              <Button type="submit">Uložit nastavení</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function personSearchText(person: LodickyManagementPersonOption): string {
  return normalizeSearchValue(`${person.displayName} ${person.legalName} ${person.email ?? ""} ${person.identifier ?? ""}`);
}

function PersonMultiSelect({
  label,
  name,
  options,
  initialIds,
  placeholder,
}: {
  label: string;
  name: string;
  options: LodickyManagementPersonOption[];
  initialIds: string[];
  placeholder: string;
}) {
  const [selectedIds, setSelectedIds] = useState(initialIds);
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const queryParts = normalizeSearchValue(query).split(/\s+/).filter(Boolean);
  const visibleOptions = queryParts.length === 0
    ? []
    : options
        .filter((option) => !selectedSet.has(option.id))
        .filter((option) => queryParts.every((part) => personSearchText(option).includes(part)))
        .slice(0, 8);

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-[#4A5A7C]">{label}</span>
      {selectedIds.map((id) => <input key={id} type="hidden" name={name} value={id} />)}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const person = optionById.get(id);
            return (
              <Badge key={id} variant="outline" className="gap-1 border-[#D6DFF0] bg-[#EEF2F7] text-slate-700">
                {person?.displayName ?? id}
                <button
                  type="button"
                  className="ml-1 rounded-full text-slate-500 hover:text-[#C8372D]"
                  onClick={() => setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id))}
                  aria-label="Odebrat osobu"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} autoComplete="off" />
        {query.trim() && (
          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-[#D6DFF0] bg-white shadow-lg">
            {visibleOptions.length === 0 && <div className="px-3 py-2 text-sm text-slate-500">Žádný výsledek</div>}
            {visibleOptions.map((person) => (
              <button
                key={person.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#EEF2F7]"
                onClick={() => {
                  setSelectedIds([...selectedIds, person.id]);
                  setQuery("");
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[#0E2A5C]">{person.displayName}</span>
                  {person.email && <span className="block truncate text-xs text-slate-500">{person.email}</span>}
                </span>
                <UserPlus className="size-4 shrink-0 text-slate-500" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
