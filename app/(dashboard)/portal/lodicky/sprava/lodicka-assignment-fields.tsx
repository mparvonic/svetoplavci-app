"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, Search, TriangleAlert, UserPlus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import type { LodickyManagementOvuOption, LodickyManagementPersonOption } from "./data";

type LodickaAssignmentFieldsProps = {
  canEditFleetFields: boolean;
  ovuOptions: LodickyManagementOvuOption[];
  initialOvuIds: string[];
  initialOvuNotApplicable: boolean;
  initialStupen: string;
  spravceOptions: LodickyManagementPersonOption[];
  initialSpravceIds: string[];
  garantOptions: LodickyManagementPersonOption[];
  initialGarantIds: string[];
};

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

function stageLabel(stageCode: string | null, gradeNum: number | null): string {
  const parts = [];
  if (stageCode) parts.push(stageCode);
  if (gradeNum) parts.push(`${gradeNum}. ročník`);
  return parts.join(" · ");
}

function normalizeStupen(value: string): "I_STUPEN" | "II_STUPEN" {
  return value === "II_STUPEN" ? "II_STUPEN" : "I_STUPEN";
}

function ovuMatchesStupen(ovu: LodickyManagementOvuOption, stupen: string): boolean {
  return !ovu.uzlovyBodStupen || ovu.uzlovyBodStupen === stupen;
}

function ovuSearchText(ovu: LodickyManagementOvuOption): string {
  return normalizeSearchValue(
    [
      ovu.kod,
      ovu.uzlovyBod,
      ovu.uzlovyBodKod,
      ovu.uzlovyBodNazev,
      ovu.zneni,
    ].filter(Boolean).join(" "),
  );
}

function OvuDetail({ ovu }: { ovu: LodickyManagementOvuOption }) {
  const stage = stageLabel(ovu.uzlovyBodStupen, ovu.uzlovyBodRocnik);

  return (
    <span className="block min-w-0 space-y-1 text-xs">
      <span className="block font-semibold text-[#0E2A5C]">{ovu.kod}</span>
      {ovu.uzlovyBod && <span className="block text-slate-500">{ovu.uzlovyBod}</span>}
      {stage && <span className="block text-slate-500">{stage}</span>}
      <span className="block text-slate-700">{ovu.zneni}</span>
    </span>
  );
}

