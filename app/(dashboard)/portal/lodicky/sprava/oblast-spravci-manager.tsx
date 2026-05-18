"use client";

import { useMemo, useState } from "react";
import { Check, Search, UsersRound, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { updateOblastSpravciManagementAction } from "./actions";
import type { LodickyManagementPersonOption, TaxonomyOption } from "./data";

const inputClass =
  "h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20 disabled:bg-[#EEF2F7] disabled:text-[#7F88A0]";

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function personSearchText(person: LodickyManagementPersonOption): string {
  const base = `${person.displayName} ${person.legalName} ${person.email ?? ""} ${person.identifier ?? ""}`;
  const parts = normalizeSearchValue(base).split(/\s+/).filter(Boolean);
  const prefixAliases = parts.flatMap((part) => [part.slice(0, 3), part.slice(0, 4), part.slice(0, 5)]);
  return [...new Set([...parts, ...prefixAliases])].join(" ");
}

function taxonomySearchText(
  oblast: TaxonomyOption,
  predmetById: Map<string, TaxonomyOption>,
  podpredmetById: Map<string, TaxonomyOption>,
): string {
  const predmet = oblast.predmetId ? predmetById.get(oblast.predmetId) : null;
  const podpredmet = oblast.podpredmetId ? podpredmetById.get(oblast.podpredmetId) : null;
  return normalizeSearchValue([
    oblast.kod,
    oblast.nazev,
    formatStupen(oblast.stupen),
    predmet?.kod,
    predmet?.nazev,
    podpredmet?.kod,
    podpredmet?.nazev,
  ].filter(Boolean).join(" "));
}

function formatStupen(value: string) {
  if (value === "I_STUPEN") return "I. stupeň";
  if (value === "II_STUPEN") return "II. stupeň";
  return value;
}

function PersonSearchBox({
  value,
  onChange,
  options,
  excludedIds,
  onSelect,
}: {
  value: string;
  onChange: (value: string) => void;
  options: LodickyManagementPersonOption[];
  excludedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const filteredOptions = useMemo(() => {
    const query = normalizeSearchValue(value);
    if (!query) return [];
    return options
      .filter((person) => !excludedIds.has(person.id))
      .filter((person) => personSearchText(person).includes(query))
      .slice(0, 8);
  }, [excludedIds, options, value]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7F88A0]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Hledat správce jménem nebo e-mailem..."
        autoComplete="off"
        className={`${inputClass} pl-9`}
      />
      {value.trim() && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-[#D6DFF0] bg-white shadow-lg">
          {filteredOptions.length === 0 && (
            <div className="px-3 py-2 text-sm text-[#7F88A0]">Žádný správce nenalezen.</div>
          )}
          {filteredOptions.map((person) => (
            <button
              key={person.id}
              type="button"
              className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-[#EEF2F7]"
              onClick={() => {
                onSelect(person.id);
                onChange("");
              }}
            >
              <Check className="mt-0.5 size-4 shrink-0 text-[#4A5A7C]" aria-hidden={true} />
              <span className="min-w-0">
                <span className="block font-semibold text-[#0E2A5C]">{person.displayName}</span>
                <span className="block text-xs text-[#4A5A7C]">{person.legalName}</span>
                {person.email && <span className="block text-xs text-[#7F88A0]">{person.email}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function OblastSpravciManager({
  svpVersionId,
  returnTo,
  predmetOptions = [],
  podpredmetOptions = [],
  oblastOptions,
  spravceOptions,
  currentPersonIds,
}: {
  svpVersionId: string;
  returnTo: string;
  predmetOptions: TaxonomyOption[];
  podpredmetOptions: TaxonomyOption[];
  oblastOptions: TaxonomyOption[];
  spravceOptions: LodickyManagementPersonOption[];
  currentPersonIds: string[];
}) {
  const [selectedOblastIds, setSelectedOblastIds] = useState<string[]>([]);
  const [stupenFilter, setStupenFilter] = useState<"" | "I_STUPEN" | "II_STUPEN">("");
  const [predmetFilterId, setPredmetFilterId] = useState("");
  const [podpredmetFilterId, setPodpredmetFilterId] = useState("");
  const [oblastSearch, setOblastSearch] = useState("");
  const [mode, setMode] = useState<"add" | "replace" | "remove">("add");
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [personSearch, setPersonSearch] = useState("");

  const selectedOblastSet = useMemo(() => new Set(selectedOblastIds), [selectedOblastIds]);
  const selectedOblasti = useMemo(
    () => oblastOptions.filter((oblast) => selectedOblastSet.has(oblast.id)),
    [oblastOptions, selectedOblastSet],
  );
  const predmetById = useMemo(() => new Map(predmetOptions.map((option) => [option.id, option])), [predmetOptions]);
  const podpredmetById = useMemo(() => new Map(podpredmetOptions.map((option) => [option.id, option])), [podpredmetOptions]);
  const personById = useMemo(() => new Map(spravceOptions.map((person) => [person.id, person])), [spravceOptions]);
  const selectedSet = useMemo(() => new Set(selectedPersonIds), [selectedPersonIds]);
  const currentPersonIdSet = useMemo(() => new Set(currentPersonIds), [currentPersonIds]);
  const currentSpravceIds = useMemo(
    () => [...new Set(selectedOblasti.flatMap((oblast) => oblast.spravcePersonIds ?? []))],
    [selectedOblasti],
  );
  const lockedOwnSpravceIds = useMemo(
    () => mode === "replace"
      ? currentSpravceIds.filter((personId) => currentPersonIdSet.has(personId))
      : [],
    [currentPersonIdSet, currentSpravceIds, mode],
  );
  const effectiveSelectedPersonIds = useMemo(
    () => [...new Set([...lockedOwnSpravceIds, ...selectedPersonIds])],
    [lockedOwnSpravceIds, selectedPersonIds],
  );
  const searchOptions = useMemo(() => {
    if (mode === "remove") {
      const removableIds = new Set(currentSpravceIds.filter((personId) => !currentPersonIdSet.has(personId)));
      return spravceOptions.filter((person) => removableIds.has(person.id));
    }
    return spravceOptions;
  }, [currentPersonIdSet, currentSpravceIds, mode, spravceOptions]);
  const filteredPredmetOptions = useMemo(
    () => predmetOptions.filter((predmet) => !stupenFilter || predmet.stupen === stupenFilter),
    [predmetOptions, stupenFilter],
  );
  const filteredPodpredmetOptions = useMemo(
    () => podpredmetOptions.filter((podpredmet) =>
      (!stupenFilter || podpredmet.stupen === stupenFilter) &&
      (!predmetFilterId || podpredmet.predmetId === predmetFilterId)
    ),
    [podpredmetOptions, predmetFilterId, stupenFilter],
  );
  const filteredOblastOptions = useMemo(() => {
    const query = normalizeSearchValue(oblastSearch);
    return oblastOptions
      .filter((oblast) => !stupenFilter || oblast.stupen === stupenFilter)
      .filter((oblast) => !predmetFilterId || oblast.predmetId === predmetFilterId)
      .filter((oblast) => !podpredmetFilterId || (podpredmetFilterId === "__none" ? !oblast.podpredmetId : oblast.podpredmetId === podpredmetFilterId))
      .filter((oblast) => !query || taxonomySearchText(oblast, predmetById, podpredmetById).includes(query))
      .sort((a, b) => {
        const predmetA = a.predmetId ? predmetById.get(a.predmetId)?.nazev ?? "" : "";
        const predmetB = b.predmetId ? predmetById.get(b.predmetId)?.nazev ?? "" : "";
        return predmetA.localeCompare(predmetB, "cs")
          || a.nazev.localeCompare(b.nazev, "cs")
          || (a.kod ?? "").localeCompare(b.kod ?? "", "cs");
      });
  }, [oblastOptions, oblastSearch, podpredmetById, podpredmetFilterId, predmetById, predmetFilterId, stupenFilter]);
  const visibleOblastOptions = filteredOblastOptions.slice(0, 12);
  const visibleOblastIds = visibleOblastOptions.map((oblast) => oblast.id);
  const allVisibleSelected = visibleOblastIds.length > 0 && visibleOblastIds.every((id) => selectedOblastSet.has(id));
  const canSubmit = selectedOblastIds.length > 0 && (mode === "replace" || selectedPersonIds.length > 0);

  function toggleOblast(id: string, checked: boolean) {
    setSelectedOblastIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((item) => item !== id);
    });
    setSelectedPersonIds([]);
    setPersonSearch("");
  }

  function toggleVisibleOblasti(checked: boolean) {
    setSelectedOblastIds((current) => {
      if (!checked) return current.filter((id) => !visibleOblastIds.includes(id));
      return [...new Set([...current, ...visibleOblastIds])];
    });
    setSelectedPersonIds([]);
    setPersonSearch("");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Správci oblastí</CardTitle>
            <CardDescription>
              Správce lodiček se váže na oblast, aby šlo připravit odpovědnosti i před vznikem konkrétních lodiček.
            </CardDescription>
          </div>
          <Badge variant="outline">
            <UsersRound className="size-3" aria-hidden={true} />
            {oblastOptions.filter((oblast) => (oblast.spravcePersonIds ?? []).length === 0).length} bez správce
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form action={updateOblastSpravciManagementAction} className="space-y-4">
          <input type="hidden" name="svpVersionId" value={svpVersionId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="mode" value={mode} />
          {selectedOblastIds.map((oblastId) => (
            <input key={oblastId} type="hidden" name="oblastIds" value={oblastId} />
          ))}
          {effectiveSelectedPersonIds.map((personId) => (
            <input key={personId} type="hidden" name="spravcePersonIds" value={personId} />
          ))}

          <div className="space-y-3 rounded-[12px] border border-[#D6DFF0] bg-[#F8FAFC] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#0E2A5C]">Výběr oblasti</p>
                <p className="text-xs text-[#4A5A7C]">Filtrujte přes stupeň, předmět a podpředmět, nebo napište část názvu či kódu.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{filteredOblastOptions.length} z {oblastOptions.length} oblastí</Badge>
                <Badge variant={selectedOblastIds.length > 0 ? "default" : "outline"}>{selectedOblastIds.length} vybráno</Badge>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[9rem_minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(16rem,1.3fr)]">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Stupeň</span>
                <select
                  value={stupenFilter}
                  onChange={(event) => {
                    setStupenFilter(event.target.value as "" | "I_STUPEN" | "II_STUPEN");
                    setPredmetFilterId("");
                    setPodpredmetFilterId("");
                  }}
                  className={inputClass}
                >
                  <option value="">Vše</option>
                  <option value="I_STUPEN">I. stupeň</option>
                  <option value="II_STUPEN">II. stupeň</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Předmět</span>
                <select
                  value={predmetFilterId}
                  onChange={(event) => {
                    setPredmetFilterId(event.target.value);
                    setPodpredmetFilterId("");
                  }}
                  className={inputClass}
                >
                  <option value="">Všechny</option>
                  {filteredPredmetOptions.map((predmet) => (
                    <option key={predmet.id} value={predmet.id}>{predmet.nazev}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Podpředmět</span>
                <select
                  value={podpredmetFilterId}
                  onChange={(event) => setPodpredmetFilterId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Všechny</option>
                  <option value="__none">Bez podpředmětu</option>
                  {filteredPodpredmetOptions.map((podpredmet) => (
                    <option key={podpredmet.id} value={podpredmet.id}>{podpredmet.nazev}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Hledat oblast</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7F88A0]" />
                  <input
                    value={oblastSearch}
                    onChange={(event) => setOblastSearch(event.target.value)}
                    placeholder="Název, kód, předmět..."
                    autoComplete="off"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </label>
            </div>

            {visibleOblastOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-full border border-[#D6DFF0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0E2A5C]">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => toggleVisibleOblasti(event.target.checked)}
                    className="size-4 rounded border-[#D6DFF0] text-[#0E2A5C]"
                  />
                  Vybrat zobrazené
                </label>
                {selectedOblastIds.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOblastIds([]);
                      setSelectedPersonIds([]);
                      setPersonSearch("");
                    }}
                  >
                    Zrušit výběr
                  </Button>
                )}
              </div>
            )}

            <div className="max-h-80 overflow-auto rounded-[12px] border border-[#D6DFF0] bg-white">
              {visibleOblastOptions.length === 0 ? (
                <div className="px-3 py-4 text-sm text-[#7F88A0]">Žádná oblast neodpovídá filtrům.</div>
              ) : (
                visibleOblastOptions.map((oblast) => {
                  const predmet = oblast.predmetId ? predmetById.get(oblast.predmetId) : null;
                  const podpredmet = oblast.podpredmetId ? podpredmetById.get(oblast.podpredmetId) : null;
                  const isSelected = selectedOblastSet.has(oblast.id);
                  return (
                    <label
                      key={oblast.id}
                      className={
                        isSelected
                          ? "flex w-full cursor-pointer items-start gap-3 border-b border-[#D6DFF0] bg-[#EEF2F7] px-3 py-2 text-left last:border-b-0"
                          : "flex w-full cursor-pointer items-start gap-3 border-b border-[#D6DFF0] px-3 py-2 text-left hover:bg-[#F8FAFC] last:border-b-0"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => toggleOblast(oblast.id, event.target.checked)}
                        className="mt-1 size-4 shrink-0 rounded border-[#D6DFF0] text-[#0E2A5C]"
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold text-[#0E2A5C]">{oblast.nazev}</span>
                        <span className="block text-xs text-[#4A5A7C]">
                          {formatStupen(oblast.stupen)}
                          {predmet ? ` · ${predmet.nazev}` : ""}
                          {podpredmet ? ` · ${podpredmet.nazev}` : ""}
                        </span>
                        <span className="block text-xs text-[#7F88A0]">
                          {oblast.kod ?? "bez kódu"} · {oblast.lodickyCount ?? 0} lodiček · {oblast.spravciNames || "bez správce"}
                        </span>
                      </span>
                      {isSelected && <Check className="mt-0.5 size-4 shrink-0 text-[#0E2A5C]" aria-hidden={true} />}
                    </label>
                  );
                })
              )}
            </div>
            {filteredOblastOptions.length > visibleOblastOptions.length && (
              <p className="text-xs text-[#7F88A0]">
                Zobrazuji prvních {visibleOblastOptions.length}. Upřesněte filtr nebo hledání.
              </p>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[12rem_minmax(18rem,1fr)_auto]">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">Operace</span>
              <select
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as "add" | "replace" | "remove");
                  setSelectedPersonIds([]);
                  setPersonSearch("");
                }}
                className={inputClass}
              >
                <option value="add">Přidat</option>
                <option value="replace">Nahradit</option>
                <option value="remove">Odebrat</option>
              </select>
            </label>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#4A5A7C]">Vybraní správci</span>
            <PersonSearchBox
              value={personSearch}
              onChange={setPersonSearch}
              options={searchOptions}
              excludedIds={selectedSet}
              onSelect={(personId) => setSelectedPersonIds((current) => [...current, personId])}
            />
            {mode === "remove" && currentSpravceIds.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#4A5A7C]">Současní správci oblasti</p>
                <div className="flex flex-wrap gap-2">
                  {currentSpravceIds.map((personId) => {
                    const isOwn = currentPersonIdSet.has(personId);
                    const isSelected = selectedSet.has(personId);
                    return (
                      <button
                        key={personId}
                        type="button"
                        disabled={isOwn}
                        onClick={() => {
                          if (isOwn || isSelected) return;
                          setSelectedPersonIds((current) => [...current, personId]);
                        }}
                        className={
                          isOwn
                            ? "inline-flex items-center gap-1 rounded-full border border-[#D6DFF0] bg-[#EEF2F7] px-2 py-1 text-xs font-semibold text-[#7F88A0]"
                            : isSelected
                              ? "inline-flex items-center gap-1 rounded-full border border-[#C8372D] bg-[#FFF4F2] px-2 py-1 text-xs font-semibold text-[#9A231A]"
                              : "inline-flex items-center gap-1 rounded-full border border-[#D6DFF0] bg-white px-2 py-1 text-xs font-semibold text-[#0E2A5C] hover:border-[#C8372D]"
                        }
                        title={isOwn ? "Sebe nelze odebrat" : undefined}
                      >
                        {personById.get(personId)?.displayName ?? personId}
                        {isOwn ? " · vy" : isSelected ? " · odebrat" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {effectiveSelectedPersonIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {effectiveSelectedPersonIds.map((personId) => {
                  const isLocked = lockedOwnSpravceIds.includes(personId);
                  return (
                  <span
                    key={personId}
                    className="inline-flex items-center gap-1 rounded-full border border-[#D6DFF0] bg-white px-2 py-1 text-xs font-semibold text-[#0E2A5C]"
                  >
                    {personById.get(personId)?.displayName ?? personId}{isLocked ? " · vy" : ""}
                    {!isLocked && (
                      <button
                        type="button"
                        className="text-[#7F88A0] hover:text-[#C8372D]"
                        onClick={() => setSelectedPersonIds((current) => current.filter((id) => id !== personId))}
                        aria-label="Odebrat správce"
                      >
                        <X className="size-3" aria-hidden={true} />
                      </button>
                    )}
                  </span>
                );
                })}
              </div>
            )}
          </div>

          <div className="flex items-end">
            <Button type="submit" disabled={!canSubmit} className="w-full lg:w-auto">
              Uložit oblast
            </Button>
          </div>
          </div>

          <div className="rounded-[12px] border border-[#D6DFF0] bg-[#F8FAFC] p-3 text-sm text-[#4A5A7C]">
            <p className="font-semibold text-[#0E2A5C]">
              {selectedOblastIds.length === 0
                ? "Vyberte oblasti"
                : selectedOblastIds.length === 1
                  ? selectedOblasti[0]?.nazev
                  : `${selectedOblastIds.length} vybraných oblastí`}
            </p>
            <p className="mt-1">
              {selectedOblastIds.length === 0
                ? "Operace se provede až po výběru alespoň jedné oblasti."
                : selectedOblastIds.length === 1
                  ? `Aktuálně: ${selectedOblasti[0]?.spravciNames || "bez přiřazeného správce"}.`
                  : `Vybrané oblasti: ${selectedOblasti.slice(0, 5).map((oblast) => oblast.nazev).join(", ")}${selectedOblasti.length > 5 ? "..." : ""}`}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
