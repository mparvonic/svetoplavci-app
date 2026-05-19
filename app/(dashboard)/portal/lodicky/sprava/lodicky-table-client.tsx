"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Eye, Loader2, Pencil, Plus, Search, ShieldCheck, UsersRound, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { bulkUpdateLodickyManagementAction } from "./actions";
import type {
  LodickyManagementPersonOption,
  LodickyManagementRowsResult,
  TaxonomyOption,
} from "./data";

class SessionExpiredError extends Error {
  constructor(message = "Přihlášení vypršelo.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

type LodickyTableClientProps = {
  queryString: string;
  detailQuery: string;
  initialTotal: number;
  wholeFleet: boolean;
  canEditBasicFromList: boolean;
  scopeLabel: string;
  selectedSvpId: string | null;
  predmetOptions: TaxonomyOption[];
  podpredmetOptions: TaxonomyOption[];
  oblastOptions: TaxonomyOption[];
  spravceOptions: LodickyManagementPersonOption[];
  garantOptions: LodickyManagementPersonOption[];
  currentPersonIds: string[];
};

type Stupen = "I_STUPEN" | "II_STUPEN";

function formatStupen(value: string) {
  if (value === "I_STUPEN") return "I. stupeň";
  if (value === "II_STUPEN") return "II. stupeň";
  return value;
}

function isStupen(value: string): value is Stupen {
  return value === "I_STUPEN" || value === "II_STUPEN";
}

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

function personLabel(person: LodickyManagementPersonOption | undefined, fallback: string): string {
  return person?.displayName ?? fallback;
}

function buildPageHref(queryString: string, page: number | null) {
  const params = new URLSearchParams(queryString);
  if (!page || page <= 1) params.delete("page");
  else params.set("page", String(page));
  const query = params.toString();
  return query ? `/portal/lodicky/sprava?${query}` : "/portal/lodicky/sprava";
}

const LODICKY_MANAGEMENT_CACHE_TTL_MS = 15_000;
const lodickyManagementRequests = new Map<
  string,
  { expiresAt: number; promise: Promise<LodickyManagementRowsResult> }
>();

async function readApiErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const body = await response.json().catch(() => ({}));
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error.trim()) {
    return body.error;
  }
  return fallbackMessage;
}

function fetchLodickyManagementRows(requestUrl: string): Promise<LodickyManagementRowsResult> {
  const now = Date.now();
  const existing = lodickyManagementRequests.get(requestUrl);
  if (existing && existing.expiresAt > now) return existing.promise;
  if (existing) lodickyManagementRequests.delete(requestUrl);

  const request = fetch(requestUrl, {
    cache: "no-store",
    headers: { accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        const message = await readApiErrorMessage(response, "Nepodařilo se načíst lodičky.");
        if (response.status === 401) throw new SessionExpiredError(message);
        throw new Error(message);
      }
      return (await response.json()) as LodickyManagementRowsResult;
    })
    .catch((fetchError) => {
      lodickyManagementRequests.delete(requestUrl);
      throw fetchError;
    });

  lodickyManagementRequests.set(requestUrl, {
    expiresAt: now + LODICKY_MANAGEMENT_CACHE_TTL_MS,
    promise: request,
  });
  return request;
}

const inputClass =
  "h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20 disabled:bg-[#EEF2F7] disabled:text-[#7F88A0]";

const gradeByStupen: Record<Stupen, number[]> = {
  I_STUPEN: [1, 2, 3, 4, 5],
  II_STUPEN: [6, 7, 8, 9],
};

function pickInitialStupen(predmetOptions: TaxonomyOption[]): Stupen {
  const first = predmetOptions.find((option) => isStupen(option.stupen));
  return first && isStupen(first.stupen) ? first.stupen : "I_STUPEN";
}

