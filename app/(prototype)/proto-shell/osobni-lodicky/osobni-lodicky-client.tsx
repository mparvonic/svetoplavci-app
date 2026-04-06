"use client";

import { Suspense, type ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronUp, Filter, Info, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProtoDebugPanel, createProtoDebugEvent, type ProtoDebugEvent } from "@/components/proto/proto-debug-panel";
import { ProtoEdgePanel } from "@/components/proto/proto-edge-panel";
import {
  LODICKA_STAV_LABEL,
  PROTO_LODICKY_CATALOG,
  PROTO_OSOBNI_LODICKA_EVENTS,
  PROTO_OSOBNI_LODICKY,
  PROTO_QUICK_NAV,
  PROTO_ROLE_OPTIONS,
  PROTO_STUDENTS,
  getActiveSemesterBounds,
  getActorLabel,
  getActorsByRole,
  getParentChildren,
  getTodayIsoForProto,
  type LodickaStav,
  type ProtoLodickaCatalogItem,
  type ProtoOsobniLodicka,
  type ProtoOsobniLodickaEvent,
  type ProtoRoleId,
  type ProtoStudent,
} from "@/src/lib/mock/proto-lodicky-playground";
import { UI_CLASSES } from "@/src/lib/design-pack/ui";

type ScopeMode = "moje" | "vsechny";
type ViewMode = "po_lodickach" | "po_lidech";
type LideGroupBy = "rocniky" | "smecky";
type LodickyGroupMode = "ano" | "ne";

type PersonalWithSnapshot = {
  personal: ProtoOsobniLodicka;
  student: ProtoStudent;
  lodicka: ProtoLodickaCatalogItem;
  stav: LodickaStav;
  lastEvent: ProtoOsobniLodickaEvent | null;
};

type SearchSuggestion = {
  id: string;
  label: string;
  type: "smecka" | "student" | "lodicka" | "oblast" | "predmet";
  value: string;
};

type PaneSort = "nazev" | "garant" | "jmeno" | "rocnik" | "stav";

const DEFAULT_ROLE: ProtoRoleId = "garant";
const RIGHT_TABLE_LODICKY = "T321";
const RIGHT_TABLE_LIDE = "T322";

function OsobniLodickyPrototypePageInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const todayIso = getTodayIsoForProto();
  const semesterBounds = getActiveSemesterBounds(todayIso);

  const [activeRole, setActiveRole] = useState<ProtoRoleId>(normalizeRole(searchParams.get("role")));
  const queryUserId = searchParams.get("user") ?? "";
  const usersForRole = useMemo(() => getActorsByRole(activeRole), [activeRole]);

  const [selectedUserId, setSelectedUserId] = useState<string>(queryUserId);
  const activeUserId = useMemo(
    () =>
      usersForRole.some((item) => item.id === selectedUserId)
        ? selectedUserId
        : (usersForRole[0]?.id ?? ""),
    [selectedUserId, usersForRole],
  );

  const [scopeMode, setScopeMode] = useState<ScopeMode>("moje");
  const [viewMode, setViewMode] = useState<ViewMode>("po_lodickach");
  const [viewDate, setViewDate] = useState<string>(semesterBounds.maxDate);

  const [peopleStupenFilter, setPeopleStupenFilter] = useState<string[]>([]);
  const [peopleRocnikFilter, setPeopleRocnikFilter] = useState<string[]>([]);
  const [peopleSmeckaFilter, setPeopleSmeckaFilter] = useState<string[]>([]);

  const [lodickyPredmetFilter, setLodickyPredmetFilter] = useState<string[]>([]);
  const [lodickyPodpredmetFilter, setLodickyPodpredmetFilter] = useState<string[]>([]);
  const [lodickyOblastFilter, setLodickyOblastFilter] = useState<string[]>([]);
  const [lodickyGarantFilter, setLodickyGarantFilter] = useState<string[]>([]);

  const [searchInput, setSearchInput] = useState("");
  const [leftSort, setLeftSort] = useState<PaneSort>("nazev");
  const [rightSort, setRightSort] = useState<PaneSort>("jmeno");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [lideGroupBy, setLideGroupBy] = useState<LideGroupBy>("rocniky");
  const [lodickyGroupMode, setLodickyGroupMode] = useState<LodickyGroupMode>("ano");
  const [historyDetailEventId, setHistoryDetailEventId] = useState<string | null>(null);

  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedPersonalId, setSelectedPersonalId] = useState<string | null>(null);

  const [events, setEvents] = useState<ProtoOsobniLodickaEvent[]>(PROTO_OSOBNI_LODICKA_EVENTS);
  const [debugEvents, setDebugEvents] = useState<ProtoDebugEvent[]>([]);

  useEffect(() => {
    if (!activeUserId) return;
    const params = new URLSearchParams();
    params.set("role", activeRole);
    params.set("user", activeUserId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeRole, activeUserId, pathname, router]);

  const activeUser = usersForRole.find((item) => item.id === activeUserId) ?? usersForRole[0] ?? null;
  const effectiveViewDate = clampDate(viewDate, semesterBounds.minDate, semesterBounds.maxDate);

  const isReadonly = activeRole === "rodic" || activeRole === "zak";
  const effectiveScope: ScopeMode = activeRole === "garant" || activeRole === "spravce" ? scopeMode : "moje";
  const showGarantContext = effectiveScope === "vsechny";
  const effectiveLeftSort: PaneSort =
    !showGarantContext && leftSort === "garant" ? "nazev" : leftSort;

  const studentsById = useMemo(
    () => new Map(PROTO_STUDENTS.map((student) => [student.id, student])),
    [],
  );
  const lodickyById = useMemo(
    () => new Map(PROTO_LODICKY_CATALOG.map((lodicka) => [lodicka.id, lodicka])),
    [],
  );

  const eventsByPersonal = useMemo(() => {
    const map = new Map<string, ProtoOsobniLodickaEvent[]>();
    events.forEach((event) => {
      const bucket = map.get(event.osobniLodickaId) ?? [];
      bucket.push(event);
      map.set(event.osobniLodickaId, bucket);
    });

    map.forEach((bucket) => {
      bucket.sort((a, b) =>
        a.datumStavu === b.datumStavu
          ? a.zapsanoAt.localeCompare(b.zapsanoAt)
          : a.datumStavu.localeCompare(b.datumStavu),
      );
    });

    return map;
  }, [events]);

  const statusSnapshotByPersonal = useMemo(() => {
    const map = new Map<string, { stav: LodickaStav; lastEvent: ProtoOsobniLodickaEvent | null }>();

    PROTO_OSOBNI_LODICKY.forEach((item) => {
      const personalEvents = eventsByPersonal.get(item.id) ?? [];
      let selected: ProtoOsobniLodickaEvent | null = null;
      for (const event of personalEvents) {
        if (event.datumStavu <= effectiveViewDate) {
          selected = event;
        }
      }
      map.set(item.id, {
        stav: selected?.stav ?? 0,
        lastEvent: selected,
      });
    });

    return map;
  }, [effectiveViewDate, eventsByPersonal]);

  const accessibleStudents = useMemo(() => {
    if (!activeUser) return [] as ProtoStudent[];

    if (activeRole === "zak" && activeUser.linkedStudentId) {
      return PROTO_STUDENTS.filter((student) => student.id === activeUser.linkedStudentId);
    }

    if (activeRole === "rodic") {
      return getParentChildren(activeUser.id);
    }

    return PROTO_STUDENTS;
  }, [activeRole, activeUser]);

  const filteredStudents = useMemo(() => {
    return accessibleStudents.filter((student) => {
      if (peopleStupenFilter.length > 0 && !peopleStupenFilter.includes(String(student.stupen))) {
        return false;
      }
      if (peopleRocnikFilter.length > 0 && !peopleRocnikFilter.includes(String(student.rocnik))) {
        return false;
      }
      if (peopleSmeckaFilter.length > 0 && !peopleSmeckaFilter.includes(student.smecka)) {
        return false;
      }
      if (searchInput.trim() && viewMode === "po_lidech") {
        const needle = searchInput.trim().toLowerCase();
        const haystack = `${student.prezdivka} ${student.jmeno}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [accessibleStudents, peopleRocnikFilter, peopleSmeckaFilter, peopleStupenFilter, searchInput, viewMode]);

  const filteredLodicky = useMemo(() => {
    return PROTO_LODICKY_CATALOG.filter((lodicka) => {
      if (effectiveScope === "moje" && activeRole === "garant" && activeUserId) {
        if (lodicka.garantId !== activeUserId) return false;
      }
      if (lodickyPredmetFilter.length > 0 && !lodickyPredmetFilter.includes(lodicka.predmet)) {
        return false;
      }
      if (
        lodickyPodpredmetFilter.length > 0 &&
        !lodickyPodpredmetFilter.includes(lodicka.podpředmět ?? "-")
      ) {
        return false;
      }
      if (lodickyOblastFilter.length > 0 && !lodickyOblastFilter.includes(lodicka.oblast)) {
        return false;
      }
      if (
        showGarantContext &&
        lodickyGarantFilter.length > 0 &&
        !lodickyGarantFilter.includes(getActorLabel(lodicka.garantId))
      ) {
        return false;
      }
      if (searchInput.trim() && viewMode === "po_lodickach") {
        const needle = searchInput.trim().toLowerCase();
        const haystack = `${lodicka.nazev} ${lodicka.popis}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [
    activeRole,
    activeUserId,
    effectiveScope,
    lodickyGarantFilter,
    lodickyOblastFilter,
    lodickyPodpredmetFilter,
    lodickyPredmetFilter,
    searchInput,
    showGarantContext,
    viewMode,
  ]);

  const filteredStudentIds = useMemo(
    () => new Set(filteredStudents.map((student) => student.id)),
    [filteredStudents],
  );
  const filteredLodickaIds = useMemo(
    () => new Set(filteredLodicky.map((lodicka) => lodicka.id)),
    [filteredLodicky],
  );

  const personalRows = useMemo(() => {
    const rows: PersonalWithSnapshot[] = [];

    PROTO_OSOBNI_LODICKY.forEach((personal) => {
      if (!filteredStudentIds.has(personal.studentId)) return;
      if (!filteredLodickaIds.has(personal.lodickaId)) return;

      const student = studentsById.get(personal.studentId);
      const lodicka = lodickyById.get(personal.lodickaId);
      if (!student || !lodicka) return;

      const snapshot = statusSnapshotByPersonal.get(personal.id);

      rows.push({
        personal,
        student,
        lodicka,
        stav: snapshot?.stav ?? 0,
        lastEvent: snapshot?.lastEvent ?? null,
      });
    });

    return rows;
  }, [filteredLodickaIds, filteredStudentIds, lodickyById, statusSnapshotByPersonal, studentsById]);

  const leftItems = useMemo(() => {
    if (viewMode === "po_lodickach") {
      const lodickaWithCount = filteredLodicky
        .map((lodicka) => ({
          lodicka,
          count: personalRows.filter((row) => row.lodicka.id === lodicka.id).length,
        }))
        .filter((item) => item.count > 0);

      return sortLeftPaneLodicky(lodickaWithCount, effectiveLeftSort);
    }

    const studentsWithCount = filteredStudents
      .map((student) => ({
        student,
        count: personalRows.filter((row) => row.student.id === student.id).length,
      }))
      .filter((item) => item.count > 0);

    return sortLeftPaneStudents(studentsWithCount, effectiveLeftSort);
  }, [effectiveLeftSort, filteredLodicky, filteredStudents, personalRows, viewMode]);

  const selectedLeftIdEffective = useMemo(() => {
    const leftIds = leftItems.map((item) => ("lodicka" in item ? item.lodicka.id : item.student.id));
    if (leftIds.length === 0) return null;
    if (selectedLeftId && leftIds.includes(selectedLeftId)) return selectedLeftId;
    return leftIds[0];
  }, [leftItems, selectedLeftId]);

  const rightRows = useMemo(() => {
    if (!selectedLeftIdEffective) return [] as PersonalWithSnapshot[];

    const result =
      viewMode === "po_lodickach"
        ? personalRows.filter((row) => row.lodicka.id === selectedLeftIdEffective)
        : personalRows.filter((row) => row.student.id === selectedLeftIdEffective);

    return sortRightPane(result, rightSort, viewMode);
  }, [personalRows, rightSort, selectedLeftIdEffective, viewMode]);

  const selectedPersonalEffective = useMemo(() => {
    if (rightRows.length === 0) return null;
    if (selectedPersonalId && rightRows.some((row) => row.personal.id === selectedPersonalId)) {
      return selectedPersonalId;
    }
    return rightRows[0]?.personal.id ?? null;
  }, [rightRows, selectedPersonalId]);

  const selectedPersonalRow = rightRows.find((row) => row.personal.id === selectedPersonalEffective) ?? null;
  const selectedPersonalHistory = (selectedPersonalEffective
    ? [...(eventsByPersonal.get(selectedPersonalEffective) ?? [])]
    : []
  ).sort((a, b) =>
    a.datumStavu === b.datumStavu
      ? b.zapsanoAt.localeCompare(a.zapsanoAt)
      : b.datumStavu.localeCompare(a.datumStavu),
  );

  const activeHistoryDetailId =
    historyDetailEventId && selectedPersonalHistory.some((event) => event.id === historyDetailEventId)
      ? historyDetailEventId
      : null;

  const suggestions = useMemo(() => {
    const needle = searchInput.trim().toLowerCase();
    if (!needle) return [] as SearchSuggestion[];

    const output: SearchSuggestion[] = [];

    if (viewMode === "po_lidech") {
      const smecky = [...new Set(filteredStudents.map((student) => student.smecka))];
      smecky.forEach((smecka) => {
        if (smecka.toLowerCase().includes(needle)) {
          output.push({ id: `smecka-${smecka}`, label: `Smečka: ${smecka}`, type: "smecka", value: smecka });
        }
      });

      filteredStudents.forEach((student) => {
        if (`${student.prezdivka} ${student.jmeno}`.toLowerCase().includes(needle)) {
          output.push({
            id: `student-${student.id}`,
            label: `Žák: ${student.prezdivka}`,
            type: "student",
            value: student.prezdivka,
          });
        }
      });
    } else {
      filteredLodicky.forEach((lodicka) => {
        if (lodicka.nazev.toLowerCase().includes(needle)) {
          output.push({ id: `lodicka-${lodicka.id}`, label: `Lodička: ${lodicka.nazev}`, type: "lodicka", value: lodicka.nazev });
        }
        if (lodicka.oblast.toLowerCase().includes(needle)) {
          output.push({ id: `oblast-${lodicka.id}`, label: `Oblast: ${lodicka.oblast}`, type: "oblast", value: lodicka.oblast });
        }
        if (lodicka.predmet.toLowerCase().includes(needle)) {
          output.push({ id: `predmet-${lodicka.id}`, label: `Předmět: ${lodicka.predmet}`, type: "predmet", value: lodicka.predmet });
        }
      });
    }

    return output.slice(0, 8);
  }, [filteredLodicky, filteredStudents, searchInput, viewMode]);

  const options = useMemo(() => {
    return {
      stupne: ["1", "2"],
      rocniky: [...new Set(PROTO_STUDENTS.map((student) => String(student.rocnik)))].sort((a, b) => Number(a) - Number(b)),
      smecky: [...new Set(PROTO_STUDENTS.map((student) => student.smecka))].sort(),
      predmety: [...new Set(PROTO_LODICKY_CATALOG.map((lodicka) => lodicka.predmet))].sort(),
      podpredmety: [...new Set(PROTO_LODICKY_CATALOG.map((lodicka) => lodicka.podpředmět ?? "-"))].sort(),
      oblasti: [...new Set(PROTO_LODICKY_CATALOG.map((lodicka) => lodicka.oblast))].sort(),
      garanti: [...new Set(PROTO_LODICKY_CATALOG.map((lodicka) => getActorLabel(lodicka.garantId)))].sort(),
    };
  }, []);

  function pushDebug(event: Omit<ProtoDebugEvent, "id" | "at">) {
    setDebugEvents((prev) => [createProtoDebugEvent(event), ...prev].slice(0, 80));
  }

  function handleRoleChange(value: string) {
    const nextRole = normalizeRole(value);
    const nextUsers = getActorsByRole(nextRole);
    setActiveRole(nextRole);
    setSelectedUserId(nextUsers[0]?.id ?? "");
    if (nextRole === "rodic" || nextRole === "zak") {
      setScopeMode("moje");
    }
    pushDebug({
      elementId: "SEL-R001",
      label: "Přepínač role",
      action: "change-role",
      hierarchy: "EDGE_PANEL > SELECT_ROLE",
      payload: `role=${nextRole}`,
    });
  }

  function handleUserChange(value: string) {
    setSelectedUserId(value);
    pushDebug({
      elementId: "SEL-U001",
      label: "Přepínač uživatele",
      action: "change-user",
      hierarchy: "EDGE_PANEL > SELECT_USER",
      payload: `user=${value}`,
    });
  }

  function applySuggestion(suggestion: SearchSuggestion, index: number) {
    if (suggestion.type === "smecka") {
      setPeopleSmeckaFilter((prev) => (prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]));
      setSearchInput("");
    } else if (suggestion.type === "oblast") {
      setLodickyOblastFilter((prev) => (prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]));
      setSearchInput("");
    } else if (suggestion.type === "predmet") {
      setLodickyPredmetFilter((prev) => (prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]));
      setSearchInput("");
    } else {
      setSearchInput(suggestion.value);
    }

    pushDebug({
      elementId: `SRCH-SUG-${index + 1}`,
      label: suggestion.label,
      action: "apply-search-suggestion",
      hierarchy: "PERSONAL_LODICKY > SEARCH",
      payload: `${suggestion.type}:${suggestion.value}`,
    });
  }

  function clearAllFilters() {
    setPeopleStupenFilter([]);
    setPeopleRocnikFilter([]);
    setPeopleSmeckaFilter([]);
    setLodickyPredmetFilter([]);
    setLodickyPodpredmetFilter([]);
    setLodickyOblastFilter([]);
    setLodickyGarantFilter([]);
    setSearchInput("");

    pushDebug({
      elementId: "BTN-CLEAR-FILTERS",
      label: "Vymazat všechny filtry",
      action: "clear-filters",
      hierarchy: "PERSONAL_LODICKY > FILTER_PANEL",
    });
  }

  function updateStatus(personalId: string, nextStatus: LodickaStav) {
    if (isReadonly || !activeUser) return;

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const event: ProtoOsobniLodickaEvent = {
      id: `evt-manual-${personalId}-${now.getTime()}`,
      osobniLodickaId: personalId,
      datumStavu: effectiveViewDate,
      zapsanoAt: `${effectiveViewDate} ${time}`,
      stav: nextStatus,
      zapsalId: activeUser.id,
      poznamka: "Prototyp: ruční změna stavu.",
    };

    setEvents((prev) => [...prev, event]);
    setSelectedPersonalId(personalId);

    pushDebug({
      elementId: `BTN-S${nextStatus}-${personalId}`,
      label: "Změna stavu osobní lodičky",
      action: "set-status",
      tableId: viewMode === "po_lodickach" ? RIGHT_TABLE_LODICKY : RIGHT_TABLE_LIDE,
      rowId: personalId,
      hierarchy: "PERSONAL_LODICKY > RIGHT_PANE > STATUS_BUTTONS",
      payload: `stav=${nextStatus}; datum=${effectiveViewDate}`,
    });
  }

  const leftTableId = viewMode === "po_lodickach" ? "T221" : "T222";
  const rightTableId = viewMode === "po_lodickach" ? RIGHT_TABLE_LODICKY : RIGHT_TABLE_LIDE;
  const showGarantColumn = viewMode === "po_lodickach" && showGarantContext;
  const leftTableColumnCount = viewMode === "po_lodickach" ? (showGarantColumn ? 3 : 2) : 2;
  const rightTableColumnCount = 3;

  return (
    <main className="min-h-screen bg-slate-50 pb-44">
      <ProtoEdgePanel
        roleOptions={PROTO_ROLE_OPTIONS}
        activeRole={activeRole}
        activeUserId={activeUserId}
        usersForRole={usersForRole}
        onRoleChange={handleRoleChange}
        onUserChange={handleUserChange}
        navItems={PROTO_QUICK_NAV}
        query={{ role: activeRole, user: activeUserId }}
      />

      <section className={`${UI_CLASSES.pageContainer} space-y-4 py-6`}>
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">Osobní lodičky</p>
          <h1 className="text-xl font-semibold text-[#05204A]">Kompaktní pracovní pohled (Garant)</h1>
        </header>

        <Card className="border-[#D9E4F2]">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-[#05204A]">Řízení pohledu</CardTitle>
                <CardDescription>Výchozí rozložení je cílené na viewport 1440 × 900 (MacBook Air M1).</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-[#D9E4F2] text-[#05204A]"
                onClick={() => {
                  const next = !filtersOpen;
                  setFiltersOpen(next);
                  pushDebug({
                    elementId: "BTN-FILTER-COLLAPSE",
                    label: "Sbalení/rozbalení filtrů",
                    action: next ? "expand-filters" : "collapse-filters",
                    hierarchy: "PERSONAL_LODICKY > FILTER_PANEL",
                  });
                }}
              >
                {filtersOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                {filtersOpen ? "Sbalit filtry" : "Rozbalit filtry"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <SegmentControl
                label="Základní volba"
                options={[
                  { id: "moje", label: "Moje lodičky" },
                  { id: "vsechny", label: "Všechny lodičky" },
                ]}
                value={effectiveScope}
                onChange={(value) => {
                  if (activeRole === "rodic" || activeRole === "zak") return;
                  setScopeMode(value as ScopeMode);
                  pushDebug({
                    elementId: "SEG-SCOPE",
                    label: "Přepnutí rozsahu",
                    action: "change-scope",
                    hierarchy: "PERSONAL_LODICKY > TOP_BAR",
                    payload: `scope=${value}`,
                  });
                }}
                disabled={activeRole === "rodic" || activeRole === "zak"}
              />

              <SegmentControl
                label="Pohled"
                options={[
                  { id: "po_lodickach", label: "Po lodičkách" },
                  { id: "po_lidech", label: "Po lidech" },
                ]}
                value={viewMode}
                onChange={(value) => {
                  setViewMode(value as ViewMode);
                  setSelectedLeftId(null);
                  setSelectedPersonalId(null);
                  setLeftSort("nazev");
                  setRightSort("jmeno");
                  pushDebug({
                    elementId: "SEG-VIEW",
                    label: "Přepnutí režimu zobrazení",
                    action: "change-view",
                    hierarchy: "PERSONAL_LODICKY > TOP_BAR",
                    payload: `view=${value}`,
                  });
                }}
              />

              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Datum pohledu
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] px-3 py-2">
                  <CalendarDays className="size-4 text-[#0A4DA6]" />
                  <input
                    type="date"
                    min={semesterBounds.minDate}
                    max={semesterBounds.maxDate}
                    value={effectiveViewDate}
                    onChange={(e) => {
                      const clamped = clampDate(e.target.value, semesterBounds.minDate, semesterBounds.maxDate);
                      setViewDate(clamped);
                      pushDebug({
                        elementId: "DATE-VIEW",
                        label: "Datum pohledu",
                        action: "change-date",
                        hierarchy: "PERSONAL_LODICKY > TOP_BAR",
                        payload: `date=${clamped}`,
                      });
                    }}
                    className="w-full bg-transparent text-sm text-slate-700 outline-none"
                  />
                </div>
                <span className="mt-1 block text-[11px] text-slate-500">
                  Aktivní pololetí: {formatCzDate(semesterBounds.minDate)} až {formatCzDate(semesterBounds.maxDate)}
                </span>
              </label>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 rounded-2xl border border-[#D9E4F2] bg-white px-3 py-2">
                <Search className="size-4 text-[#0A4DA6]" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && suggestions.length > 0) {
                      e.preventDefault();
                      applySuggestion(suggestions[0], 0);
                    }
                  }}
                  placeholder={
                    viewMode === "po_lidech"
                      ? "Vyhledat žáka nebo smečku (např. Indi)"
                      : "Vyhledat lodičku, oblast nebo předmět"
                  }
                  className="w-full text-sm text-slate-700 outline-none"
                />
                <Badge className="bg-[#F2F7FF] text-[#0A4DA6] hover:bg-[#F2F7FF]">
                  <Filter className="mr-1 size-3.5" />
                  fulltext
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="border-[#D9E4F2] text-[#05204A]"
                  onClick={clearAllFilters}
                >
                  Vymazat filtry
                </Button>
              </div>

              {suggestions.length > 0 && (
                <div className="absolute top-[calc(100%+6px)] z-20 w-full rounded-xl border border-[#D9E4F2] bg-white p-1 shadow-xl">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => applySuggestion(suggestion, index)}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#F4F8FF]"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filtersOpen && (
              <div className="grid gap-3 xl:grid-cols-2">
                <Card className="border-[#E3ECF9]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#05204A]">Filtry po lidech</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    <MultiToggleSelect
                      label="Stupeň"
                      options={options.stupne}
                      value={peopleStupenFilter}
                      onChange={setPeopleStupenFilter}
                    />
                    <MultiToggleSelect
                      label="Ročník"
                      options={options.rocniky}
                      value={peopleRocnikFilter}
                      onChange={setPeopleRocnikFilter}
                    />
                    <MultiToggleSelect
                      label="Smečka"
                      options={options.smecky}
                      value={peopleSmeckaFilter}
                      onChange={setPeopleSmeckaFilter}
                    />
                  </CardContent>
                </Card>

                <Card className="border-[#E3ECF9]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#05204A]">Filtry po lodičkách</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MultiToggleSelect
                      label="Předmět"
                      options={options.predmety}
                      value={lodickyPredmetFilter}
                      onChange={setLodickyPredmetFilter}
                    />
                    <MultiToggleSelect
                      label="Podpředmět"
                      options={options.podpredmety}
                      value={lodickyPodpredmetFilter}
                      onChange={setLodickyPodpredmetFilter}
                    />
                    <MultiToggleSelect
                      label="Oblast"
                      options={options.oblasti}
                      value={lodickyOblastFilter}
                      onChange={setLodickyOblastFilter}
                    />
                    {showGarantContext && (
                      <MultiToggleSelect
                        label="Garant"
                        options={options.garanti}
                        value={lodickyGarantFilter}
                        onChange={setLodickyGarantFilter}
                      />
                    )}
                    <div className="md:col-span-2 xl:col-span-4">
                      <SegmentControl
                        label="Seskupovat lodičky"
                        options={[
                          { id: "ano", label: "Ano" },
                          { id: "ne", label: "Ne" },
                        ]}
                        value={lodickyGroupMode}
                        onChange={(value) => setLodickyGroupMode(value as LodickyGroupMode)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        <section
          className={`grid gap-3 xl:min-h-[380px] xl:grid-cols-[minmax(0,0.33fr)_minmax(0,0.41fr)_minmax(0,0.26fr)] ${
            filtersOpen ? "xl:h-[calc(100dvh-500px)]" : "xl:h-[calc(100dvh-360px)]"
          }`}
        >
          <Card className="border-[#D9E4F2] xl:h-full xl:min-h-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-[#05204A]">
                    {viewMode === "po_lodickach" ? "Lodičky" : "Lidé"}
                  </CardTitle>
                  <CardDescription>
                    {viewMode === "po_lodickach"
                      ? "Výběr lodičky určuje obsah pravého panelu."
                      : "Výběr žáka určuje obsah pravého panelu."}
                  </CardDescription>
                </div>
                <div className="space-y-1 text-right">
                  <SortSelect
                    value={effectiveLeftSort}
                    onChange={(value) => setLeftSort(value as PaneSort)}
                    options={
                      viewMode === "po_lodickach"
                        ? showGarantContext
                          ? [
                              { id: "nazev", label: "Název" },
                              { id: "garant", label: "Garant" },
                            ]
                          : [{ id: "nazev", label: "Název" }]
                        : [
                            { id: "jmeno", label: "Přezdívka" },
                            { id: "rocnik", label: "Ročník" },
                          ]
                    }
                  />
                  {viewMode === "po_lidech" && (
                    <SortSelect
                      label="Seskupit podle"
                      value={lideGroupBy}
                      onChange={(value) => setLideGroupBy(value as LideGroupBy)}
                      options={[
                        { id: "rocniky", label: "Ročníky" },
                        { id: "smecky", label: "Smečky" },
                      ]}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-auto xl:min-h-0 xl:flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    {viewMode === "po_lodickach" ? (
                      <>
                        <TableHead>Lodička</TableHead>
                        {showGarantColumn && <TableHead>Garant</TableHead>}
                        <TableHead>Počet</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Žák</TableHead>
                        <TableHead>Počet</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leftItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={leftTableColumnCount} className="py-8 text-center text-slate-500">
                        Žádná data pro zvolený filtr.
                      </TableCell>
                    </TableRow>
                  )}

                  {renderLeftPaneRows({
                    viewMode,
                    leftItems,
                    selectedLeftId: selectedLeftIdEffective,
                    showGarantColumn,
                    showLodickyGrouping: lodickyGroupMode === "ano",
                    lideGroupBy,
                    onSelect: (id, label, rowId, tableId, hierarchy) => {
                      setSelectedLeftId(id);
                      setSelectedPersonalId(null);
                      pushDebug({
                        elementId: `ROW-${tableId}-${rowId}`,
                        label,
                        action: "select-left-row",
                        tableId,
                        rowId,
                        hierarchy,
                      });
                    },
                    tableId: leftTableId,
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-[#D9E4F2] xl:h-full xl:min-h-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-[#05204A]">
                    {viewMode === "po_lodickach" ? "Lidé pro vybranou lodičku" : "Lodičky vybraného žáka"}
                  </CardTitle>
                  <CardDescription>
                    Stav lze měnit přímo tlačítky v řádku (pokud role není read-only).
                  </CardDescription>
                </div>
                <SortSelect
                  value={rightSort}
                  onChange={(value) => setRightSort(value as PaneSort)}
                  options={
                    viewMode === "po_lodickach"
                      ? [
                          { id: "jmeno", label: "Přezdívka" },
                          { id: "stav", label: "Stav" },
                        ]
                      : [
                          { id: "nazev", label: "Lodička" },
                          { id: "stav", label: "Stav" },
                        ]
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="overflow-auto xl:min-h-0 xl:flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{viewMode === "po_lodickach" ? "Žák" : "Lodička"}</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead className="text-right">Změna</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rightRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={rightTableColumnCount} className="py-8 text-center text-slate-500">
                        Pravý panel je prázdný. Vyber vlevo řádek nebo uprav filtr.
                      </TableCell>
                    </TableRow>
                  )}

                  {renderRightPaneRows({
                    rows: rightRows,
                    selectedPersonalId: selectedPersonalEffective,
                    viewMode,
                    tableId: rightTableId,
                    readonly: isReadonly,
                    lideGroupBy,
                    showLodickyGrouping: lodickyGroupMode === "ano",
                    onSelectRow: (personalId, label, rowId, hierarchy) => {
                      setSelectedPersonalId(personalId);
                      pushDebug({
                        elementId: `ROW-${rightTableId}-${rowId}`,
                        label,
                        action: "select-right-row",
                        tableId: rightTableId,
                        rowId,
                        hierarchy,
                      });
                    },
                    onSetStatus: updateStatus,
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-[#D9E4F2] xl:h-full xl:min-h-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-[#05204A]">Pomocné okno: historie</CardTitle>
              <CardDescription>Kompaktní přehled: datum, stav a detail po kliknutí na ikonu.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 overflow-auto xl:min-h-0 xl:flex-1">
              {!selectedPersonalRow && <p className="text-sm text-slate-500">Není vybraná osobní lodička.</p>}

              {selectedPersonalRow && (
                <div className="rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] px-3 py-2">
                  <p className="text-sm font-semibold text-[#05204A]">{selectedPersonalRow.student.prezdivka}</p>
                  <p className="text-xs text-slate-600">{selectedPersonalRow.lodicka.nazev}</p>
                  <Badge className={`mt-1 ${stavBadgeClass(selectedPersonalRow.stav)}`}>
                    {LODICKA_STAV_LABEL[selectedPersonalRow.stav]}
                  </Badge>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum stavu</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead className="text-right">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPersonalHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-slate-500">
                        Pro vybranou položku zatím nejsou eventy.
                      </TableCell>
                    </TableRow>
                  )}
                  {selectedPersonalHistory.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{formatCzDate(event.datumStavu)}</TableCell>
                      <TableCell>
                        <Badge className={stavBadgeClass(event.stav)}>
                          {LODICKA_STAV_LABEL[event.stav]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="relative inline-block">
                          <button
                            type="button"
                            className="inline-flex size-6 items-center justify-center rounded-full border border-[#D9E4F2] bg-white text-[#0A4DA6] hover:bg-[#F2F7FF]"
                            onClick={() =>
                              setHistoryDetailEventId((prev) => (prev === event.id ? null : event.id))
                            }
                          >
                            <Info className="size-3.5" />
                          </button>
                          {activeHistoryDetailId === event.id && (
                            <div className="absolute right-0 top-7 z-20 w-56 rounded-lg border border-[#D9E4F2] bg-white p-2 text-left text-[11px] text-slate-600 shadow-lg">
                              <p>
                                <span className="font-semibold">Zapsáno:</span> {formatCzDateTime(event.zapsanoAt)}
                              </p>
                              <p>
                                <span className="font-semibold">Zapsal:</span> {getActorLabel(event.zapsalId)}
                              </p>
                              <p>
                                <span className="font-semibold">Poznámka:</span> {event.poznamka ?? "-"}
                              </p>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </section>

      <ProtoDebugPanel events={debugEvents} onClear={() => setDebugEvents([])} />
    </main>
  );
}

export default function OsobniLodickyPrototypePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50">
          <section className={`${UI_CLASSES.pageContainer} py-6`}>
            <p className="text-sm text-slate-600">Načítám osobní lodičky…</p>
          </section>
        </main>
      }
    >
      <OsobniLodickyPrototypePageInner />
    </Suspense>
  );
}

function normalizeRole(input: string | null): ProtoRoleId {
  if (input === "garant" || input === "rodic" || input === "zak" || input === "spravce") {
    return input;
  }
  return DEFAULT_ROLE;
}

function MultiToggleSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const selectedSet = new Set(value);

  return (
    <div>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      {value.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {value.map((item) => (
            <button
              key={`selected-${label}-${item}`}
              type="button"
              onClick={() => onChange(value.filter((entry) => entry !== item))}
              className="inline-flex items-center gap-1 rounded-full border border-[#0A4DA6] bg-[#EAF2FF] px-2 py-0.5 text-[11px] font-medium text-[#0A4DA6]"
              title={`Odebrat filtr ${item}`}
            >
              {item}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
      <div className="max-h-[130px] overflow-auto rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] p-1.5">
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => {
            const isSelected = selectedSet.has(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    onChange(value.filter((item) => item !== option));
                    return;
                  }
                  onChange([...value, option]);
                }}
                className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                  isSelected
                    ? "border-[#0A4DA6] bg-[#0A4DA6] text-white"
                    : "border-[#CFE0F7] bg-white text-slate-700 hover:bg-[#F2F7FF]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SegmentControl({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <div className="inline-flex rounded-xl border border-[#D9E4F2] bg-white p-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              value === option.id ? "bg-[#002060] text-white" : "text-slate-600 hover:bg-[#F3F7FF]"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SortSelect({
  label = "Řazení",
  value,
  onChange,
  options,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[#D9E4F2] bg-white px-2 py-1 text-xs text-slate-700"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function stavBadgeClass(stav: LodickaStav): string {
  if (stav === 4) return "bg-emerald-100 text-emerald-800";
  if (stav === 3) return "bg-orange-100 text-orange-800";
  if (stav === 2) return "bg-blue-100 text-blue-800";
  if (stav === 1) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function sortLeftPaneLodicky(
  rows: { lodicka: ProtoLodickaCatalogItem; count: number }[],
  mode: PaneSort,
) {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (mode === "garant") {
      return getActorLabel(a.lodicka.garantId).localeCompare(getActorLabel(b.lodicka.garantId), "cs");
    }
    return a.lodicka.nazev.localeCompare(b.lodicka.nazev, "cs");
  });
  return sorted;
}

function sortLeftPaneStudents(
  rows: { student: ProtoStudent; count: number }[],
  mode: PaneSort,
) {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (mode === "rocnik") {
      return (
        a.student.rocnik - b.student.rocnik ||
        a.student.prezdivka.localeCompare(b.student.prezdivka, "cs")
      );
    }
    return a.student.prezdivka.localeCompare(b.student.prezdivka, "cs");
  });
  return sorted;
}

function sortRightPane(rows: PersonalWithSnapshot[], mode: PaneSort, viewMode: ViewMode) {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (mode === "stav") return b.stav - a.stav;

    if (viewMode === "po_lodickach") {
      return a.student.prezdivka.localeCompare(b.student.prezdivka, "cs");
    }

    return a.lodicka.nazev.localeCompare(b.lodicka.nazev, "cs");
  });

  return sorted;
}

function renderLeftPaneRows({
  viewMode,
  leftItems,
  selectedLeftId,
  showGarantColumn,
  showLodickyGrouping,
  lideGroupBy,
  onSelect,
  tableId,
}: {
  viewMode: ViewMode;
  leftItems:
    | { lodicka: ProtoLodickaCatalogItem; count: number }[]
    | { student: ProtoStudent; count: number }[];
  selectedLeftId: string | null;
  showGarantColumn: boolean;
  showLodickyGrouping: boolean;
  lideGroupBy: LideGroupBy;
  onSelect: (id: string, label: string, rowId: string, tableId: string, hierarchy: string) => void;
  tableId: string;
}) {
  if (viewMode === "po_lodickach") {
    const lodickyRows = leftItems as { lodicka: ProtoLodickaCatalogItem; count: number }[];
    const colSpan = showGarantColumn ? 3 : 2;
    let rowCounter = 0;

    if (!showLodickyGrouping) {
      return lodickyRows.map((item) => {
        rowCounter += 1;
        const isSelected = selectedLeftId === item.lodicka.id;
        return (
          <TableRow
            key={item.lodicka.id}
            data-state={isSelected ? "selected" : undefined}
            className="cursor-pointer"
            onClick={() =>
              onSelect(
                item.lodicka.id,
                item.lodicka.nazev,
                String(rowCounter),
                tableId,
                `${tableId} > LODICKA:${item.lodicka.id}`,
              )
            }
          >
            <TableCell className="font-medium text-[#05204A]">{item.lodicka.nazev}</TableCell>
            {showGarantColumn && <TableCell>{getActorLabel(item.lodicka.garantId)}</TableCell>}
            <TableCell>{item.count}</TableCell>
          </TableRow>
        );
      });
    }

    const predmetGroups = groupBy(lodickyRows, (item) => item.lodicka.predmet).sort((a, b) =>
      a[0].localeCompare(b[0], "cs"),
    );
    const rows: ReactNode[] = [];

    predmetGroups.forEach(([predmet, predmetItems]) => {
      rows.push(
        <TableRow key={`predmet-${predmet}`} className="bg-[#F7FAFF]">
          <TableCell colSpan={colSpan} className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0A4DA6]">
            {predmet} ({predmetItems.length})
          </TableCell>
        </TableRow>,
      );

      const podpredmetGroups = groupBy(predmetItems, (item) => item.lodicka.podpředmět ?? "Bez podpředmětu").sort(
        (a, b) => a[0].localeCompare(b[0], "cs"),
      );

      podpredmetGroups.forEach(([podpredmet, podpredmetItems]) => {
        rows.push(
          <TableRow key={`podpredmet-${predmet}-${podpredmet}`} className="bg-[#F9FCFF]">
            <TableCell colSpan={colSpan} className="pl-4 text-xs font-medium text-[#0A4DA6]">
              {podpredmet} ({podpredmetItems.length})
            </TableCell>
          </TableRow>,
        );

        const oblastGroups = groupBy(podpredmetItems, (item) => item.lodicka.oblast).sort((a, b) =>
          a[0].localeCompare(b[0], "cs"),
        );

        oblastGroups.forEach(([oblast, oblastItems]) => {
          rows.push(
            <TableRow key={`oblast-${predmet}-${podpredmet}-${oblast}`} className="bg-[#FCFEFF]">
              <TableCell colSpan={colSpan} className="pl-7 text-xs text-[#0A4DA6]">
                {oblast} ({oblastItems.length})
              </TableCell>
            </TableRow>,
          );

          oblastItems.forEach((item) => {
            rowCounter += 1;
            const isSelected = selectedLeftId === item.lodicka.id;
            rows.push(
              <TableRow
                key={item.lodicka.id}
                data-state={isSelected ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() =>
                  onSelect(
                    item.lodicka.id,
                    item.lodicka.nazev,
                    String(rowCounter),
                    tableId,
                    `${tableId} > PREDMET:${predmet} > PODPREDMET:${podpredmet} > OBLAST:${oblast} > LODICKA:${item.lodicka.id}`,
                  )
                }
              >
                <TableCell className="pl-9 font-medium text-[#05204A]">{item.lodicka.nazev}</TableCell>
                {showGarantColumn && <TableCell>{getActorLabel(item.lodicka.garantId)}</TableCell>}
                <TableCell>{item.count}</TableCell>
              </TableRow>,
            );
          });
        });
      });
    });

    return rows;
  }

  const studentRows = leftItems as { student: ProtoStudent; count: number }[];
  const grouped = groupBy(studentRows, (item) => getPeopleGroupLabel(item.student, lideGroupBy)).sort((a, b) =>
    sortPeopleGroupLabel(a[0], b[0], lideGroupBy),
  );

  let rowCounter = 0;

  return grouped.flatMap(([groupName, items]) => {
    const rows = [
      <TableRow key={`${groupName}-group`} className="bg-[#F7FAFF]">
        <TableCell colSpan={2} className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0A4DA6]">
          {groupName} ({items.length})
        </TableCell>
      </TableRow>,
    ];

    items.forEach((item) => {
      rowCounter += 1;
      const isSelected = selectedLeftId === item.student.id;
      rows.push(
        <TableRow
          key={item.student.id}
          data-state={isSelected ? "selected" : undefined}
          className="cursor-pointer"
          onClick={() =>
            onSelect(
              item.student.id,
              item.student.prezdivka,
              String(rowCounter),
              tableId,
              `${tableId} > GROUP:${groupName} > STUDENT:${item.student.id}`,
            )
          }
        >
          <TableCell className="font-medium text-[#05204A]">{item.student.prezdivka}</TableCell>
          <TableCell>{item.count}</TableCell>
        </TableRow>,
      );
    });

    return rows;
  });
}

function renderRightPaneRows({
  rows,
  selectedPersonalId,
  viewMode,
  tableId,
  readonly,
  lideGroupBy,
  showLodickyGrouping,
  onSelectRow,
  onSetStatus,
}: {
  rows: PersonalWithSnapshot[];
  selectedPersonalId: string | null;
  viewMode: ViewMode;
  tableId: string;
  readonly: boolean;
  lideGroupBy: LideGroupBy;
  showLodickyGrouping: boolean;
  onSelectRow: (personalId: string, label: string, rowId: string, hierarchy: string) => void;
  onSetStatus: (personalId: string, status: LodickaStav) => void;
}) {
  let rowCounter = 0;

  if (viewMode === "po_lidech") {
    if (!showLodickyGrouping) {
      return rows.map((row) => {
        rowCounter += 1;
        const isSelected = selectedPersonalId === row.personal.id;
        return (
          <TableRow
            key={row.personal.id}
            data-state={isSelected ? "selected" : undefined}
            className="cursor-pointer"
            onClick={() =>
              onSelectRow(
                row.personal.id,
                row.lodicka.nazev,
                String(rowCounter),
                `${tableId} > LODICKA:${row.lodicka.id} > PERSONAL:${row.personal.id}`,
              )
            }
          >
            <TableCell className="font-medium text-[#05204A]">{row.lodicka.nazev}</TableCell>
            <TableCell>
              <Badge className={stavBadgeClass(row.stav)}>{LODICKA_STAV_LABEL[row.stav]}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <StatusButtons row={row} readonly={readonly} onSetStatus={onSetStatus} />
            </TableCell>
          </TableRow>
        );
      });
    }

    const predmetGroups = groupBy(rows, (row) => row.lodicka.predmet).sort((a, b) =>
      a[0].localeCompare(b[0], "cs"),
    );
    const nestedRows: ReactNode[] = [];

    predmetGroups.forEach(([predmet, predmetItems]) => {
      nestedRows.push(
        <TableRow key={`r-predmet-${predmet}`} className="bg-[#F7FAFF]">
          <TableCell colSpan={3} className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0A4DA6]">
            {predmet} ({predmetItems.length})
          </TableCell>
        </TableRow>,
      );

      const podpredmetGroups = groupBy(predmetItems, (row) => row.lodicka.podpředmět ?? "Bez podpředmětu").sort(
        (a, b) => a[0].localeCompare(b[0], "cs"),
      );

      podpredmetGroups.forEach(([podpredmet, podpredmetItems]) => {
        nestedRows.push(
          <TableRow key={`r-podpredmet-${predmet}-${podpredmet}`} className="bg-[#F9FCFF]">
            <TableCell colSpan={3} className="pl-4 text-xs font-medium text-[#0A4DA6]">
              {podpredmet} ({podpredmetItems.length})
            </TableCell>
          </TableRow>,
        );

        const oblastGroups = groupBy(podpredmetItems, (row) => row.lodicka.oblast).sort((a, b) =>
          a[0].localeCompare(b[0], "cs"),
        );
        oblastGroups.forEach(([oblast, oblastItems]) => {
          nestedRows.push(
            <TableRow key={`r-oblast-${predmet}-${podpredmet}-${oblast}`} className="bg-[#FCFEFF]">
              <TableCell colSpan={3} className="pl-7 text-xs text-[#0A4DA6]">
                {oblast} ({oblastItems.length})
              </TableCell>
            </TableRow>,
          );

          oblastItems.forEach((row) => {
            rowCounter += 1;
            const isSelected = selectedPersonalId === row.personal.id;
            nestedRows.push(
              <TableRow
                key={row.personal.id}
                data-state={isSelected ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() =>
                  onSelectRow(
                    row.personal.id,
                    row.lodicka.nazev,
                    String(rowCounter),
                    `${tableId} > PREDMET:${predmet} > PODPREDMET:${podpredmet} > OBLAST:${oblast} > PERSONAL:${row.personal.id}`,
                  )
                }
              >
                <TableCell className="pl-9 font-medium text-[#05204A]">{row.lodicka.nazev}</TableCell>
                <TableCell>
                  <Badge className={stavBadgeClass(row.stav)}>{LODICKA_STAV_LABEL[row.stav]}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <StatusButtons row={row} readonly={readonly} onSetStatus={onSetStatus} />
                </TableCell>
              </TableRow>,
            );
          });
        });
      });
    });

    return nestedRows;
  }

  const groupedPeople = groupBy(rows, (row) => getPeopleGroupLabel(row.student, lideGroupBy)).sort((a, b) =>
    sortPeopleGroupLabel(a[0], b[0], lideGroupBy),
  );

  return groupedPeople.flatMap(([groupName, items]) => {
    const result = [
      <TableRow key={`${groupName}-group`} className="bg-[#F7FAFF]">
        <TableCell colSpan={3} className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0A4DA6]">
          {groupName} ({items.length})
        </TableCell>
      </TableRow>,
    ];

    items.forEach((row) => {
      rowCounter += 1;
      const isSelected = selectedPersonalId === row.personal.id;
      const rowLabel = viewMode === "po_lodickach" ? row.student.prezdivka : row.lodicka.nazev;

      result.push(
        <TableRow
          key={row.personal.id}
          data-state={isSelected ? "selected" : undefined}
          className="cursor-pointer"
          onClick={() =>
            onSelectRow(
              row.personal.id,
              rowLabel,
              String(rowCounter),
              `${tableId} > GROUP:${groupName} > PERSONAL:${row.personal.id}`,
            )
          }
        >
          <TableCell className="font-medium text-[#05204A]">
            {viewMode === "po_lodickach" ? row.student.prezdivka : row.lodicka.nazev}
          </TableCell>
          <TableCell>
            <Badge className={stavBadgeClass(row.stav)}>{LODICKA_STAV_LABEL[row.stav]}</Badge>
          </TableCell>
          <TableCell className="text-right">
            <StatusButtons row={row} readonly={readonly} onSetStatus={onSetStatus} />
          </TableCell>
        </TableRow>,
      );
    });

    return result;
  });
}

function StatusButtons({
  row,
  readonly,
  onSetStatus,
}: {
  row: PersonalWithSnapshot;
  readonly: boolean;
  onSetStatus: (personalId: string, status: LodickaStav) => void;
}) {
  return (
    <div className="inline-flex gap-1">
      {[0, 1, 2, 3, 4].map((statusValue) => (
        <Button
          key={statusValue}
          type="button"
          size="xs"
          variant={row.stav === statusValue ? "default" : "outline"}
          disabled={readonly}
          onClick={(event) => {
            event.stopPropagation();
            onSetStatus(row.personal.id, statusValue as LodickaStav);
          }}
          className={row.stav === statusValue ? "bg-[#002060] text-white" : ""}
        >
          {statusValue}
        </Button>
      ))}
    </div>
  );
}

function groupBy<T>(items: T[], getKey: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  items.forEach((item) => {
    const key = getKey(item);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  });
  return [...map.entries()];
}

function getPeopleGroupLabel(student: ProtoStudent, mode: LideGroupBy): string {
  if (mode === "rocniky") return `Ročník ${student.rocnik}`;
  return student.smecka;
}

function sortPeopleGroupLabel(a: string, b: string, mode: LideGroupBy): number {
  if (mode === "rocniky") {
    const numberA = Number(a.replace(/\D/g, ""));
    const numberB = Number(b.replace(/\D/g, ""));
    return numberA - numberB;
  }
  return a.localeCompare(b, "cs");
}

function formatCzDate(value: string): string {
  const onlyDate = value.slice(0, 10);
  const [year, month, day] = onlyDate.split("-");
  if (!year || !month || !day) return value;
  return `${Number(day)}.${Number(month)}.${year}`;
}

function formatCzDateTime(value: string): string {
  const datePart = value.slice(0, 10);
  const timePart = value.length > 10 ? value.slice(11, 16) : "";
  const formattedDate = formatCzDate(datePart);
  return timePart ? `${formattedDate} ${timePart}` : formattedDate;
}

function clampDate(value: string, min: string, max: string): string {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