export function LodickaAssignmentFields({
  canEditFleetFields,
  ovuOptions,
  initialOvuIds,
  initialOvuNotApplicable,
  initialStupen,
  spravceOptions,
  initialSpravceIds,
  garantOptions,
  initialGarantIds,
}: LodickaAssignmentFieldsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [ovuIds, setOvuIds] = useState<string[]>(initialOvuNotApplicable ? [] : initialOvuIds);
  const [ovuNotApplicable, setOvuNotApplicable] = useState(initialOvuNotApplicable);
  const [ovuSearch, setOvuSearch] = useState("");
  const [stupen, setStupen] = useState(() => normalizeStupen(initialStupen));
  const [spravceIds, setSpravceIds] = useState(initialSpravceIds);
  const [spravceSearch, setSpravceSearch] = useState("");
  const [garantIds, setGarantIds] = useState(initialGarantIds);
  const [garantSearch, setGarantSearch] = useState("");

  const ovuById = useMemo(() => new Map(ovuOptions.map((ovu) => [ovu.id, ovu])), [ovuOptions]);
  const spravceById = useMemo(() => new Map(spravceOptions.map((person) => [person.id, person])), [spravceOptions]);
  const garantById = useMemo(() => new Map(garantOptions.map((person) => [person.id, person])), [garantOptions]);
  const selectedOvuIdSet = useMemo(() => new Set(ovuIds), [ovuIds]);
  const selectedSpravceIdSet = useMemo(() => new Set(spravceIds), [spravceIds]);
  const selectedGarantIdSet = useMemo(() => new Set(garantIds), [garantIds]);
  const visibleOvuOptions = useMemo(
    () => ovuOptions.filter((ovu) => ovuMatchesStupen(ovu, stupen)),
    [ovuOptions, stupen],
  );

  useEffect(() => {
    const root = rootRef.current;
    const form = root?.closest("form");
    if (!form) return;

    const syncStupen = () => {
      const value = new FormData(form).get("stupen");
      if (typeof value === "string") setStupen(normalizeStupen(value));
    };

    syncStupen();
    form.addEventListener("change", syncStupen);
    return () => form.removeEventListener("change", syncStupen);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOvuIds((current) => current.filter((id) => {
      const ovu = ovuById.get(id);
      return !ovu || ovuMatchesStupen(ovu, stupen);
    }));
  }, [ovuById, stupen]);

  const filteredOvuOptions = useMemo(() => {
    const query = normalizeSearchValue(ovuSearch.trim());
    if (!query) return [];
    return visibleOvuOptions
      .filter((ovu) => !selectedOvuIdSet.has(ovu.id))
      .filter((ovu) => ovuSearchText(ovu).includes(query))
      .slice(0, 10);
  }, [visibleOvuOptions, ovuSearch, selectedOvuIdSet]);

  function addOvu(id: string) {
    if (selectedOvuIdSet.has(id)) return;
    setOvuIds([...ovuIds, id]);
    setOvuSearch("");
  }

  function removeOvu(id: string) {
    setOvuIds(ovuIds.filter((item) => item !== id));
  }

  function setNoOvu(nextValue: boolean) {
    setOvuNotApplicable(nextValue);
    if (nextValue) {
      setOvuIds([]);
      setOvuSearch("");
    }
  }

  function addSpravce(id: string) {
    if (selectedSpravceIdSet.has(id)) return;
    setSpravceIds([...spravceIds, id]);
    setSpravceSearch("");
  }

  function removeSpravce(id: string) {
    setSpravceIds(spravceIds.filter((item) => item !== id));
  }

  function addGarant(id: string) {
    if (selectedGarantIdSet.has(id)) return;
    setGarantIds([...garantIds, id]);
    setGarantSearch("");
  }

  function removeGarant(id: string) {
    setGarantIds(garantIds.filter((item) => item !== id));
  }

  return (
    <div ref={rootRef} className="space-y-4">
      <input type="hidden" name="ovuNotApplicable" value={ovuNotApplicable ? "1" : "0"} />
      {!ovuNotApplicable && ovuIds.map((id) => <input key={id} type="hidden" name="ovuIds" value={id} />)}

      <div className="space-y-3">
        {ovuNotApplicable ? (
          <div className="flex items-start gap-2 rounded-[12px] border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden={true} />
            <span>
              <span className="block font-semibold">OVU je vědomě označené jako nerelevantní.</span>
              <span className="block text-xs">Tento stav se nepočítá mezi chybějící OVU vazby.</span>
            </span>
          </div>
        ) : ovuIds.length === 0 ? (
          <div className="flex items-start gap-2 rounded-[12px] border border-[#F2C7C1] bg-[#FFF4F2] px-3 py-2 text-sm text-[#9A231A]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden={true} />
            <span>
              <span className="block font-semibold">Chybí OVU vazba.</span>
              <span className="block text-xs">
                Přiřaďte alespoň jedno OVU, nebo označte, že lodička OVU nemá.
              </span>
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-[12px] border border-[#D6DFF0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#4A5A7C]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#0E2A5C]" aria-hidden={true} />
            <span>
              <span className="block font-semibold text-[#0E2A5C]">OVU vazba je doplněná.</span>
              <span className="block text-xs">Přiřazeno: {ovuIds.length}</span>
            </span>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-[12px] border border-[#D6DFF0] bg-[#F8FAFC] px-3 py-2">
          <input
            id="ovu-not-applicable"
            type="checkbox"
            checked={ovuNotApplicable}
            disabled={!canEditFleetFields}
            onChange={(event) => setNoOvu(event.target.checked)}
            className="mt-1 size-4 rounded border-[#D6DFF0] text-[#0E2A5C]"
          />
          <label htmlFor="ovu-not-applicable" className="text-sm text-[#4A5A7C]">
            <span className="block font-semibold text-[#0E2A5C]">Lodička nemá vazbu na OVU</span>
            <span className="block text-xs">Použijte jen když je to vědomé rozhodnutí, ne chybějící doplnění.</span>
          </label>
        </div>

        {!ovuNotApplicable && (
          <>
            {ovuIds.length > 0 && (
              <div className="space-y-2">
                {ovuIds.map((id) => {
                  const ovu = ovuById.get(id);
                  return (
                    <div key={id} className="rounded-[12px] border border-[#D6DFF0] bg-[#EEF2F7] p-3 text-sm text-slate-700">
                      {ovu ? <OvuDetail ovu={ovu} /> : <span>{id}</span>}
                      {canEditFleetFields && (
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-1 rounded-full text-xs font-semibold text-slate-500 hover:text-[#C8372D]"
                          onClick={() => removeOvu(id)}
                          aria-label="Odebrat OVU"
                        >
                          <X className="size-3" /> Odebrat
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {canEditFleetFields && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={ovuSearch}
                  onChange={(event) => setOvuSearch(event.target.value)}
                  placeholder={`Vyhledat OVU pro ${stupen === "I_STUPEN" ? "I. stupeň" : "II. stupeň"}`}
                  className="pl-9"
                />
                {ovuSearch.trim() && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-[#D6DFF0] bg-white shadow-lg">
                    {filteredOvuOptions.length === 0 && (
                      <div className="px-3 py-2 text-sm text-slate-500">Žádné OVU</div>
                    )}
                    {filteredOvuOptions.map((ovu) => (
                      <button
                        key={ovu.id}
                        type="button"
                        className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-[#EEF2F7]"
                        onClick={() => addOvu(ovu.id)}
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-slate-500" />
                        <OvuDetail ovu={ovu} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {canEditFleetFields && (
        <div className="space-y-4 border-t border-[#D6DFF0] pt-4">
          {spravceIds.map((id) => <input key={id} type="hidden" name="spravcePersonIds" value={id} />)}
          {garantIds.map((id) => <input key={id} type="hidden" name="garantPersonIds" value={id} />)}

          <div className="space-y-3">
            <span className="text-xs font-semibold text-[#4A5A7C]">Správci lodičky</span>
            {spravceIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {spravceIds.map((id) => (
                  <Badge key={id} variant="outline" className="gap-1 border-[#D6DFF0] bg-[#EEF2F7] text-slate-700">
                    {personLabel(spravceById.get(id), id)}
                    <button
                      type="button"
                      className="ml-1 rounded-full text-slate-500 hover:text-[#C8372D]"
                      onClick={() => removeSpravce(id)}
                      aria-label={`Odebrat ${personLabel(spravceById.get(id), id)}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <PersonSearchInput
              value={spravceSearch}
              onChange={setSpravceSearch}
              placeholder="Vyhledat správce lodičky"
              options={spravceOptions}
              excludedIds={selectedSpravceIdSet}
              onSelect={addSpravce}
              emptyLabel="Žádný správce"
            />
          </div>

          <div className="space-y-3">
            <span className="text-xs font-semibold text-[#4A5A7C]">Garant změny stavu</span>
            {garantIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {garantIds.map((id) => (
                  <Badge key={id} variant="outline" className="gap-1 border-[#D6DFF0] bg-[#EEF2F7] text-slate-700">
                    {personLabel(garantById.get(id), id)}
                    <button
                      type="button"
                      className="ml-1 rounded-full text-slate-500 hover:text-[#C8372D]"
                      onClick={() => removeGarant(id)}
                      aria-label={`Odebrat ${personLabel(garantById.get(id), id)}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <PersonSearchInput
              value={garantSearch}
              onChange={setGarantSearch}
              placeholder="Vyhledat garanta"
              options={garantOptions}
              excludedIds={selectedGarantIdSet}
              onSelect={addGarant}
              emptyLabel="Žádný garant"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PersonSearchInput({
  value,
  onChange,
  placeholder,
  options,
  excludedIds,
  onSelect,
  emptyLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: LodickyManagementPersonOption[];
  excludedIds?: Set<string>;
  onSelect: (id: string) => void;
  emptyLabel: string;
}) {
  const query = normalizeSearchValue(value);
  const queryParts = query.split(/\s+/).filter(Boolean);
  const filteredOptions = queryParts.length === 0
    ? []
    : options
        .filter((person) => !excludedIds?.has(person.id))
        .filter((person) => {
          const haystack = personSearchText(person);
          return queryParts.every((part) => haystack.includes(part));
        })
        .slice(0, 8);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        data-1p-ignore="true"
        data-lpignore="true"
      />
      {value.trim() && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-[#D6DFF0] bg-white shadow-lg">
          {filteredOptions.length === 0 && <div className="px-3 py-2 text-sm text-slate-500">{emptyLabel}</div>}
          {filteredOptions.map((person) => (
            <button
              key={person.id}
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#EEF2F7]"
              onClick={() => onSelect(person.id)}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-[#0E2A5C]">{person.displayName}</span>
                {person.legalName !== person.displayName && (
                  <span className="block truncate text-xs text-slate-500">{person.legalName}</span>
                )}
                {person.email && <span className="block truncate text-xs text-slate-500">{person.email}</span>}
              </span>
              <UserPlus className="size-4 shrink-0 text-slate-500" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
