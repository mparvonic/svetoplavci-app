"use client";

import { useEffect, useMemo, useState } from "react";

import type { TaxonomyOption } from "./data";

type Stupen = "I_STUPEN" | "II_STUPEN";

type LodickaClassificationFieldsProps = {
  canEditFleetFields: boolean;
  initialStupen: string;
  initialRocnikOd: number;
  initialRocnikDo: number;
  initialPredmetId: string;
  initialPodpredmetId: string | null;
  initialOblastId: string;
  predmetOptions: TaxonomyOption[];
  podpredmetOptions: TaxonomyOption[];
  oblastOptions: TaxonomyOption[];
};

const inputClass =
  "h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20 disabled:bg-[#EEF2F7] disabled:text-[#7F88A0]";

const gradeByStupen: Record<Stupen, number[]> = {
  I_STUPEN: [1, 2, 3, 4, 5],
  II_STUPEN: [6, 7, 8, 9],
};

function isStupen(value: string): value is Stupen {
  return value === "I_STUPEN" || value === "II_STUPEN";
}

function normalizeStupen(value: string): Stupen {
  return isStupen(value) ? value : "I_STUPEN";
}

function clampGradeToStupen(value: number, stupen: Stupen) {
  const grades = gradeByStupen[stupen];
  if (grades.includes(value)) return value;
  return grades[0];
}

function formatStupen(value: Stupen) {
  return value === "I_STUPEN" ? "I. stupeň" : "II. stupeň";
}

export function LodickaClassificationFields({
  canEditFleetFields,
  initialStupen,
  initialRocnikOd,
  initialRocnikDo,
  initialPredmetId,
  initialPodpredmetId,
  initialOblastId,
  predmetOptions,
  podpredmetOptions,
  oblastOptions,
}: LodickaClassificationFieldsProps) {
  const [stupen, setStupen] = useState<Stupen>(normalizeStupen(initialStupen));
  const [rocnikOd, setRocnikOd] = useState(() => clampGradeToStupen(initialRocnikOd, normalizeStupen(initialStupen)));
  const [rocnikDo, setRocnikDo] = useState(() => clampGradeToStupen(initialRocnikDo, normalizeStupen(initialStupen)));
  const [predmetId, setPredmetId] = useState(initialPredmetId);
  const [podpredmetId, setPodpredmetId] = useState(initialPodpredmetId ?? "");
  const [oblastId, setOblastId] = useState(initialOblastId);

  const allowedGrades = gradeByStupen[stupen];
  const filteredPredmetOptions = useMemo(
    () => predmetOptions.filter((option) => option.stupen === stupen),
    [predmetOptions, stupen],
  );
  const filteredPodpredmetOptions = useMemo(
    () =>
      podpredmetOptions.filter(
        (option) => option.stupen === stupen && option.predmetId === predmetId,
      ),
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
    if (!allowedGrades.includes(rocnikOd)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRocnikOd(allowedGrades[0]);
    }
    if (!allowedGrades.includes(rocnikDo)) {
      setRocnikDo(allowedGrades[allowedGrades.length - 1]);
    }
  }, [allowedGrades, rocnikDo, rocnikOd]);

  useEffect(() => {
    if (filteredPredmetOptions.length === 0) return;
    if (!filteredPredmetOptions.some((option) => option.id === predmetId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function handleStupenChange(value: string) {
    const nextStupen = normalizeStupen(value);
    setStupen(nextStupen);
    setRocnikOd(clampGradeToStupen(rocnikOd, nextStupen));
    setRocnikDo(clampGradeToStupen(rocnikDo, nextStupen));
  }

  function handlePredmetChange(value: string) {
    setPredmetId(value);
    setPodpredmetId("");
    setOblastId("");
  }

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

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-[#4A5A7C]">Stupeň</span>
          <select
            name={canEditFleetFields ? "stupen" : undefined}
            value={stupen}
            disabled={!canEditFleetFields}
            onChange={(event) => handleStupenChange(event.target.value)}
            className={inputClass}
          >
            <option value="I_STUPEN">{formatStupen("I_STUPEN")}</option>
            <option value="II_STUPEN">{formatStupen("II_STUPEN")}</option>
          </select>
          {!canEditFleetFields && <input type="hidden" name="stupen" value={stupen} />}
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-[#4A5A7C]">Ročník od</span>
          <select
            name="rocnikOd"
            value={rocnikOd}
            disabled={!canEditFleetFields}
            onChange={(event) => handleRocnikOdChange(event.target.value)}
            className={inputClass}
          >
            {allowedGrades.map((rocnik) => (
              <option key={rocnik} value={rocnik}>{rocnik}. ročník</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-[#4A5A7C]">Ročník do</span>
          <select
            name="rocnikDo"
            value={rocnikDo}
            disabled={!canEditFleetFields}
            onChange={(event) => handleRocnikDoChange(event.target.value)}
            className={inputClass}
          >
            {allowedGrades.map((rocnik) => (
              <option key={rocnik} value={rocnik}>{rocnik}. ročník</option>
            ))}
          </select>
        </label>
      </div>

      {canEditFleetFields && (
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[#4A5A7C]">Předmět</span>
            <select
              name="predmetId"
              value={predmetId}
              onChange={(event) => handlePredmetChange(event.target.value)}
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
            <select
              name="oblastId"
              value={oblastId}
              onChange={(event) => setOblastId(event.target.value)}
              className={inputClass}
              required
            >
              {filteredOblastOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.nazev}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
