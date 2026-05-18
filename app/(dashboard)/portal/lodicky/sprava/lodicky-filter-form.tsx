"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { LodickyManagementFilters, SvpVersionSummary, TaxonomyOption } from "./data";

type Stupen = "" | "I_STUPEN" | "II_STUPEN";

type LodickyFilterFormProps = {
  filters: LodickyManagementFilters;
  svpVersions: SvpVersionSummary[];
  selectedSvpId: string;
  listScope: string;
  clearHref: string;
  predmetOptions: TaxonomyOption[];
  podpredmetOptions: TaxonomyOption[];
  oblastOptions: TaxonomyOption[];
};

const selectClass =
  "h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20";
const disabledSelectClass = `${selectClass} disabled:cursor-not-allowed disabled:bg-[#F3F6FB] disabled:text-[#7F88A0] disabled:opacity-70`;

const gradesByStupen = {
  I_STUPEN: [1, 2, 3, 4, 5],
  II_STUPEN: [6, 7, 8, 9],
} satisfies Record<Exclude<Stupen, "">, number[]>;

export function LodickyFilterForm({
  filters,
  svpVersions,
  selectedSvpId,
  listScope,
  clearHref,
  predmetOptions,
  podpredmetOptions,
  oblastOptions,
}: LodickyFilterFormProps) {
  const [stupen, setStupen] = useState<Stupen>(filters.stupen);
  const [rocnik, setRocnik] = useState(filters.rocnik ? String(filters.rocnik) : "");
  const [predmetId, setPredmetId] = useState(filters.predmetId);
  const [podpredmetId, setPodpredmetId] = useState(filters.podpredmetId);
  const [oblastId, setOblastId] = useState(filters.oblastId);
  const hasStupen = stupen === "I_STUPEN" || stupen === "II_STUPEN";

  const availableGrades = hasStupen ? gradesByStupen[stupen] : [];
  const filteredPredmetOptions = useMemo(
    () => (hasStupen ? predmetOptions.filter((option) => option.stupen === stupen) : []),
    [hasStupen, predmetOptions, stupen],
  );
  const filteredPodpredmetOptions = useMemo(
    () => (hasStupen
      ? podpredmetOptions.filter((option) => option.stupen === stupen && (!predmetId || option.predmetId === predmetId))
      : []),
    [hasStupen, podpredmetOptions, predmetId, stupen],
  );
  const filteredOblastOptions = useMemo(
    () => (hasStupen
      ? oblastOptions.filter((option) => (
        option.stupen === stupen &&
        (!predmetId || option.predmetId === predmetId) &&
        (!podpredmetId || option.podpredmetId === podpredmetId)
      ))
      : []),
    [hasStupen, oblastOptions, podpredmetId, predmetId, stupen],
  );

  function handleStupenChange(value: string) {
    const nextStupen = value === "I_STUPEN" || value === "II_STUPEN" ? value : "";
    setStupen(nextStupen);
    setRocnik("");
    setPredmetId("");
    setPodpredmetId("");
    setOblastId("");
  }

  function handlePredmetChange(value: string) {
    setPredmetId(value);
    setPodpredmetId("");
    setOblastId("");
  }

  function handlePodpredmetChange(value: string) {
    setPodpredmetId(value);
    setOblastId("");
  }

  return (
    <form action="/portal/lodicky/sprava" className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(12rem,1fr)]">
      <input type="hidden" name="tab" value="seznam" />
      <input type="hidden" name="scope" value={listScope} />
      <label className="space-y-1">
        <span className="text-xs font-semibold text-[#4A5A7C]">Hledat</span>
        <Input name="q" defaultValue={filters.q} placeholder="Kód, název, oblast..." />
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-[#4A5A7C]">Sada</span>
        <select name="svp" defaultValue={selectedSvpId} className={selectClass}>
          {svpVersions.map((svp) => (
            <option key={svp.id} value={svp.id}>{svp.label}{svp.isCurrent ? " · aktuální" : ""}</option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-[#4A5A7C]">Stupeň</span>
        <select name="stupen" value={stupen} onChange={(event) => handleStupenChange(event.target.value)} className={selectClass}>
          <option value="">Všechny</option>
          <option value="I_STUPEN">I. stupeň</option>
          <option value="II_STUPEN">II. stupeň</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-[#4A5A7C]">Ročník</span>
        <select name="rocnik" value={rocnik} onChange={(event) => setRocnik(event.target.value)} disabled={!hasStupen} className={disabledSelectClass}>
          <option value="">{hasStupen ? "Všechny" : "Nejprve vyberte stupeň"}</option>
          {availableGrades.map((grade) => (
            <option key={grade} value={grade}>{grade}. ročník</option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-[#4A5A7C]">Předmět</span>
        <select name="predmet" value={predmetId} onChange={(event) => handlePredmetChange(event.target.value)} disabled={!hasStupen} className={disabledSelectClass}>
          <option value="">{hasStupen ? "Všechny" : "Nejprve vyberte stupeň"}</option>
          {filteredPredmetOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.nazev}</option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-[#4A5A7C]">Podpředmět</span>
        <select name="podpredmet" value={podpredmetId} onChange={(event) => handlePodpredmetChange(event.target.value)} disabled={!hasStupen} className={disabledSelectClass}>
          <option value="">{hasStupen ? "Všechny" : "Nejprve vyberte stupeň"}</option>
          {filteredPodpredmetOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.nazev}</option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-[#4A5A7C]">Oblast</span>
        <select name="oblast" value={oblastId} onChange={(event) => setOblastId(event.target.value)} disabled={!hasStupen} className={disabledSelectClass}>
          <option value="">{hasStupen ? "Všechny" : "Nejprve vyberte stupeň"}</option>
          {filteredOblastOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.nazev}</option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold text-[#4A5A7C]">Kontrola</span>
        <select name="coverage" defaultValue={filters.coverage} className={selectClass}>
          <option value="">Vše</option>
          <option value="bez-ovu">Chybí OVU</option>
          <option value="ovu-nerelevantni">OVU není relevantní</option>
          <option value="bez-spravce">Bez správce</option>
          <option value="bez-garanta">Bez garanta</option>
        </select>
      </label>
      <div className="flex items-end gap-2 lg:col-span-4">
        <Button type="submit">Filtrovat</Button>
        <Button asChild variant="outline">
          <Link href={clearHref}>Vymazat</Link>
        </Button>
      </div>
    </form>
  );
}