function PersonSearchBox({
  value,
  onChange,
  options,
  excludedIds,
  onSelect,
  placeholder,
  emptyLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: LodickyManagementPersonOption[];
  excludedIds: Set<string>;
  onSelect: (id: string) => void;
  placeholder: string;
  emptyLabel: string;
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
        placeholder={placeholder}
        autoComplete="off"
        className={`${inputClass} pl-9`}
      />
      {value.trim() && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-[#D6DFF0] bg-white shadow-lg">
          {filteredOptions.length === 0 && (
            <div className="px-3 py-2 text-sm text-[#7F88A0]">{emptyLabel}</div>
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

function BulkActionsPanel({
  selectedIds,
  selectedRows,
  isOpen,
  onOpenChange,
  returnTo,
  selectedSvpId,
  canManageAreaSpravci,
  predmetOptions,
  podpredmetOptions,
  oblastOptions,
  spravceOptions,
  garantOptions,
  currentPersonIds,
  onClearSelection,
}: {
  selectedIds: string[];
  selectedRows: LodickyManagementRowsResult["rows"];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  returnTo: string;
  selectedSvpId: string;
  canManageAreaSpravci: boolean;
  predmetOptions: TaxonomyOption[];
  podpredmetOptions: TaxonomyOption[];
  oblastOptions: TaxonomyOption[];
  spravceOptions: LodickyManagementPersonOption[];
  garantOptions: LodickyManagementPersonOption[];
  currentPersonIds: string[];
  onClearSelection: () => void;
}) {
  const [applyClassification, setApplyClassification] = useState(false);
  const [applySpravci, setApplySpravci] = useState(false);
  const [applyGarant, setApplyGarant] = useState(false);
  const [stupen, setStupen] = useState<Stupen>(() => pickInitialStupen(predmetOptions));
  const [rocnikOd, setRocnikOd] = useState(() => gradeByStupen[pickInitialStupen(predmetOptions)][0]);
  const [rocnikDo, setRocnikDo] = useState(() => gradeByStupen[pickInitialStupen(predmetOptions)].at(-1) ?? 5);
  const [predmetId, setPredmetId] = useState("");
  const [podpredmetId, setPodpredmetId] = useState("");
  const [oblastId, setOblastId] = useState("");
  const [spravceMode, setSpravceMode] = useState<"add" | "replace" | "remove">("add");
  const [spravceIds, setSpravceIds] = useState<string[]>([]);
  const [spravceSearch, setSpravceSearch] = useState("");
  const [garantMode, setGarantMode] = useState<"add" | "replace" | "remove">("add");
  const [garantIds, setGarantIds] = useState<string[]>([]);
  const [garantSearch, setGarantSearch] = useState("");

  const selectedCount = selectedIds.length;
  const allowedGrades = gradeByStupen[stupen];
  const spravceById = useMemo(() => new Map(spravceOptions.map((person) => [person.id, person])), [spravceOptions]);
  const garantById = useMemo(() => new Map(garantOptions.map((person) => [person.id, person])), [garantOptions]);
  const selectedSpravceIdSet = useMemo(() => new Set(spravceIds), [spravceIds]);
  const selectedGarantIdSet = useMemo(() => new Set(garantIds), [garantIds]);
  const currentPersonIdSet = useMemo(() => new Set(currentPersonIds), [currentPersonIds]);
  const currentSpravceIds = useMemo(
    () => [...new Set(selectedRows.flatMap((row) => row.spravcePersonIds))],
    [selectedRows],
  );
  const lockedOwnSpravceIds = useMemo(
    () => spravceMode === "replace"
      ? currentSpravceIds.filter((personId) => currentPersonIdSet.has(personId))
      : [],
    [currentPersonIdSet, currentSpravceIds, spravceMode],
  );
  const effectiveSpravceIds = useMemo(
    () => [...new Set([...lockedOwnSpravceIds, ...spravceIds])],
    [lockedOwnSpravceIds, spravceIds],
  );
  const spravceSearchOptions = useMemo(() => {
    if (spravceMode === "remove") {
      const removableIds = new Set(currentSpravceIds.filter((personId) => !currentPersonIdSet.has(personId)));
      return spravceOptions.filter((person) => removableIds.has(person.id));
    }
    return spravceOptions;
  }, [currentPersonIdSet, currentSpravceIds, spravceMode, spravceOptions]);

  const filteredPredmetOptions = useMemo(
    () => predmetOptions.filter((option) => option.stupen === stupen),
    [predmetOptions, stupen],
  );
  const filteredPodpredmetOptions = useMemo(
    () => podpredmetOptions.filter((option) => option.stupen === stupen && option.predmetId === predmetId),
    [podpredmetOptions, predmetId, stupen],
  );
  const filteredOblastOptions = useMemo(
    () =>
      oblastOptions.filter(
        (option) =>
          option.stupen === stupen &&
          option.predmetId === predmetId &&
          (podpredmetId ? option.podpredmetId === podpredmetId : !option.podpredmetId),
      ),
    [oblastOptions, predmetId, podpredmetId, stupen],
  );

  useEffect(() => {
    const nextGrades = gradeByStupen[stupen];
    if (!nextGrades.includes(rocnikOd)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRocnikOd(nextGrades[0]);
    }
    if (!nextGrades.includes(rocnikDo)) {
      setRocnikDo(nextGrades.at(-1) ?? nextGrades[0]);
    }
  }, [rocnikDo, rocnikOd, stupen]);

  useEffect(() => {
    if (filteredPredmetOptions.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPredmetId("");
      setPodpredmetId("");
      setOblastId("");
      return;
    }
    if (!filteredPredmetOptions.some((option) => option.id === predmetId)) {
      setPredmetId(filteredPredmetOptions[0].id);
      setPodpredmetId("");
      setOblastId("");
    }
  }, [filteredPredmetOptions, predmetId]);

  useEffect(() => {
    if (podpredmetId && !filteredPodpredmetOptions.some((option) => option.id === podpredmetId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPodpredmetId("");
    }
  }, [filteredPodpredmetOptions, podpredmetId]);

  useEffect(() => {
    if (filteredOblastOptions.length === 0) {
      if (oblastId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOblastId("");
      }
      return;
    }
    if (!filteredOblastOptions.some((option) => option.id === oblastId)) {
      setOblastId(filteredOblastOptions[0].id);
    }
  }, [filteredOblastOptions, oblastId]);

  function handleRocnikOdChange(value: string) {
    const next = Number.parseInt(value, 10);
    setRocnikOd(next);
    if (next > rocnikDo) setRocnikDo(next);
  }

  function handleRocnikDoChange(value: string) {
    const next = Number.parseInt(value, 10);
    setRocnikDo(next);
    if (next < rocnikOd) setRocnikOd(next);
  }

  function addSpravce(id: string) {
    if (selectedSpravceIdSet.has(id)) return;
    setSpravceIds([...spravceIds, id]);
  }

  function addGarant(id: string) {
    if (selectedGarantIdSet.has(id)) return;
    setGarantIds([...garantIds, id]);
  }

  const canSubmit = selectedCount > 0 && (applyClassification || (canManageAreaSpravci && applySpravci) || applyGarant);

  return (
    <form action={bulkUpdateLodickyManagementAction} className="rounded-[12px] border border-[#D6DFF0] bg-[#F8FAFC] p-4">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="svpVersionId" value={selectedSvpId} />
      <input type="hidden" name="applyClassification" value={applyClassification ? "1" : "0"} />
      <input type="hidden" name="applySpravci" value={canManageAreaSpravci && applySpravci ? "1" : "0"} />
      <input type="hidden" name="applyGarant" value={applyGarant ? "1" : "0"} />
      {selectedIds.map((id) => <input key={id} type="hidden" name="lodickaIds" value={id} />)}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-[#0E2A5C]">
            <UsersRound className="size-4" aria-hidden={true} />
            Hromadné úpravy
          </div>
          <p className="mt-1 text-xs text-[#4A5A7C]">
            Vybráno: {selectedCount}. Zaškrtněte jen části, které chcete opravdu změnit.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClearSelection} disabled={selectedCount === 0}>
          Zrušit výběr
        </Button>
      </div>

      <div className="mt-3 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(!isOpen)}>
          {isOpen ? "Sbalit hromadné úpravy" : "Rozbalit hromadné úpravy"}
        </Button>
      </div>

      {isOpen && (
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {canManageAreaSpravci && (
        <div className="space-y-3 rounded-[12px] border border-[#D6DFF0] bg-white p-3">
          <label className="flex items-start gap-2 text-sm font-semibold text-[#0E2A5C]">
            <input
              type="checkbox"
              checked={applyClassification}
              onChange={(event) => setApplyClassification(event.target.checked)}
              className="mt-0.5 size-4 rounded border-[#D6DFF0] text-[#0E2A5C]"
            />
            Zařazení a období ročníků
          </label>
          <fieldset disabled={!applyClassification} className="grid gap-3 disabled:opacity-55">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Stupeň</span>
                <select name="stupen" value={stupen} onChange={(event) => setStupen(event.target.value as Stupen)} className={inputClass}>
                  <option value="I_STUPEN">I. stupeň</option>
                  <option value="II_STUPEN">II. stupeň</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Od</span>
                <select name="rocnikOd" value={rocnikOd} onChange={(event) => handleRocnikOdChange(event.target.value)} className={inputClass}>
                  {allowedGrades.map((rocnik) => <option key={rocnik} value={rocnik}>{rocnik}.</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Do</span>
                <select name="rocnikDo" value={rocnikDo} onChange={(event) => handleRocnikDoChange(event.target.value)} className={inputClass}>
                  {allowedGrades.map((rocnik) => <option key={rocnik} value={rocnik}>{rocnik}.</option>)}
                </select>
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">Předmět</span>
              <select
                name="predmetId"
                value={predmetId}
                onChange={(event) => {
                  setPredmetId(event.target.value);
                  setPodpredmetId("");
                  setOblastId("");
                }}
                className={inputClass}
              >
                {filteredPredmetOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.nazev}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">Podpředmět</span>
              <select
                name="podpredmetId"
                value={podpredmetId}
                onChange={(event) => {
                  setPodpredmetId(event.target.value);
                  setOblastId("");
                }}
                className={inputClass}
              >
                <option value="">Bez podpředmětu</option>
                {filteredPodpredmetOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.nazev}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">Oblast</span>
              <select name="oblastId" value={oblastId} onChange={(event) => setOblastId(event.target.value)} className={inputClass}>
                {filteredOblastOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.nazev}</option>
                ))}
              </select>
            </label>
          </fieldset>
        </div>
        )}

        {canManageAreaSpravci && (
        <div className="space-y-3 rounded-[12px] border border-[#D6DFF0] bg-white p-3">
          <label className="flex items-start gap-2 text-sm font-semibold text-[#0E2A5C]">
            <input
              type="checkbox"
              checked={applySpravci}
              onChange={(event) => setApplySpravci(event.target.checked)}
              className="mt-0.5 size-4 rounded border-[#D6DFF0] text-[#0E2A5C]"
            />
            Správci lodiček
          </label>
          <fieldset disabled={!applySpravci} className="space-y-3 disabled:opacity-55">
            <select name="spravceMode" value={spravceMode} onChange={(event) => setSpravceMode(event.target.value as "add" | "replace" | "remove")} className={inputClass}>
              <option value="add">Přidat k současným</option>
              <option value="replace">Nahradit současné</option>
              <option value="remove">Odebrat vybrané</option>
            </select>
            {effectiveSpravceIds.map((id) => <input key={id} type="hidden" name="spravcePersonIds" value={id} />)}
            {spravceMode === "remove" && currentSpravceIds.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#4A5A7C]">Současní správci ve výběru</p>
                <div className="flex flex-wrap gap-2">
                  {currentSpravceIds.map((id) => {
                    const isOwn = currentPersonIdSet.has(id);
                    const isSelected = selectedSpravceIdSet.has(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={isOwn}
                        onClick={() => {
                          if (isOwn || isSelected) return;
                          addSpravce(id);
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
                        {personLabel(spravceById.get(id), id)}
                        {isOwn ? " · vy" : isSelected ? " · odebrat" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {effectiveSpravceIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {effectiveSpravceIds.map((id) => {
                  const isLocked = lockedOwnSpravceIds.includes(id);
                  return (
                  <Badge key={id} variant="outline" className="gap-1 border-[#D6DFF0] bg-[#EEF2F7] text-slate-700">
                    {personLabel(spravceById.get(id), id)}{isLocked ? " · vy" : ""}
                    {!isLocked && (
                      <button type="button" onClick={() => setSpravceIds(spravceIds.filter((item) => item !== id))} className="ml-1 text-slate-500 hover:text-[#C8372D]">
                        <X className="size-3" />
                      </button>
                    )}
                  </Badge>
                );
                })}
              </div>
            )}
            <PersonSearchBox
              value={spravceSearch}
              onChange={setSpravceSearch}
              options={spravceSearchOptions}
              excludedIds={selectedSpravceIdSet}
              onSelect={addSpravce}
              placeholder="Vyhledat správce"
              emptyLabel="Žádný správce"
            />
            {spravceMode === "replace" && spravceIds.length === 0 && (
              <p className="text-xs font-semibold text-[#C8372D]">Uložením se vybraným lodičkám smažou všichni správci.</p>
            )}
          </fieldset>
        </div>
        )}

        <div className="space-y-3 rounded-[12px] border border-[#D6DFF0] bg-white p-3">
          <label className="flex items-start gap-2 text-sm font-semibold text-[#0E2A5C]">
            <input
              type="checkbox"
              checked={applyGarant}
              onChange={(event) => setApplyGarant(event.target.checked)}
              className="mt-0.5 size-4 rounded border-[#D6DFF0] text-[#0E2A5C]"
            />
            Garant změny stavu
          </label>
          <fieldset disabled={!applyGarant} className="space-y-3 disabled:opacity-55">
            <select name="garantMode" value={garantMode} onChange={(event) => setGarantMode(event.target.value as "add" | "replace" | "remove")} className={inputClass}>
              <option value="add">Přidat k současným</option>
              <option value="replace">Nahradit současné</option>
              <option value="remove">Odebrat vybrané</option>
            </select>
            {garantIds.map((id) => <input key={id} type="hidden" name="garantPersonIds" value={id} />)}
            {garantIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {garantIds.map((id) => (
                  <Badge key={id} variant="outline" className="gap-1 border-[#D6DFF0] bg-[#EEF2F7] text-slate-700">
                    {personLabel(garantById.get(id), id)}
                    <button type="button" onClick={() => setGarantIds(garantIds.filter((item) => item !== id))} className="ml-1 text-slate-500 hover:text-[#C8372D]">
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <PersonSearchBox
              value={garantSearch}
              onChange={setGarantSearch}
              options={garantOptions}
              excludedIds={selectedGarantIdSet}
              onSelect={addGarant}
              placeholder="Vyhledat garanta"
              emptyLabel="Žádný garant"
            />
            {garantMode === "replace" && garantIds.length === 0 && (
              <p className="text-xs font-semibold text-[#C8372D]">Uložením se vybraným lodičkám smažou všichni garanti.</p>
            )}
          </fieldset>
        </div>
      </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#4A5A7C]">
          Hromadná změna se použije jen na ručně vybrané lodičky v aktuálně načtené tabulce.
        </p>
        <Button type="submit" disabled={!canSubmit}>
          Uložit hromadné změny
        </Button>
      </div>
    </form>
  );
}

export function LodickyTableClient({
  queryString,
  detailQuery,
  initialTotal,
  wholeFleet,
  canEditBasicFromList,
  scopeLabel,
  selectedSvpId,
  predmetOptions,
  podpredmetOptions,
  oblastOptions,
  spravceOptions,
  garantOptions,
  currentPersonIds,
}: LodickyTableClientProps) {
  const [data, setData] = useState<LodickyManagementRowsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function hydrateRows() {
      try {
        const payload = await fetchLodickyManagementRows(`/api/m01/lodicky/sprava${queryString ? `?${queryString}` : ""}`);
        if (cancelled) return;
        setData(payload);
      } catch (fetchError: unknown) {
        if (cancelled) return;
        if (fetchError instanceof SessionExpiredError) {
          setError("Přihlášení vypršelo. Obnovte stránku nebo se znovu přihlaste.");
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Nepodařilo se načíst lodičky.");
        setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void hydrateRows();

    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const pageInfo = data?.pagination;
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const visibleRowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.has(row.id)), [rows, selectedIds]);
  const selectableRowIds = useMemo(() => (wholeFleet ? visibleRowIds : []), [visibleRowIds, wholeFleet]);
  const selectedVisibleCount = selectableRowIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = selectableRowIds.length > 0 && selectedVisibleCount === selectableRowIds.length;
  const total = data?.counts.total ?? initialTotal;
  const pageDescription = useMemo(() => {
    if (isLoading && !data) return `Načítám ${initialTotal} lodiček podle aktuálních filtrů.`;
    return `Zobrazuji ${rows.length} z ${total} lodiček podle aktuálních filtrů.`;
  }, [data, initialTotal, isLoading, rows.length, total]);

  useEffect(() => {
    const visibleIdSet = new Set(visibleRowIds);
    setSelectedIds((current) => {
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (visibleIdSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [visibleRowIds]);

  useEffect(() => {
    setBulkOpen(wholeFleet && selectedIds.size > 0);
  }, [selectedIds.size, wholeFleet]);

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedIds(checked ? new Set(selectableRowIds) : new Set());
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Lodičky</CardTitle>
            <CardDescription>{pageDescription}</CardDescription>
          </div>
          {scopeLabel && (
            <Badge variant="secondary">
              <ShieldCheck className="size-3" aria-hidden={true} />
              {scopeLabel}
            </Badge>
          )}
          {wholeFleet && selectedSvpId && (
            <Button asChild size="sm">
              <Link href={`/portal/lodicky/sprava/nova?svp=${encodeURIComponent(selectedSvpId)}`}>
                <Plus className="size-3.5" aria-hidden={true} />
                Nová lodička
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <div className="sv-placeholder flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden={true} />
            Načítám lodičky...
          </div>
        ) : error ? (
          <div className="sv-placeholder text-[#C8372D]">{error}</div>
        ) : rows.length === 0 ? (
          <div className="sv-placeholder">Pro zadané filtry nejsou dostupné žádné lodičky.</div>
        ) : (
          <div className="space-y-4">
            {wholeFleet && selectedSvpId && selectedIds.size > 0 && (
              <BulkActionsPanel
                selectedIds={[...selectedIds]}
                selectedRows={selectedRows}
                isOpen={bulkOpen}
                onOpenChange={setBulkOpen}
                returnTo={`/portal/lodicky/sprava${queryString ? `?${queryString}` : ""}`}
                selectedSvpId={selectedSvpId}
                canManageAreaSpravci={wholeFleet}
                predmetOptions={predmetOptions}
                podpredmetOptions={podpredmetOptions}
                oblastOptions={oblastOptions}
                spravceOptions={spravceOptions}
                garantOptions={garantOptions}
                currentPersonIds={currentPersonIds}
                onClearSelection={() => setSelectedIds(new Set())}
              />
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  {wholeFleet && selectedSvpId && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(event) => toggleAllVisible(event.target.checked)}
                        aria-label="Vybrat všechny lodičky na stránce"
                        className="size-4 rounded border-[#D6DFF0] text-[#0E2A5C]"
                      />
                    </TableHead>
                  )}
                  <TableHead>Kód</TableHead>
                  <TableHead>Lodička</TableHead>
                  <TableHead>Přístup</TableHead>
                  <TableHead>Zařazení</TableHead>
                  <TableHead>Ročníky</TableHead>
                  <TableHead>Mapa</TableHead>
                  <TableHead>OVU</TableHead>
                  <TableHead>Správci</TableHead>
                  <TableHead>Garant</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const canEditRow = canEditBasicFromList || row.canEditBasic;
                  return (
                    <TableRow
                      key={row.id}
                      className={canEditRow ? "border-l-4 border-l-[#0E2A5C] bg-[#F7FAFF]" : "border-l-4 border-l-transparent"}
                    >
                      {wholeFleet && selectedSvpId && (
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={(event) => toggleRow(row.id, event.target.checked)}
                            aria-label={`Vybrat lodičku ${row.nazev}`}
                            className="size-4 rounded border-[#D6DFF0] text-[#0E2A5C]"
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs text-[#4A5A7C]">{row.kod}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-[#0E2A5C]">{row.nazev}</div>
                      </TableCell>
                      <TableCell>
                        {canEditRow ? (
                          <Badge className="border-[#B9C8E4] bg-[#EAF1FF] text-[#0E2A5C] hover:bg-[#EAF1FF]">
                            <Pencil className="size-3" aria-hidden={true} />
                            {canEditBasicFromList ? "Editace" : "Moje"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-[#D6DFF0] bg-white text-[#7F88A0]">
                            <Eye className="size-3" aria-hidden={true} />
                            Jen detail
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-[#4A5A7C]">
                        <div>{row.predmet}</div>
                        <div className="text-xs text-[#7F88A0]">
                          {row.podpredmet ? `${row.podpredmet} · ` : ""}{row.oblast}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-[#4A5A7C]">
                        {row.rocnikOd}.–{row.rocnikDo}.<br />
                        <span className="text-xs text-[#7F88A0]">{formatStupen(row.stupen)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[#4A5A7C]">{row.jeVMape ? "Ano" : "Ne"}</span>
                      </TableCell>
                      <TableCell>
                        {row.ovuNotApplicable ? (
                          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-800">
                            nerelevantní
                          </Badge>
                        ) : (
                          <Badge variant={row.ovuCount > 0 ? "secondary" : "destructive"}>
                            {row.ovuCount > 0 ? row.ovuCount : "chybí"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[18rem] text-sm text-[#4A5A7C]">
                        {row.spravciCount > 0 ? (
                          <span>{row.spravciNames}</span>
                        ) : (
                          <span className="font-semibold text-[#C8372D]">bez správce</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-[#4A5A7C]">
                        {row.garantiNames ? row.garantiNames : <span className="font-semibold text-[#C8372D]">bez garanta</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant={canEditRow ? "default" : "outline"} size="sm">
                          <Link href={`/portal/lodicky/sprava/${row.id}${detailQuery ? `?${detailQuery}` : ""}`} prefetch={false}>
                            {canEditRow ? (
                              <Pencil className="size-3.5" aria-hidden={true} />
                            ) : (
                              <Eye className="size-3.5" aria-hidden={true} />
                            )}
                            {canEditRow ? "Upravit" : "Detail"}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {pageInfo && pageInfo.pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D6DFF0] px-4 py-3 text-sm text-[#4A5A7C]">
          <span>
            Strana {pageInfo.page} / {pageInfo.pageCount}
          </span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" aria-disabled={pageInfo.page <= 1}>
              <Link href={pageInfo.page <= 1 ? buildPageHref(queryString, null) : buildPageHref(queryString, pageInfo.page - 1)}>
                Předchozí
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" aria-disabled={pageInfo.page >= pageInfo.pageCount}>
              <Link
                href={
                  pageInfo.page >= pageInfo.pageCount
                    ? buildPageHref(queryString, pageInfo.page)
                    : buildPageHref(queryString, pageInfo.page + 1)
                }
              >
                Další
              </Link>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
