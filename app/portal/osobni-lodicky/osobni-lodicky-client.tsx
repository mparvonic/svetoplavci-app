"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { CalendarDays, ChevronDown, ChevronUp, Filter, Info, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProtoDebugPanel, createProtoDebugEvent, type ProtoDebugEvent } from "@/components/proto/proto-debug-panel";
import { ProtoEdgePanel } from "@/components/proto/proto-edge-panel";
import {
  LODICKA_STAV_LABEL,
  PROTO_ACTORS,
  PROTO_PARENT_CHILD_LINKS,
  PROTO_LODICKY_CATALOG,
  PROTO_OSOBNI_LODICKA_EVENTS,
  PROTO_OSOBNI_LODICKY,
  PROTO_QUICK_NAV,
  PROTO_ROLE_OPTIONS,
  PROTO_STUDENTS,
  getActiveSemesterBounds,
  getActorsByRole,
  getParentChildren,
  getTodayIsoForProto,
  type LodickaStav,
  type ProtoActor,
  type ProtoLodickaCatalogItem,
  type ProtoOsobniLodicka,
  type ProtoOsobniLodickaEvent,
  type ProtoParentChildLink,
  type ProtoRoleId,
  type ProtoStudent,
} from "@/src/lib/mock/proto-lodicky-playground";
import { UI_CLASSES } from "@/src/lib/design-pack/ui";

type ScopeMode = "moje" | "vsechny";
type ViewMode = "po_lodickach" | "po_lidech";
type PaneSort = "nazev" | "garant" | "jmeno" | "rocnik" | "stav";
type PeopleGroupKey = "smecka" | "rocnik" | "none";
type LodickaGroupKey = "predmet" | "podpredmet" | "oblast" | "garant";

type SearchSuggestion = {
  id: string;
  label: string;
  type:
    | "smecka"
    | "student"
    | "lodicka"
    | "oblast"
    | "predmet"
    | "podpredmet"
    | "garant"
    | "rocnik"
    | "stupen";
  value: string;
  token?: string;
};

type PersonalWithSnapshot = {
  personal: ProtoOsobniLodicka;
  student: ProtoStudent;
  lodicka: ProtoLodickaCatalogItem;
  stav: LodickaStav;
  lastEvent: ProtoOsobniLodickaEvent | null;
};

type DetailSheetState =
  | { type: "none" }
  | { type: "student"; studentId: string }
  | { type: "lodicka"; lodickaId: string }
  | { type: "personal"; personalId: string; eventId?: string };

type LeftLodickaItem = { kind: "lodicka"; lodicka: ProtoLodickaCatalogItem; count: number };
type LeftStudentItem = { kind: "student"; student: ProtoStudent; count: number };
type LeftItem = LeftLodickaItem | LeftStudentItem;

type Child = {
  id: string;
  name: string;
  rocnik: number | null;
  stupen: 1 | 2 | null;
  smecka: string | null;
};

type Parent = {
  id: string;
  name: string;
};

type LodickaRow = {
  id: string;
  predmet: string;
  podpredmet: string;
  oblast: string;
  nazevLodicky: string;
  stav: string;
  uspech: string;
  poznamka: string;
  datumStavu: string | null;
};

type ChildrenResponse = {
  parent: Parent;
  userEmail: string | null;
  children: Child[];
};

type LodickyResponse = {
  parent: Parent;
  child: Child;
  lodicky: LodickaRow[];
};

const DEFAULT_ROLE: ProtoRoleId = "rodic";
const RIGHT_TABLE_LODICKY = "T321";
const RIGHT_TABLE_LIDE = "T322";
const DESKTOP_BASE_WIDTH = 1180;
const PANES_BOTTOM_GAP = 24;
const PANES_MIN_HEIGHT = 360;

const STATUS_BUTTONS: Array<{ value: LodickaStav; label: string }> = [
  { value: 0, label: "0" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
];

function OsobniLodickyPrototypePageInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const todayIso = getTodayIsoForProto();
  const semesterBounds = getActiveSemesterBounds(todayIso);

  const [activeRole, setActiveRole] = useState<ProtoRoleId>(DEFAULT_ROLE);
  const queryUserId = searchParams.get("user") ?? "";
  const [datasetVersion, setDatasetVersion] = useState(0);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const usersForRoleRaw = useMemo(() => getActorsByRole(activeRole), [activeRole, datasetVersion]);
  const roleOptions = useMemo(
    () => PROTO_ROLE_OPTIONS.filter((role) => getActorsByRole(role.id).length > 0),
    [datasetVersion],
  );

  const [selectedUserId, setSelectedUserId] = useState<string>(queryUserId);
  const activeUserId = useMemo(
    () =>
      usersForRoleRaw.some((item) => item.id === selectedUserId)
        ? selectedUserId
        : (usersForRoleRaw[0]?.id ?? ""),
    [selectedUserId, usersForRoleRaw],
  );

  const [scopeMode, setScopeMode] = useState<ScopeMode>("moje");
  const [viewMode, setViewMode] = useState<ViewMode>("po_lodickach");
  const [viewDate, setViewDate] = useState<string>(semesterBounds.maxDate);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const [peopleStupenFilter, setPeopleStupenFilter] = useState<string[]>([]);
  const [peopleRocnikFilter, setPeopleRocnikFilter] = useState<string[]>([]);
  const [peopleSmeckaFilter, setPeopleSmeckaFilter] = useState<string[]>([]);

  const [lodickyPredmetFilter, setLodickyPredmetFilter] = useState<string[]>([]);
  const [lodickyPodpredmetFilter, setLodickyPodpredmetFilter] = useState<string[]>([]);
  const [lodickyOblastFilter, setLodickyOblastFilter] = useState<string[]>([]);
  const [lodickyGarantFilter, setLodickyGarantFilter] = useState<string[]>([]);

  const [groupLodickyPredmet, setGroupLodickyPredmet] = useState(true);
  const [groupLodickyPodpredmet, setGroupLodickyPodpredmet] = useState(false);
  const [groupLodickyOblast, setGroupLodickyOblast] = useState(true);
  const [groupLodickyGarant, setGroupLodickyGarant] = useState(false);
  const [peopleGroupBy, setPeopleGroupBy] = useState<PeopleGroupKey>("smecka");

  const [searchInput, setSearchInput] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [leftSort, setLeftSort] = useState<PaneSort>("nazev");
  const [rightSort, setRightSort] = useState<PaneSort>("jmeno");

  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedPersonalId, setSelectedPersonalId] = useState<string | null>(null);
  const [detailSheet, setDetailSheet] = useState<DetailSheetState>({ type: "none" });

  const [events, setEvents] = useState<ProtoOsobniLodickaEvent[]>(PROTO_OSOBNI_LODICKA_EVENTS);
  const [invalidatedEventIds, setInvalidatedEventIds] = useState<string[]>([]);
  const [debugEvents, setDebugEvents] = useState<ProtoDebugEvent[]>([]);
  const [viewportWidth, setViewportWidth] = useState<number>(0);
  const [panesHeight, setPanesHeight] = useState<number>(420);
  const panesSectionRef = useRef<HTMLElement | null>(null);
  const pushDebug = useCallback((event: Omit<ProtoDebugEvent, "id" | "at">) => {
    setDebugEvents((prev) => [createProtoDebugEvent(event), ...prev].slice(0, 80));
  }, []);

  const isWideLayout = viewportWidth >= DESKTOP_BASE_WIDTH;
  const paneCardStyle = isWideLayout ? { maxHeight: `${panesHeight}px` } : undefined;

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromDb() {
      try {
        setDbLoading(true);
        setDbError(null);

        const childrenRes = await fetch("/api/m01/my-children", { cache: "no-store" });
        if (!childrenRes.ok) {
          const body = await childrenRes.json().catch(() => ({}));
          throw new Error(body.error ?? "Nepodařilo se načíst děti.");
        }

        const childrenBody = (await childrenRes.json()) as ChildrenResponse;
        const rowsByChild: Record<string, LodickaRow[]> = {};

        const childResults = await Promise.allSettled(
          childrenBody.children.map(async (child) => {
            const lodickyRes = await fetch(`/api/m01/child/${child.id}/lodicky`, { cache: "no-store" });
            if (!lodickyRes.ok) {
              const body = await lodickyRes.json().catch(() => ({}));
              throw new Error(body.error ?? `Nepodařilo se načíst lodičky pro ${child.name}.`);
            }
            const lodickyBody = (await lodickyRes.json()) as LodickyResponse;
            rowsByChild[child.id] = lodickyBody.lodicky;
          }),
        );

        const failed = childResults.filter((item) => item.status === "rejected");
        if (failed.length > 0) {
          console.error("[portal/osobni-lodicky] partial load failure", failed);
        }

        const nextDataset = buildProtoDatasetFromDb(childrenBody, rowsByChild);
        applyProtoDataset(nextDataset);

        if (cancelled) return;

        setActiveRole(DEFAULT_ROLE);
        setSelectedUserId(nextDataset.parentActorId);
        setEvents([...PROTO_OSOBNI_LODICKA_EVENTS]);
        setInvalidatedEventIds([]);
        setDatasetVersion((prev) => prev + 1);

        pushDebug({
          elementId: "API-M01-HYDRATE",
          label: "Hydratace proto UI z DB",
          action: "load",
          hierarchy: "OSOBNI_LODICKY > INIT",
          payload: `children=${childrenBody.children.length}; rows=${nextDataset.lodickyRowsCount}; failed=${failed.length}`,
        });
      } catch (error) {
        if (cancelled) return;
        setDbError(error instanceof Error ? error.message : "Nepodařilo se načíst osobní lodičky.");
      } finally {
        if (!cancelled) setDbLoading(false);
      }
    }

    void hydrateFromDb();

    return () => {
      cancelled = true;
    };
  }, [pushDebug]);

  useEffect(() => {
    if (!activeUserId) return;
    const params = new URLSearchParams();
    params.set("role", activeRole);
    params.set("user", activeUserId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeRole, activeUserId, pathname, router]);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth);
    return () => window.removeEventListener("resize", updateViewportWidth);
  }, []);

  const recomputePanesHeight = useCallback(() => {
    if (!panesSectionRef.current) return;
    const top = panesSectionRef.current.getBoundingClientRect().top;
    const available = Math.floor(window.innerHeight - top - PANES_BOTTOM_GAP);
    setPanesHeight(Math.max(PANES_MIN_HEIGHT, available));
  }, []);

  useEffect(() => {
    recomputePanesHeight();
    const raf = window.requestAnimationFrame(recomputePanesHeight);
    window.addEventListener("resize", recomputePanesHeight);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", recomputePanesHeight);
    };
  }, [filtersCollapsed, recomputePanesHeight]);

  const activeUser = usersForRoleRaw.find((item) => item.id === activeUserId) ?? usersForRoleRaw[0] ?? null;
  const effectiveViewDate = clampDate(viewDate, semesterBounds.minDate, semesterBounds.maxDate);
  const hasHistoricalViewDate = effectiveViewDate !== todayIso;
  const effectiveScope: ScopeMode = activeRole === "garant" || activeRole === "spravce" ? scopeMode : "moje";
  const isReadonly = activeRole === "rodic" || activeRole === "zak";
  const showGarantControls = effectiveScope !== "moje";

  const usersForRole = useMemo(
    () =>
      usersForRoleRaw.map((actor) => ({
        ...actor,
        jmeno: getActorDisplayForSelector(actor, activeRole),
      })),
    [activeRole, usersForRoleRaw],
  );

  const filterOptions = useMemo(() => {
    const rocniky = [...new Set(PROTO_STUDENTS.map((student) => String(student.rocnik)))].sort(
      (a, b) => Number(a) - Number(b),
    );

    const garanti = [...new Set(PROTO_LODICKY_CATALOG.map((lodicka) => getGuideDisplayName(lodicka.garantId)))].sort(
      (a, b) => a.localeCompare(b, "cs"),
    );

    return {
      stupne: ["1", "2"],
      rocniky,
      smecky: [...new Set(PROTO_STUDENTS.map((student) => student.smecka))].sort((a, b) => a.localeCompare(b, "cs")),
      predmety: [...new Set(PROTO_LODICKY_CATALOG.map((lodicka) => lodicka.predmet))].sort((a, b) =>
        a.localeCompare(b, "cs"),
      ),
      podpredmety: [...new Set(PROTO_LODICKY_CATALOG.map((lodicka) => lodicka.podpředmět ?? "-"))].sort((a, b) =>
        a.localeCompare(b, "cs"),
      ),
      oblasti: [...new Set(PROTO_LODICKY_CATALOG.map((lodicka) => lodicka.oblast))].sort((a, b) =>
        a.localeCompare(b, "cs"),
      ),
      garanti,
    };
  }, [datasetVersion]);

  const studentsById = useMemo(
    () => new Map(PROTO_STUDENTS.map((student) => [student.id, student])),
    [datasetVersion],
  );
  const lodickyById = useMemo(
    () => new Map(PROTO_LODICKY_CATALOG.map((lodicka) => [lodicka.id, lodicka])),
    [datasetVersion],
  );

  const invalidatedEventIdSet = useMemo(() => new Set(invalidatedEventIds), [invalidatedEventIds]);

  const eventsByPersonalAll = useMemo(() => {
    const map = new Map<string, ProtoOsobniLodickaEvent[]>();
    events.forEach((event) => {
      const bucket = map.get(event.osobniLodickaId) ?? [];
      bucket.push(event);
      map.set(event.osobniLodickaId, bucket);
    });

    map.forEach((bucket) => {
      bucket.sort((a, b) => {
        if (a.datumStavu === b.datumStavu) return a.zapsanoAt.localeCompare(b.zapsanoAt);
        return a.datumStavu.localeCompare(b.datumStavu);
      });
    });

    return map;
  }, [events]);

  const eventsByPersonalActive = useMemo(() => {
    const map = new Map<string, ProtoOsobniLodickaEvent[]>();
    eventsByPersonalAll.forEach((bucket, personalId) => {
      map.set(
        personalId,
        bucket.filter((event) => !invalidatedEventIdSet.has(event.id)),
      );
    });
    return map;
  }, [eventsByPersonalAll, invalidatedEventIdSet]);

  const statusSnapshotByPersonal = useMemo(() => {
    const map = new Map<string, { stav: LodickaStav; lastEvent: ProtoOsobniLodickaEvent | null }>();

    PROTO_OSOBNI_LODICKY.forEach((item) => {
      const personalEvents = eventsByPersonalActive.get(item.id) ?? [];
      let selected: ProtoOsobniLodickaEvent | null = null;
      for (const event of personalEvents) {
        if (event.datumStavu <= effectiveViewDate) selected = event;
      }
      map.set(item.id, {
        stav: selected?.stav ?? 0,
        lastEvent: selected,
      });
    });

    return map;
  }, [effectiveViewDate, eventsByPersonalActive]);

  const accessibleStudents = useMemo(() => {
    if (!activeUser) return [] as ProtoStudent[];

    if (activeRole === "zak" && activeUser.linkedStudentId) {
      return PROTO_STUDENTS.filter((student) => student.id === activeUser.linkedStudentId);
    }

    if (activeRole === "rodic") {
      return getParentChildren(activeUser.id);
    }

    return PROTO_STUDENTS;
  }, [activeRole, activeUser, datasetVersion]);

  const searchPlan = useMemo(
    () =>
      buildSmartSearchPlan(searchInput, {
        stupne: filterOptions.stupne,
        rocniky: filterOptions.rocniky,
        smecky: filterOptions.smecky,
        predmety: filterOptions.predmety,
        podpredmety: filterOptions.podpredmety,
        oblasti: filterOptions.oblasti,
        garanti: showGarantControls ? filterOptions.garanti : [],
        studentHaystacks: accessibleStudents.map((student) => buildStudentSearchHaystack(student)),
      }),
    [accessibleStudents, filterOptions, searchInput, showGarantControls],
  );

  const effectivePeopleStupenFilter = useMemo(
    () => uniqueValues([...peopleStupenFilter, ...searchPlan.people.stupen]),
    [peopleStupenFilter, searchPlan.people.stupen],
  );
  const effectivePeopleRocnikFilter = useMemo(
    () => uniqueValues([...peopleRocnikFilter, ...searchPlan.people.rocnik]),
    [peopleRocnikFilter, searchPlan.people.rocnik],
  );
  const effectivePeopleSmeckaFilter = useMemo(
    () => uniqueValues([...peopleSmeckaFilter, ...searchPlan.people.smecka]),
    [peopleSmeckaFilter, searchPlan.people.smecka],
  );

  const effectiveLodickyPredmetFilter = useMemo(
    () => uniqueValues([...lodickyPredmetFilter, ...searchPlan.lodicky.predmet]),
    [lodickyPredmetFilter, searchPlan.lodicky.predmet],
  );
  const effectiveLodickyPodpredmetFilter = useMemo(
    () => uniqueValues([...lodickyPodpredmetFilter, ...searchPlan.lodicky.podpredmet]),
    [lodickyPodpredmetFilter, searchPlan.lodicky.podpredmet],
  );
  const effectiveLodickyOblastFilter = useMemo(
    () => uniqueValues([...lodickyOblastFilter, ...searchPlan.lodicky.oblast]),
    [lodickyOblastFilter, searchPlan.lodicky.oblast],
  );
  const effectiveLodickyGarantFilter = useMemo(
    () => uniqueValues([...lodickyGarantFilter, ...searchPlan.lodicky.garant]),
    [lodickyGarantFilter, searchPlan.lodicky.garant],
  );

  const filteredStudents = useMemo(() => {
    const tokens = searchPlan.freeTokens;
    const tokenHasStudentMatch = new Map<string, boolean>();
    tokens.forEach((token) => {
      const hasMatch = accessibleStudents.some((student) => buildStudentSearchHaystack(student).includes(token));
      tokenHasStudentMatch.set(token, hasMatch);
    });

    return accessibleStudents.filter((student) => {
      if (
        effectivePeopleStupenFilter.length > 0 &&
        !effectivePeopleStupenFilter.includes(String(student.stupen))
      ) {
        return false;
      }
      if (
        effectivePeopleRocnikFilter.length > 0 &&
        !effectivePeopleRocnikFilter.includes(String(student.rocnik))
      ) {
        return false;
      }
      if (
        effectivePeopleSmeckaFilter.length > 0 &&
        !effectivePeopleSmeckaFilter.includes(student.smecka)
      ) {
        return false;
      }
      if (tokens.length > 0) {
        const haystack = buildStudentSearchHaystack(student);
        const relevantTokens = tokens.filter((token) => tokenHasStudentMatch.get(token));
        if (relevantTokens.length > 0 && !relevantTokens.every((token) => haystack.includes(token))) {
          return false;
        }
      }
      return true;
    });
  }, [
    accessibleStudents,
    effectivePeopleRocnikFilter,
    effectivePeopleSmeckaFilter,
    effectivePeopleStupenFilter,
    searchPlan.freeTokens,
  ]);

  const filteredLodicky = useMemo(() => {
    const tokens = searchPlan.freeTokens;
    const tokenHasLodickaMatch = new Map<string, boolean>();
    tokens.forEach((token) => {
      const hasMatch = PROTO_LODICKY_CATALOG.some((lodicka) => buildLodickaSearchHaystack(lodicka).includes(token));
      tokenHasLodickaMatch.set(token, hasMatch);
    });

    return PROTO_LODICKY_CATALOG.filter((lodicka) => {
      if (effectiveScope === "moje" && activeRole === "garant" && activeUserId) {
        if (lodicka.garantId !== activeUserId) return false;
      }
      if (
        effectiveLodickyPredmetFilter.length > 0 &&
        !effectiveLodickyPredmetFilter.includes(lodicka.predmet)
      ) {
        return false;
      }
      if (
        effectiveLodickyPodpredmetFilter.length > 0 &&
        !effectiveLodickyPodpredmetFilter.includes(lodicka.podpředmět ?? "-")
      ) {
        return false;
      }
      if (
        effectiveLodickyOblastFilter.length > 0 &&
        !effectiveLodickyOblastFilter.includes(lodicka.oblast)
      ) {
        return false;
      }
      if (
        showGarantControls &&
        effectiveLodickyGarantFilter.length > 0 &&
        !effectiveLodickyGarantFilter.includes(getGuideDisplayName(lodicka.garantId))
      ) {
        return false;
      }
      if (tokens.length > 0) {
        const haystack = buildLodickaSearchHaystack(lodicka);
        const relevantTokens = tokens.filter((token) => tokenHasLodickaMatch.get(token));
        if (relevantTokens.length > 0 && !relevantTokens.every((token) => haystack.includes(token))) {
          return false;
        }
      }
      return true;
    });
  }, [
    activeRole,
    activeUserId,
    effectiveLodickyGarantFilter,
    effectiveLodickyOblastFilter,
    effectiveLodickyPodpredmetFilter,
    effectiveLodickyPredmetFilter,
    effectiveScope,
    searchPlan.freeTokens,
    showGarantControls,
  ]);

  const filteredStudentIds = useMemo(() => new Set(filteredStudents.map((student) => student.id)), [filteredStudents]);
  const filteredLodickaIds = useMemo(() => new Set(filteredLodicky.map((lodicka) => lodicka.id)), [filteredLodicky]);

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
      const map = new Map<string, number>();
      personalRows.forEach((row) => {
        map.set(row.lodicka.id, (map.get(row.lodicka.id) ?? 0) + 1);
      });

      const items: LeftLodickaItem[] = filteredLodicky
        .map((lodicka) => ({
          kind: "lodicka" as const,
          lodicka,
          count: map.get(lodicka.id) ?? 0,
        }))
        .filter((item) => item.count > 0);

      return sortLeftItems(items, leftSort, viewMode, activeRole) as LeftItem[];
    }

    const map = new Map<string, number>();
    personalRows.forEach((row) => {
      map.set(row.student.id, (map.get(row.student.id) ?? 0) + 1);
    });

    const items: LeftStudentItem[] = filteredStudents
      .map((student) => ({
        kind: "student" as const,
        student,
        count: map.get(student.id) ?? 0,
      }))
      .filter((item) => item.count > 0);

    return sortLeftItems(items, leftSort, viewMode, activeRole) as LeftItem[];
  }, [activeRole, filteredLodicky, filteredStudents, leftSort, personalRows, viewMode]);

  const selectedLeftIdEffective = useMemo(() => {
    const ids = leftItems.map((item) => (item.kind === "lodicka" ? item.lodicka.id : item.student.id));
    if (ids.length === 0) return null;
    if (selectedLeftId && ids.includes(selectedLeftId)) return selectedLeftId;
    return ids[0];
  }, [leftItems, selectedLeftId]);

  const rightRows = useMemo(() => {
    if (!selectedLeftIdEffective) return [] as PersonalWithSnapshot[];
    const result =
      viewMode === "po_lodickach"
        ? personalRows.filter((row) => row.lodicka.id === selectedLeftIdEffective)
        : personalRows.filter((row) => row.student.id === selectedLeftIdEffective);
    return sortRightRows(result, rightSort, viewMode, activeRole);
  }, [activeRole, personalRows, rightSort, selectedLeftIdEffective, viewMode]);

  const selectedPersonalEffective = useMemo(() => {
    if (rightRows.length === 0) return null;
    if (selectedPersonalId && rightRows.some((row) => row.personal.id === selectedPersonalId)) {
      return selectedPersonalId;
    }
    return rightRows[0]?.personal.id ?? null;
  }, [rightRows, selectedPersonalId]);

  const selectedPersonalRow = rightRows.find((row) => row.personal.id === selectedPersonalEffective) ?? null;
  const selectedPersonalHistory = (selectedPersonalEffective
    ? [...(eventsByPersonalAll.get(selectedPersonalEffective) ?? [])]
    : []
  ).sort((a, b) => {
    if (a.datumStavu === b.datumStavu) return b.zapsanoAt.localeCompare(a.zapsanoAt);
    return b.datumStavu.localeCompare(a.datumStavu);
  });

  const lodickaGroupKeys = useMemo(() => {
    const keys: LodickaGroupKey[] = [];
    if (groupLodickyPredmet) keys.push("predmet");
    if (groupLodickyPodpredmet) keys.push("podpredmet");
    if (groupLodickyOblast) keys.push("oblast");
    if (groupLodickyGarant && showGarantControls) keys.push("garant");
    return keys;
  }, [
    groupLodickyGarant,
    groupLodickyOblast,
    groupLodickyPodpredmet,
    groupLodickyPredmet,
    showGarantControls,
  ]);

  const suggestions = useMemo(() => {
    if (!searchInput.trim()) return [] as SearchSuggestion[];
    const output: SearchSuggestion[] = [];
    const seen = new Set<string>();
    const tokens = tokenizeSearch(searchInput);

    const filterMatchers: Array<{
      type: SearchSuggestion["type"];
      label: string;
      options: string[];
    }> = [
      { type: "smecka", label: "Smečka", options: filterOptions.smecky },
      { type: "rocnik", label: "Ročník", options: filterOptions.rocniky },
      { type: "stupen", label: "Stupeň", options: filterOptions.stupne },
      { type: "predmet", label: "Předmět", options: filterOptions.predmety },
      { type: "podpredmet", label: "Podpředmět", options: filterOptions.podpredmety },
      { type: "oblast", label: "Oblast", options: filterOptions.oblasti },
      ...(showGarantControls
        ? [{ type: "garant" as const, label: "Garant", options: filterOptions.garanti }]
        : []),
    ];

    tokens.forEach((token) => {
      filterMatchers.forEach((matcher) => {
        matcher.options
          .filter((option) => normalizeSearch(option).includes(token))
          .slice(0, 2)
          .forEach((option) => {
            const id = `${matcher.type}-${option}-${token}`;
            if (seen.has(id)) return;
            seen.add(id);
            output.push({
              id,
              label: `${matcher.label}: ${matcher.type === "rocnik" ? formatRocnikLabel(Number(option)) : matcher.type === "stupen" ? `${option}. stupeň` : option}`,
              type: matcher.type,
              value: option,
              token,
            });
          });
      });
    });

    const queryNeedle = normalizeSearch(searchInput);
    if (viewMode === "po_lidech") {
      filteredStudents
        .filter((student) =>
          normalizeSearch(`${student.jmeno} ${student.prezdivka} ${getFirstName(student.jmeno)}`).includes(queryNeedle),
        )
        .slice(0, 3)
        .forEach((student) => {
          const display = getStudentDisplayName(student, activeRole);
          const id = `student-${student.id}`;
          if (seen.has(id)) return;
          seen.add(id);
          output.push({ id, label: `Dítě: ${display}`, type: "student", value: display });
        });
    } else {
      filteredLodicky
        .filter((lodicka) =>
          normalizeSearch(`${lodicka.nazev} ${lodicka.popis} ${lodicka.oblast}`).includes(queryNeedle),
        )
        .slice(0, 3)
        .forEach((lodicka) => {
          const id = `lodicka-${lodicka.id}`;
          if (seen.has(id)) return;
          seen.add(id);
          output.push({ id, label: `Lodička: ${lodicka.nazev}`, type: "lodicka", value: lodicka.nazev });
        });
    }

    return output.slice(0, 10);
  }, [activeRole, filterOptions, filteredLodicky, filteredStudents, searchInput, showGarantControls, viewMode]);

  const options = filterOptions;

  const leftTableId = viewMode === "po_lodickach" ? "T221" : "T222";
  const rightTableId = viewMode === "po_lodickach" ? RIGHT_TABLE_LODICKY : RIGHT_TABLE_LIDE;

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

  function clearAllFilters() {
    setPeopleStupenFilter([]);
    setPeopleRocnikFilter([]);
    setPeopleSmeckaFilter([]);
    setLodickyPredmetFilter([]);
    setLodickyPodpredmetFilter([]);
    setLodickyOblastFilter([]);
    setLodickyGarantFilter([]);
    setSearchInput("");
    setSuggestionsOpen(false);

    pushDebug({
      elementId: "BTN-CLEAR-FILTERS",
      label: "Vymazat všechny filtry",
      action: "clear-filters",
      hierarchy: "PERSONAL_LODICKY > FILTERS",
    });
  }

  function applySuggestion(suggestion: SearchSuggestion, index: number) {
    if (suggestion.type === "smecka") {
      setPeopleSmeckaFilter((prev) => (prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]));
      setSearchInput((prev) => removeTokenFromSearch(prev, suggestion.token ?? suggestion.value));
    } else if (suggestion.type === "rocnik") {
      setPeopleRocnikFilter((prev) => (prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]));
      setSearchInput((prev) => removeTokenFromSearch(prev, suggestion.token ?? suggestion.value));
    } else if (suggestion.type === "stupen") {
      setPeopleStupenFilter((prev) => (prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]));
      setSearchInput((prev) => removeTokenFromSearch(prev, suggestion.token ?? suggestion.value));
    } else if (suggestion.type === "oblast") {
      setLodickyOblastFilter((prev) => (prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]));
      setSearchInput((prev) => removeTokenFromSearch(prev, suggestion.token ?? suggestion.value));
    } else if (suggestion.type === "predmet") {
      setLodickyPredmetFilter((prev) => (prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]));
      setSearchInput((prev) => removeTokenFromSearch(prev, suggestion.token ?? suggestion.value));
    } else if (suggestion.type === "podpredmet") {
      setLodickyPodpredmetFilter((prev) => (prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]));
      setSearchInput((prev) => removeTokenFromSearch(prev, suggestion.token ?? suggestion.value));
    } else if (suggestion.type === "garant") {
      setLodickyGarantFilter((prev) => (prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]));
      setSearchInput((prev) => removeTokenFromSearch(prev, suggestion.token ?? suggestion.value));
    } else {
      setSearchInput(suggestion.value);
    }
    setSuggestionsOpen(false);

    pushDebug({
      elementId: `SRCH-SUG-${index + 1}`,
      label: suggestion.label,
      action: "apply-search-suggestion",
      hierarchy: "PERSONAL_LODICKY > SEARCH",
      payload: `${suggestion.type}:${suggestion.value}`,
    });
  }

  function updateStatus(personalId: string, nextStatus: LodickaStav) {
    if (isReadonly || !activeUser) return;

    const activeEvents = [...(eventsByPersonalActive.get(personalId) ?? [])];
    const sameDateEvents = activeEvents.filter((event) => event.datumStavu === effectiveViewDate);
    const newerEvents = activeEvents.filter((event) => event.datumStavu > effectiveViewDate);

    if (sameDateEvents.length > 0) {
      const allowOverwrite = window.confirm(
        `Pro datum ${formatDateCz(effectiveViewDate)} už existuje stav lodičky. Chceš ho přepsat?`,
      );
      if (!allowOverwrite) return;
    }

    let invalidateNewer = false;
    if (newerEvents.length > 0) {
      const proceedHistorical = window.confirm(
        `Zapisuješ historický stav (${formatDateCz(effectiveViewDate)}), ale existuje ${newerEvents.length} novější záznam(ů). Pokračovat?`,
      );
      if (!proceedHistorical) return;

      invalidateNewer = window.confirm(
        "Chceš novější záznamy zneplatnit?\nOK = zneplatnit novější záznamy\nStorno = ponechat novější záznamy platné",
      );
    }

    const now = new Date();
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    const event: ProtoOsobniLodickaEvent = {
      id: `evt-manual-${personalId}-${now.getTime()}`,
      osobniLodickaId: personalId,
      datumStavu: effectiveViewDate,
      zapsanoAt: `${effectiveViewDate} ${hour}:${minute}`,
      stav: nextStatus,
      zapsalId: activeUser.id,
      poznamka: "Prototyp: ruční změna stavu.",
    };

    const toInvalidate = [
      ...sameDateEvents.map((event) => event.id),
      ...(invalidateNewer ? newerEvents.map((event) => event.id) : []),
    ];
    if (toInvalidate.length > 0) {
      setInvalidatedEventIds((prev) => uniqueValues([...prev, ...toInvalidate]));
    }

    setEvents((prev) => [...prev, event]);
    setSelectedPersonalId(personalId);

    pushDebug({
      elementId: `BTN-S${nextStatus}-${personalId}`,
      label: "Změna stavu osobní lodičky",
      action: "set-status",
      tableId: viewMode === "po_lodickach" ? RIGHT_TABLE_LODICKY : RIGHT_TABLE_LIDE,
      rowId: personalId,
      hierarchy: "PERSONAL_LODICKY > RIGHT_PANE > STATUS_BUTTONS",
      payload: `stav=${nextStatus}; datum=${effectiveViewDate}; overwriteSameDate=${sameDateEvents.length > 0}; invalidateNewer=${invalidateNewer}`,
    });
  }

  function openLodickaDetail(lodickaId: string, rowId: string, tableId: string) {
    setDetailSheet({ type: "lodicka", lodickaId });
    pushDebug({
      elementId: `INFO-LODICKA-${rowId}`,
      label: "Detail lodičky",
      action: "open-detail-sheet",
      tableId,
      rowId,
      hierarchy: `${tableId} > DETAIL_LODICKA`,
      payload: lodickaId,
    });
  }

  function openStudentDetail(studentId: string, rowId: string, tableId: string) {
    setDetailSheet({ type: "student", studentId });
    pushDebug({
      elementId: `INFO-STUDENT-${rowId}`,
      label: "Detail dítěte",
      action: "open-detail-sheet",
      tableId,
      rowId,
      hierarchy: `${tableId} > DETAIL_STUDENT`,
      payload: studentId,
    });
  }

  function openPersonalDetail(personalId: string, eventId?: string) {
    setDetailSheet({ type: "personal", personalId, eventId });
    pushDebug({
      elementId: `DETAIL-PERSONAL-${personalId}`,
      label: "Detail osobní lodičky",
      action: "open-detail-sheet",
      hierarchy: "PERSONAL_LODICKY > HISTORY_DETAIL",
      payload: eventId ? `personal=${personalId};event=${eventId}` : `personal=${personalId}`,
    });
  }

  const leftRows = renderLeftPaneRows({
    viewMode,
    items: leftItems,
    selectedLeftId: selectedLeftIdEffective,
    tableId: leftTableId,
    peopleGroupBy,
    lodickaGroupKeys,
    showGarantControls,
    activeRole,
    onSelect: (id, label, rowId, hierarchy) => {
      setSelectedLeftId(id);
      setSelectedPersonalId(null);
      pushDebug({
        elementId: `ROW-${leftTableId}-${rowId}`,
        label,
        action: "select-left-row",
        tableId: leftTableId,
        rowId,
        hierarchy,
      });
    },
    onOpenLodickaDetail: openLodickaDetail,
    onOpenStudentDetail: openStudentDetail,
  });

  const rightRowsRendered = renderRightPaneRows({
    rows: rightRows,
    selectedPersonalId: selectedPersonalEffective,
    viewMode,
    tableId: rightTableId,
    readonly: isReadonly,
    activeRole,
    peopleGroupBy,
    lodickaGroupKeys,
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
    onOpenLodickaDetail: openLodickaDetail,
    onOpenStudentDetail: openStudentDetail,
  });

  if (dbLoading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className={`${UI_CLASSES.pageContainer} py-6`}>
          <p className="text-sm text-slate-600">Načítám osobní lodičky…</p>
        </section>
      </main>
    );
  }

  if (dbError) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className={`${UI_CLASSES.pageContainer} py-6`}>
          <div className="rounded-md border border-[#DA0100]/30 bg-[#FFF4F4] p-4 text-sm text-[#A12A2A]">
            {dbError}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-44">
      <ProtoEdgePanel
        roleOptions={roleOptions}
        activeRole={activeRole}
        activeUserId={activeUserId}
        usersForRole={usersForRole}
        onRoleChange={handleRoleChange}
        onUserChange={handleUserChange}
        navItems={PROTO_QUICK_NAV}
        query={{ role: activeRole, user: activeUserId }}
      />

      <section className={`${UI_CLASSES.pageContainer} space-y-4 py-6`}>
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">Osobní lodičky</p>
          <h1 className="text-2xl font-semibold text-[#05204A]">Kompaktní pohled pro práci Garanta</h1>
          <p className="text-sm text-slate-600">
            Tři okna vedle sebe: levé, pravé a detail osobní lodičky. Minimum klikání, detail přes ikonu a modal.
          </p>
        </header>

        <Card className="border-[#D9E4F2]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-[#05204A]">Řízení pohledu a filtry</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#D9E4F2]"
                  onClick={clearAllFilters}
                >
                  Vymazat filtry
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#D9E4F2]"
                  onClick={() => setFiltersCollapsed((prev) => !prev)}
                >
                  {filtersCollapsed ? (
                    <>
                      <ChevronDown className="size-4" />
                      Rozbalit filtry
                    </>
                  ) : (
                    <>
                      <ChevronUp className="size-4" />
                      Skrýt filtry
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          {!filtersCollapsed && (
            <CardContent className="space-y-4">
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
                    { id: "po_lidech", label: "Po dětech" },
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
                  <div
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                      hasHistoricalViewDate ? "border-[#DA0100] bg-[#FFF3F3]" : "border-[#D9E4F2] bg-[#F8FBFF]"
                    }`}
                  >
                    <CalendarDays className={`size-4 ${hasHistoricalViewDate ? "text-[#DA0100]" : "text-[#0A4DA6]"}`} />
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
                      className={`w-full bg-transparent text-sm outline-none ${
                        hasHistoricalViewDate ? "text-[#B42318]" : "text-slate-700"
                      }`}
                    />
                  </div>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    Aktivní pololetí: {formatDateCz(semesterBounds.minDate)} až {formatDateCz(semesterBounds.maxDate)}
                  </span>
                  {hasHistoricalViewDate && (
                    <span className="mt-1 block text-[11px] font-medium text-[#B42318]">
                      Zobrazuješ historické datum.
                    </span>
                  )}
                </label>
              </div>

              <div className="relative">
                <div className="flex items-center gap-2 rounded-2xl border border-[#D9E4F2] bg-white px-3 py-2">
                  <Search className="size-4 text-[#0A4DA6]" />
                  <input
                    value={searchInput}
                    onFocus={() => setSuggestionsOpen(true)}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setSuggestionsOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && suggestions.length > 0) {
                        e.preventDefault();
                        applySuggestion(suggestions[0], 0);
                        return;
                      }
                      if (e.key === "Escape") setSuggestionsOpen(false);
                    }}
                    placeholder={
                      viewMode === "po_lidech"
                        ? "Vyhledat dítě nebo smečku (např. Fénix)"
                        : "Vyhledat lodičku, oblast nebo předmět"
                    }
                    className="w-full text-sm text-slate-700 outline-none"
                  />
                  {searchInput.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput("");
                        setSuggestionsOpen(false);
                      }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Vymazat vyhledávání"
                      title="Vymazat vyhledávání"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                  <Badge className="bg-[#F2F7FF] text-[#0A4DA6] hover:bg-[#F2F7FF]">
                    <Filter className="mr-1 size-3.5" />
                    fulltext
                  </Badge>
                </div>

                {suggestionsOpen && suggestions.length > 0 && (
                  <div className="absolute top-[calc(100%+6px)] z-20 w-full rounded-xl border border-[#D9E4F2] bg-white p-1 shadow-xl">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applySuggestion(suggestion, index)}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#F4F8FF]"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 min-[1180px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Card className="border-[#E3ECF9]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#05204A]">Filtry po dětech</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <MultiToggleSelect
                      label="Stupeň"
                      options={options.stupne}
                      value={effectivePeopleStupenFilter}
                      onChange={setPeopleStupenFilter}
                      renderOptionLabel={(option) => `${option}. stupeň`}
                    />
                    <MultiToggleSelect
                      label="Ročník"
                      options={options.rocniky}
                      value={effectivePeopleRocnikFilter}
                      onChange={setPeopleRocnikFilter}
                      renderOptionLabel={(option) => `${option}. ročník`}
                    />
                    <MultiToggleSelect
                      label="Smečka"
                      options={options.smecky}
                      value={effectivePeopleSmeckaFilter}
                      onChange={setPeopleSmeckaFilter}
                    />
                  </CardContent>
                </Card>

                <Card className="border-[#E3ECF9]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#05204A]">Filtry po lodičkách</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <MultiToggleSelect
                      label="Předmět"
                      options={options.predmety}
                      value={effectiveLodickyPredmetFilter}
                      onChange={setLodickyPredmetFilter}
                    />
                    <MultiToggleSelect
                      label="Podpředmět"
                      options={options.podpredmety}
                      value={effectiveLodickyPodpredmetFilter}
                      onChange={setLodickyPodpredmetFilter}
                    />
                    <MultiToggleSelect
                      label="Oblast"
                      options={options.oblasti}
                      value={effectiveLodickyOblastFilter}
                      onChange={setLodickyOblastFilter}
                    />
                    {showGarantControls && (
                      <MultiToggleSelect
                        label="Garant"
                        options={options.garanti}
                        value={effectiveLodickyGarantFilter}
                        onChange={setLodickyGarantFilter}
                      />
                    )}
                    <div className="space-y-2 rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Seskupování</p>
                      <div className="flex flex-wrap gap-2">
                        <GroupToggle label="Předmět" enabled={groupLodickyPredmet} onToggle={setGroupLodickyPredmet} />
                        <GroupToggle
                          label="Podpředmět"
                          enabled={groupLodickyPodpredmet}
                          onToggle={setGroupLodickyPodpredmet}
                        />
                        <GroupToggle label="Oblast" enabled={groupLodickyOblast} onToggle={setGroupLodickyOblast} />
                        {showGarantControls && (
                          <GroupToggle label="Garant" enabled={groupLodickyGarant} onToggle={setGroupLodickyGarant} />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          )}
        </Card>

        <section
          ref={panesSectionRef}
          className="grid min-h-0 gap-4 min-[1180px]:items-start min-[1180px]:grid-cols-[minmax(0,0.33fr)_minmax(0,0.43fr)_minmax(0,0.24fr)]"
        >
          <Card
            className="min-w-0 border-[#D9E4F2] min-[1180px]:flex min-[1180px]:min-h-0 min-[1180px]:flex-col min-[1180px]:overflow-hidden"
            style={paneCardStyle}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-[#05204A]">{viewMode === "po_lodickach" ? "Lodičky" : "Děti"}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <SortSelect
                    value={leftSort}
                    onChange={setLeftSort}
                    options={
                      viewMode === "po_lodickach"
                        ? showGarantControls
                          ? [
                              { id: "nazev", label: "Název" },
                              { id: "garant", label: "Garant" },
                            ]
                          : [{ id: "nazev", label: "Název" }]
                        : [
                            { id: "jmeno", label: "Jméno" },
                            { id: "rocnik", label: "Ročník" },
                          ]
                    }
                  />
                  {viewMode === "po_lidech" && (
                    <InlineSelect
                      label="Seskupit"
                      value={peopleGroupBy}
                      onChange={(value) => setPeopleGroupBy(value as PeopleGroupKey)}
                      options={[
                        { id: "smecka", label: "Smečky" },
                        { id: "rocnik", label: "Ročníky" },
                        { id: "none", label: "Neseskupovat" },
                      ]}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-auto min-[1180px]:min-h-0 min-[1180px]:flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    {viewMode === "po_lodickach" ? (
                      <>
                        <TableHead>Lodička</TableHead>
                        {showGarantControls && <TableHead>Garant</TableHead>}
                        <TableHead>Počet</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Dítě</TableHead>
                        <TableHead>Počet</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leftItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={showGarantControls && viewMode === "po_lodickach" ? 3 : 2} className="py-8 text-center text-slate-500">
                        Žádná data pro zvolený filtr.
                      </TableCell>
                    </TableRow>
                  )}
                  {leftRows}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card
            className="min-w-0 border-[#D9E4F2] min-[1180px]:flex min-[1180px]:min-h-0 min-[1180px]:flex-col min-[1180px]:overflow-hidden"
            style={paneCardStyle}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-[#05204A]">
                    {viewMode === "po_lodickach" ? "Děti pro vybranou lodičku" : "Lodičky vybraného dítěte"}
                  </CardTitle>
                </div>
                <SortSelect
                  value={rightSort}
                  onChange={setRightSort}
                  options={
                    viewMode === "po_lodickach"
                      ? [
                          { id: "jmeno", label: "Jméno" },
                          { id: "stav", label: "Stav" },
                        ]
                      : [
                          { id: "nazev", label: "Lodička" },
                          { id: "stav", label: "Stav" },
                      ]
                  }
                />
                {viewMode === "po_lodickach" && (
                  <InlineSelect
                    label="Seskupit děti"
                    value={peopleGroupBy}
                    onChange={(value) => setPeopleGroupBy(value as PeopleGroupKey)}
                    options={[
                      { id: "smecka", label: "Smečky" },
                      { id: "rocnik", label: "Ročníky" },
                      { id: "none", label: "Neseskupovat" },
                    ]}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="overflow-auto min-[1180px]:min-h-0 min-[1180px]:flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{viewMode === "po_lodickach" ? "Dítě" : "Lodička"}</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead className="text-right">Změna</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rightRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-slate-500">
                        Pravý panel je prázdný. Vyber vlevo řádek nebo uprav filtr.
                      </TableCell>
                    </TableRow>
                  )}
                  {rightRowsRendered}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card
            className="min-w-0 border-[#D9E4F2] min-[1180px]:flex min-[1180px]:min-h-0 min-[1180px]:flex-col min-[1180px]:overflow-hidden"
            style={paneCardStyle}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-[#05204A]">
                  {selectedPersonalRow
                    ? getStudentDisplayName(selectedPersonalRow.student, activeRole)
                    : "Historie osobní lodičky"}
                </CardTitle>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[#D9E4F2]"
                  disabled={!selectedPersonalRow}
                  onClick={() => {
                    if (!selectedPersonalRow) return;
                    openPersonalDetail(
                      selectedPersonalRow.personal.id,
                      selectedPersonalHistory[0]?.id,
                    );
                  }}
                >
                  Detail
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-auto min-[1180px]:min-h-0 min-[1180px]:flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum stavu</TableHead>
                    <TableHead>Stav</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPersonalHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="py-6 text-center text-slate-500">
                        Pro vybranou položku zatím nejsou eventy.
                      </TableCell>
                    </TableRow>
                  )}
                  {selectedPersonalHistory.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{formatDateCz(event.datumStavu)}</TableCell>
                      <TableCell>
                        <Badge className={stavBadgeClass(event.stav)}>{LODICKA_STAV_LABEL[event.stav]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </section>

      <DetailSheet
        state={detailSheet}
        eventsByPersonal={eventsByPersonalAll}
        activeRole={activeRole}
        onClose={() => setDetailSheet({ type: "none" })}
      />

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

function DetailSheet({
  state,
  eventsByPersonal,
  activeRole,
  onClose,
}: {
  state: DetailSheetState;
  eventsByPersonal: Map<string, ProtoOsobniLodickaEvent[]>;
  activeRole: ProtoRoleId;
  onClose: () => void;
}) {
  const open = state.type !== "none";
  const onOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  const personal =
    state.type === "personal" ? PROTO_OSOBNI_LODICKY.find((item) => item.id === state.personalId) ?? null : null;
  const student =
    state.type === "student"
      ? PROTO_STUDENTS.find((item) => item.id === state.studentId) ?? null
      : personal
        ? PROTO_STUDENTS.find((item) => item.id === personal.studentId) ?? null
        : null;
  const lodicka =
    state.type === "lodicka"
      ? PROTO_LODICKY_CATALOG.find((item) => item.id === state.lodickaId) ?? null
      : personal
        ? PROTO_LODICKY_CATALOG.find((item) => item.id === personal.lodickaId) ?? null
        : null;

  const personalEvents =
    state.type === "personal" && personal
      ? [...(eventsByPersonal.get(personal.id) ?? [])].sort((a, b) => {
          if (a.datumStavu === b.datumStavu) return a.zapsanoAt.localeCompare(b.zapsanoAt);
          return a.datumStavu.localeCompare(b.datumStavu);
        })
      : [];

  const highlightedEventId = state.type === "personal" ? state.eventId : undefined;
  const detailWidthClass =
    state.type === "student"
      ? "w-[84vw] max-w-[460px] sm:max-w-[460px]"
      : state.type === "personal"
        ? "w-[92vw] max-w-[920px] sm:max-w-[920px]"
        : "w-[88vw] max-w-[620px] sm:max-w-[620px]";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={`${detailWidthClass} overflow-y-auto`}>
        {state.type === "student" && student && (
          <>
            <SheetHeader>
              <SheetTitle>Detail dítěte</SheetTitle>
              <SheetDescription>{student.prezdivka}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 p-4 pt-0">
              <div className="flex items-start gap-4 rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] p-3">
                <Image
                  src={getStudentPhotoUrl(student)}
                  alt={`Fotka ${student.jmeno}`}
                  width={80}
                  height={80}
                  unoptimized
                  className="h-20 w-20 rounded-xl border border-[#D9E4F2] bg-white object-cover"
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#05204A]">{student.prezdivka}</p>
                  <p className="text-sm text-slate-700">{student.jmeno}</p>
                  <p className="text-sm text-slate-700">
                    {student.rocnik}. ročník · {student.smecka}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {state.type === "lodicka" && lodicka && (
          <>
            <SheetHeader>
              <SheetTitle>Detail lodičky</SheetTitle>
              <SheetDescription>{lodicka.nazev}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 p-4 pt-0">
              <div className="grid gap-2 rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] p-3">
                <InfoCell label="Kód" value={lodicka.kod} />
                <InfoCell label="Předmět" value={lodicka.predmet} />
                <InfoCell label="Podpředmět" value={lodicka.podpředmět ?? "-"} />
                <InfoCell label="Oblast" value={lodicka.oblast} />
                <InfoCell label="Garant" value={getGuideDisplayName(lodicka.garantId)} />
                <InfoCell label="Ročníky plnění" value={`${lodicka.odRocniku}. až ${lodicka.doRocniku}. ročník`} />
                <InfoCell label="Typ" value={lodicka.typ === "hromadna" ? "Hromadná" : "Individuální"} />
              </div>

              <div className="rounded-xl border border-[#D9E4F2] bg-white p-3">
                <p className="text-sm font-semibold text-[#05204A]">Vazba na RVP / OVU</p>
                <div className="mt-2 space-y-2">
                  {getMockRvpBindings(lodicka).map((ovu) => (
                    <div key={ovu.kod} className="rounded-lg border border-[#E3ECF9] bg-[#F8FBFF] p-2">
                      <p className="text-xs font-semibold text-[#0A4DA6]">{ovu.kod}</p>
                      <p className="text-sm text-slate-700">{ovu.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {state.type === "personal" && personal && student && lodicka && (
          <>
            <SheetHeader>
              <SheetTitle>Detail osobní lodičky</SheetTitle>
              <SheetDescription>
                {getStudentDisplayName(student, activeRole)} · {lodicka.nazev}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 p-4 pt-0">
              <div className="grid gap-2 rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] p-3">
                <InfoCell label="Dítě" value={student.jmeno} />
                <InfoCell label="Přezdívka" value={student.prezdivka} />
                <InfoCell label="Ročník" value={`${student.rocnik}. ročník`} />
                <InfoCell label="Smečka" value={student.smecka} />
                <InfoCell label="Lodička" value={lodicka.nazev} />
                <InfoCell label="Kód lodičky" value={lodicka.kod} />
              </div>

              <Table className="min-w-[840px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum stavu</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead>Zapsáno</TableHead>
                    <TableHead>Zapsal</TableHead>
                    <TableHead>Poznámka</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personalEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-4 text-center text-slate-500">
                        Zatím bez záznamů.
                      </TableCell>
                    </TableRow>
                  )}
                  {personalEvents.map((event) => (
                    <TableRow key={event.id} className={highlightedEventId === event.id ? "bg-[#FFF7E8]" : ""}>
                      <TableCell>{formatDateCz(event.datumStavu)}</TableCell>
                      <TableCell>{LODICKA_STAV_LABEL[event.stav]}</TableCell>
                      <TableCell>{formatDateTimeCz(event.zapsanoAt)}</TableCell>
                      <TableCell>{getActorDisplayName(event.zapsalId, activeRole)}</TableCell>
                      <TableCell>{event.poznamka ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

type ProtoDatasetFromDb = {
  parentActorId: string;
  actors: ProtoActor[];
  students: ProtoStudent[];
  parentLinks: ProtoParentChildLink[];
  lodickyCatalog: ProtoLodickaCatalogItem[];
  osobniLodicky: ProtoOsobniLodicka[];
  events: ProtoOsobniLodickaEvent[];
  lodickyRowsCount: number;
};

function applyProtoDataset(dataset: ProtoDatasetFromDb) {
  replaceArray(PROTO_ACTORS, dataset.actors);
  replaceArray(PROTO_STUDENTS, dataset.students);
  replaceArray(PROTO_PARENT_CHILD_LINKS, dataset.parentLinks);
  replaceArray(PROTO_LODICKY_CATALOG, dataset.lodickyCatalog);
  replaceArray(PROTO_OSOBNI_LODICKY, dataset.osobniLodicky);
  replaceArray(PROTO_OSOBNI_LODICKA_EVENTS, dataset.events);
}

function replaceArray<T>(target: T[], next: T[]) {
  target.length = 0;
  target.push(...next);
}

function buildProtoDatasetFromDb(
  childrenData: ChildrenResponse,
  rowsByChild: Record<string, LodickaRow[]>,
): ProtoDatasetFromDb {
  const parentActorId = `u-rodic-${slugify(childrenData.parent.id || childrenData.parent.name || "db")}`;
  const parentName = childrenData.parent.name?.trim() || "Rodič";
  const parentEmail = (childrenData.userEmail ?? `${parentActorId}@svetoplavci.local`).trim().toLowerCase();

  const students: ProtoStudent[] = childrenData.children.map((child) => {
    const rocnik = normalizeChildRocnik(child.rocnik);
    const stupen = normalizeChildStupen(child.stupen, rocnik);
    return {
      id: child.id,
      jmeno: child.name,
      prezdivka: toNickname(child.name),
      stupen,
      rocnik,
      smecka: normalizeChildSmecka(child.smecka),
    };
  });

  const actors: ProtoActor[] = [
    {
      id: parentActorId,
      jmeno: parentName,
      email: parentEmail,
      roles: ["rodic"],
    },
  ];

  const parentLinks: ProtoParentChildLink[] = students.map((student) => ({
    parentId: parentActorId,
    studentId: student.id,
  }));

  const studentsById = new Map(students.map((student) => [student.id, student]));
  const catalogByKey = new Map<string, ProtoLodickaCatalogItem>();
  const osobniLodicky: ProtoOsobniLodicka[] = [];
  const events: ProtoOsobniLodickaEvent[] = [];
  const personalSeen = new Set<string>();
  let rowsCount = 0;

  for (const [childId, rows] of Object.entries(rowsByChild)) {
    const student = studentsById.get(childId);
    const studentStupen = student?.stupen ?? 1;
    const studentRocnik = student?.rocnik ?? 1;

    rows.forEach((row, index) => {
      rowsCount += 1;

      const key = `${row.predmet}|${row.podpredmet}|${row.oblast}|${row.nazevLodicky}`;
      let lodicka = catalogByKey.get(key);
      if (!lodicka) {
        const order = catalogByKey.size + 1;
        lodicka = {
          id: `lod-${slugify(`${key}-${order}`)}`,
          kod: `L-${String(order).padStart(3, "0")}`,
          nazev: row.nazevLodicky,
          popis: row.poznamka && row.poznamka !== "—" ? row.poznamka : row.nazevLodicky,
          predmet: row.predmet,
          podpředmět: row.podpredmet === "—" ? undefined : row.podpredmet,
          oblast: row.oblast,
          stupen: studentStupen,
          odRocniku: Math.max(1, studentRocnik - 1),
          doRocniku: Math.min(9, studentRocnik + 1),
          garantId: parentActorId,
          typ: "individualni",
        };
        catalogByKey.set(key, lodicka);
      }

      const personalId = `os-${childId}-${lodicka.id}`;
      if (!personalSeen.has(personalId)) {
        personalSeen.add(personalId);
        osobniLodicky.push({
          id: personalId,
          studentId: childId,
          lodickaId: lodicka.id,
        });
      }

      const datumStavu = normalizeIsoDate(row.datumStavu);
      events.push({
        id: `evt-${slugify(`${row.id}-${personalId}-${index}`)}`,
        osobniLodickaId: personalId,
        datumStavu,
        zapsanoAt: `${datumStavu} 12:00`,
        stav: mapDbStavToProto(row.stav),
        zapsalId: parentActorId,
        poznamka: row.poznamka && row.poznamka !== "—" ? row.poznamka : undefined,
      });
    });
  }

  return {
    parentActorId,
    actors,
    students,
    parentLinks,
    lodickyCatalog: [...catalogByKey.values()],
    osobniLodicky,
    events,
    lodickyRowsCount: rowsCount,
  };
}

function mapDbStavToProto(stav: string): LodickaStav {
  const normalized = normalizeSearch(stav);
  if (normalized.includes("samostat")) return 4;
  if (normalized.includes("castec")) return 3;
  if (normalized.includes("dopomoc")) return 2;
  if (normalized.includes("rozprac")) return 1;
  return 0;
}

function normalizeIsoDate(value: string | null): string {
  if (!value) return getTodayIsoForProto();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return getTodayIsoForProto();
  return date.toISOString().slice(0, 10);
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeChildRocnik(value: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  const rounded = Math.round(value);
  if (rounded < 1) return 1;
  if (rounded > 9) return 9;
  return rounded;
}

function normalizeChildStupen(value: 1 | 2 | null, rocnik: number): 1 | 2 {
  if (value === 1 || value === 2) return value;
  return rocnik <= 5 ? 1 : 2;
}

function normalizeChildSmecka(value: string | null): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Bez smečky";
}

function normalizeRole(input: string | null): ProtoRoleId {
  if (input === "garant" || input === "rodic" || input === "zak" || input === "spravce") return input;
  return DEFAULT_ROLE;
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
  value,
  onChange,
  options,
}: {
  value: PaneSort;
  onChange: (value: PaneSort) => void;
  options: { id: PaneSort; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-500">
      Řazení
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PaneSort)}
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

function InlineSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
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

function MultiToggleSelect({
  label,
  options,
  value,
  onChange,
  renderOptionLabel,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  renderOptionLabel?: (option: string) => string;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] p-2">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                if (selected) {
                  onChange(value.filter((item) => item !== option));
                } else {
                  onChange([...value, option]);
                }
              }}
              className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                selected
                  ? "border-[#0A4DA6] bg-[#0A4DA6] text-white"
                  : "border-[#D9E4F2] bg-white text-slate-700 hover:bg-[#F3F7FF]"
              }`}
            >
              {renderOptionLabel ? renderOptionLabel(option) : option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GroupToggle({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
        enabled
          ? "border-[#0A4DA6] bg-[#0A4DA6] text-white"
          : "border-[#D9E4F2] bg-white text-slate-700 hover:bg-[#F3F7FF]"
      }`}
    >
      {label}: {enabled ? "ano" : "ne"}
    </button>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D9E4F2] bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#05204A]">{value}</p>
    </div>
  );
}

function sortLeftItems(items: LeftLodickaItem[] | LeftStudentItem[], mode: PaneSort, viewMode: ViewMode, activeRole: ProtoRoleId) {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (viewMode === "po_lodickach" && a.kind === "lodicka" && b.kind === "lodicka") {
      if (mode === "garant") {
        return getGuideDisplayName(a.lodicka.garantId).localeCompare(getGuideDisplayName(b.lodicka.garantId), "cs");
      }
      return a.lodicka.nazev.localeCompare(b.lodicka.nazev, "cs");
    }

    if (viewMode === "po_lidech" && a.kind === "student" && b.kind === "student") {
      if (mode === "rocnik") {
        return a.student.rocnik - b.student.rocnik || a.student.jmeno.localeCompare(b.student.jmeno, "cs");
      }
      return getStudentDisplayName(a.student, activeRole).localeCompare(getStudentDisplayName(b.student, activeRole), "cs");
    }

    return 0;
  });
  return sorted;
}

function sortRightRows(rows: PersonalWithSnapshot[], mode: PaneSort, viewMode: ViewMode, activeRole: ProtoRoleId) {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (mode === "stav") return b.stav - a.stav;
    if (viewMode === "po_lodickach") {
      return getStudentDisplayName(a.student, activeRole).localeCompare(getStudentDisplayName(b.student, activeRole), "cs");
    }
    return a.lodicka.nazev.localeCompare(b.lodicka.nazev, "cs");
  });
  return sorted;
}

function renderLeftPaneRows({
  viewMode,
  items,
  selectedLeftId,
  tableId,
  peopleGroupBy,
  lodickaGroupKeys,
  showGarantControls,
  activeRole,
  onSelect,
  onOpenLodickaDetail,
  onOpenStudentDetail,
}: {
  viewMode: ViewMode;
  items: LeftItem[];
  selectedLeftId: string | null;
  tableId: string;
  peopleGroupBy: PeopleGroupKey;
  lodickaGroupKeys: LodickaGroupKey[];
  showGarantControls: boolean;
  activeRole: ProtoRoleId;
  onSelect: (id: string, label: string, rowId: string, hierarchy: string) => void;
  onOpenLodickaDetail: (lodickaId: string, rowId: string, tableId: string) => void;
  onOpenStudentDetail: (studentId: string, rowId: string, tableId: string) => void;
}) {
  let rowCounter = 0;

  if (viewMode === "po_lodickach") {
    const lodicky = items.filter((item): item is LeftLodickaItem => item.kind === "lodicka");
    const grouped = groupBy(lodicky, (item) => buildLodickaGroupLabel(item.lodicka, lodickaGroupKeys));

    return grouped.flatMap(([groupName, groupItems]) => {
      const rows: ReactElement[] = [];
      if (lodickaGroupKeys.length > 0) {
        rows.push(
          <TableRow key={`${groupName}-group`} className="bg-[#F7FAFF]">
            <TableCell colSpan={showGarantControls ? 3 : 2} className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0A4DA6]">
              {groupName} ({groupItems.length})
            </TableCell>
          </TableRow>,
        );
      }

      groupItems.forEach((item) => {
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
                `${tableId} > GROUP:${groupName} > LODICKA:${item.lodicka.id}`,
              )
            }
          >
            <TableCell className="font-medium text-[#05204A]">
              <div className="inline-flex items-center gap-1.5">
                <span>{item.lodicka.nazev}</span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-5 w-5 p-0 text-slate-500 hover:text-[#0A4DA6]"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenLodickaDetail(item.lodicka.id, String(rowCounter), tableId);
                  }}
                >
                  <Info className="size-3.5" />
                </Button>
              </div>
            </TableCell>
            {showGarantControls && <TableCell>{getGuideDisplayName(item.lodicka.garantId)}</TableCell>}
            <TableCell>{item.count}</TableCell>
          </TableRow>,
        );
      });

      return rows;
    });
  }

  const students = items.filter((item): item is LeftStudentItem => item.kind === "student");
  const grouped = groupBy(students, (item) => {
    if (peopleGroupBy === "none") return "__all__";
    if (peopleGroupBy === "rocnik") return formatRocnikLabel(item.student.rocnik);
    return item.student.smecka;
  });

  return grouped.flatMap(([groupName, groupItems]) => {
    const rows: ReactElement[] = [];
    if (peopleGroupBy !== "none") {
      rows.push(
        <TableRow key={`${groupName}-group`} className="bg-[#F7FAFF]">
          <TableCell colSpan={2} className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0A4DA6]">
            {groupName} ({groupItems.length})
          </TableCell>
        </TableRow>,
      );
    }

    groupItems.forEach((item) => {
      rowCounter += 1;
      const isSelected = selectedLeftId === item.student.id;
      const displayName = getStudentDisplayName(item.student, activeRole);
      rows.push(
        <TableRow
          key={item.student.id}
          data-state={isSelected ? "selected" : undefined}
          className="cursor-pointer"
          onClick={() =>
            onSelect(
              item.student.id,
              displayName,
              String(rowCounter),
              `${tableId} > GROUP:${groupName} > STUDENT:${item.student.id}`,
            )
          }
        >
          <TableCell className="font-medium text-[#05204A]">
            <div className="inline-flex items-center gap-1.5">
              <span>{displayName}</span>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="h-5 w-5 p-0 text-slate-500 hover:text-[#0A4DA6]"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenStudentDetail(item.student.id, String(rowCounter), tableId);
                }}
              >
                <Info className="size-3.5" />
              </Button>
            </div>
          </TableCell>
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
  activeRole,
  peopleGroupBy,
  lodickaGroupKeys,
  onSelectRow,
  onSetStatus,
  onOpenLodickaDetail,
  onOpenStudentDetail,
}: {
  rows: PersonalWithSnapshot[];
  selectedPersonalId: string | null;
  viewMode: ViewMode;
  tableId: string;
  readonly: boolean;
  activeRole: ProtoRoleId;
  peopleGroupBy: PeopleGroupKey;
  lodickaGroupKeys: LodickaGroupKey[];
  onSelectRow: (personalId: string, label: string, rowId: string, hierarchy: string) => void;
  onSetStatus: (personalId: string, status: LodickaStav) => void;
  onOpenLodickaDetail: (lodickaId: string, rowId: string, tableId: string) => void;
  onOpenStudentDetail: (studentId: string, rowId: string, tableId: string) => void;
}) {
  const grouped = groupBy(rows, (row) => {
    if (viewMode === "po_lodickach") {
      if (peopleGroupBy === "rocnik") return formatRocnikLabel(row.student.rocnik);
      return row.student.smecka;
    }
    return buildLodickaGroupLabel(row.lodicka, lodickaGroupKeys);
  });

  let rowCounter = 0;

  return grouped.flatMap(([groupName, groupItems]) => {
    const result: ReactElement[] = [];
    const hasGroupHeader = viewMode === "po_lodickach" || (viewMode === "po_lidech" && lodickaGroupKeys.length > 0);
    if (hasGroupHeader) {
      result.push(
        <TableRow key={`${groupName}-group`} className="bg-[#F7FAFF]">
          <TableCell colSpan={3} className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0A4DA6]">
            {groupName} ({groupItems.length})
          </TableCell>
        </TableRow>,
      );
    }

    groupItems.forEach((row) => {
      rowCounter += 1;
      const isSelected = selectedPersonalId === row.personal.id;
      const rowLabel = viewMode === "po_lodickach" ? getStudentDisplayName(row.student, activeRole) : row.lodicka.nazev;

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
            <div className="inline-flex items-center gap-1.5">
              <span>{rowLabel}</span>
              {viewMode === "po_lodickach" ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-5 w-5 p-0 text-slate-500 hover:text-[#0A4DA6]"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenStudentDetail(row.student.id, String(rowCounter), tableId);
                  }}
                >
                  <Info className="size-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-5 w-5 p-0 text-slate-500 hover:text-[#0A4DA6]"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenLodickaDetail(row.lodicka.id, String(rowCounter), tableId);
                  }}
                >
                  <Info className="size-3.5" />
                </Button>
              )}
            </div>
          </TableCell>
          <TableCell>
            <Badge className={stavBadgeClass(row.stav)}>{LODICKA_STAV_LABEL[row.stav]}</Badge>
          </TableCell>
          <TableCell className="text-right">
            <TooltipProvider delayDuration={450}>
              <div className="inline-flex gap-1">
                {STATUS_BUTTONS.map((statusButton) => (
                  <Tooltip key={statusButton.value}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={readonly}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSetStatus(row.personal.id, statusButton.value);
                        }}
                        className={statusButtonClass(statusButton.value, row.stav === statusButton.value)}
                      >
                        {statusButton.label}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8}>
                      {LODICKA_STAV_LABEL[statusButton.value]}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </TableCell>
        </TableRow>,
      );
    });

    return result;
  });
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildStudentSearchHaystack(student: ProtoStudent): string {
  const firstName = getFirstName(student.jmeno);
  const lastName = getLastName(student.jmeno);
  return normalizeSearch(
    `${student.jmeno} ${firstName} ${lastName} ${student.prezdivka} ${student.smecka} ${student.rocnik}`,
  );
}

function buildLodickaSearchHaystack(lodicka: ProtoLodickaCatalogItem): string {
  return normalizeSearch(
    `${lodicka.nazev} ${lodicka.popis} ${lodicka.oblast} ${lodicka.predmet} ${lodicka.podpředmět ?? ""} ${getGuideDisplayName(lodicka.garantId)}`,
  );
}

function tokenizeSearch(value: string): string[] {
  return normalizeSearch(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function findUniqueFilterMatch(token: string, options: string[]) {
  const matches = options.filter((option) => normalizeSearch(option).includes(token));
  if (matches.length !== 1) return null;
  const value = matches[0];
  if (!value) return null;
  const normalized = normalizeSearch(value);
  const score = normalized === token ? 3 : normalized.startsWith(token) ? 2 : 1;
  return { value, score };
}

function buildSmartSearchPlan(
  input: string,
  options: {
    stupne: string[];
    rocniky: string[];
    smecky: string[];
    predmety: string[];
    podpredmety: string[];
    oblasti: string[];
    garanti: string[];
    studentHaystacks: string[];
  },
) {
  const tokens = tokenizeSearch(input);
  const plan = {
    people: { stupen: [] as string[], rocnik: [] as string[], smecka: [] as string[] },
    lodicky: {
      predmet: [] as string[],
      podpredmet: [] as string[],
      oblast: [] as string[],
      garant: [] as string[],
    },
    freeTokens: [] as string[],
  };

  tokens.forEach((token) => {
    const candidates: Array<{ score: number; apply: () => void }> = [];

    const smecka = findUniqueFilterMatch(token, options.smecky);
    if (smecka) candidates.push({ score: smecka.score, apply: () => plan.people.smecka.push(smecka.value) });

    const rocnik = findUniqueFilterMatch(token, options.rocniky);
    if (rocnik) candidates.push({ score: rocnik.score, apply: () => plan.people.rocnik.push(rocnik.value) });

    const stupen = findUniqueFilterMatch(token, options.stupne);
    if (stupen) candidates.push({ score: stupen.score, apply: () => plan.people.stupen.push(stupen.value) });

    const predmet = findUniqueFilterMatch(token, options.predmety);
    if (predmet) candidates.push({ score: predmet.score, apply: () => plan.lodicky.predmet.push(predmet.value) });

    const podpredmet = findUniqueFilterMatch(token, options.podpredmety);
    if (podpredmet) {
      candidates.push({ score: podpredmet.score + 1, apply: () => plan.lodicky.podpredmet.push(podpredmet.value) });
    }

    const oblast = findUniqueFilterMatch(token, options.oblasti);
    if (oblast) candidates.push({ score: oblast.score, apply: () => plan.lodicky.oblast.push(oblast.value) });

    const hasStudentNameMatch = options.studentHaystacks.some((haystack) => haystack.includes(token));
    const garant = findUniqueFilterMatch(token, options.garanti);
    if (garant && !hasStudentNameMatch) {
      candidates.push({ score: garant.score, apply: () => plan.lodicky.garant.push(garant.value) });
    }

    if (candidates.length === 0) {
      plan.freeTokens.push(token);
      return;
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const second = candidates[1];
    if (best && (!second || best.score > second.score)) {
      best.apply();
    } else {
      plan.freeTokens.push(token);
    }
  });

  plan.people.stupen = uniqueValues(plan.people.stupen);
  plan.people.rocnik = uniqueValues(plan.people.rocnik);
  plan.people.smecka = uniqueValues(plan.people.smecka);
  plan.lodicky.predmet = uniqueValues(plan.lodicky.predmet);
  plan.lodicky.podpredmet = uniqueValues(plan.lodicky.podpredmet);
  plan.lodicky.oblast = uniqueValues(plan.lodicky.oblast);
  plan.lodicky.garant = uniqueValues(plan.lodicky.garant);

  return plan;
}

function removeTokenFromSearch(searchInput: string, token: string): string {
  const normalizedToken = normalizeSearch(token);
  if (!normalizedToken) return searchInput;
  const parts = searchInput
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const kept = parts.filter((part) => normalizeSearch(part) !== normalizedToken);
  return kept.join(" ");
}

function getGuideDisplayName(actorId: string): string {
  const actor = PROTO_ACTORS.find((item) => item.id === actorId);
  if (!actor) return actorId;
  return toNickname(actor.jmeno);
}

function getActorDisplayForSelector(actor: ProtoActor, activeRole: ProtoRoleId): string {
  if (activeRole === "rodic") return actor.jmeno;
  if (activeRole === "garant") return toNickname(actor.jmeno);
  if (activeRole === "zak") return toNickname(actor.jmeno);
  return actor.jmeno;
}

function getActorDisplayName(actorId: string, activeRole: ProtoRoleId): string {
  const actor = PROTO_ACTORS.find((item) => item.id === actorId);
  if (!actor) return actorId;

  if (actor.roles.includes("rodic")) return actor.jmeno;
  if (actor.roles.includes("garant")) return toNickname(actor.jmeno);
  if (actor.roles.includes("zak")) {
    const linked = actor.linkedStudentId ? PROTO_STUDENTS.find((item) => item.id === actor.linkedStudentId) : null;
    if (linked) return getStudentDisplayName(linked, activeRole);
    return toNickname(actor.jmeno);
  }
  return actor.jmeno;
}

function getStudentDisplayName(student: ProtoStudent, activeRole: ProtoRoleId): string {
  if (activeRole === "rodic") return getFirstName(student.jmeno);
  return student.prezdivka;
}

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function getLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? fullName;
}

function toNickname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? fullName;
  const last = parts[parts.length - 1] ?? "";
  const lastInitial = last ? `${last[0]}.` : "";
  return `${first} ${lastInitial}`.trim();
}

function buildLodickaGroupLabel(lodicka: ProtoLodickaCatalogItem, keys: LodickaGroupKey[]): string {
  if (keys.length === 0) return "Bez seskupení";
  const values = keys.map((key) => {
    if (key === "predmet") return lodicka.predmet;
    if (key === "podpredmet") return lodicka.podpředmět ?? "-";
    if (key === "oblast") return lodicka.oblast;
    return getGuideDisplayName(lodicka.garantId);
  });
  return values.join(" · ");
}

function formatRocnikLabel(rocnik: number): string {
  return `${rocnik}. ročník`;
}

function stavBadgeClass(stav: LodickaStav): string {
  if (stav === 4) return "cursor-default bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
  if (stav === 3) return "cursor-default bg-orange-100 text-orange-800 hover:bg-orange-100";
  if (stav === 2) return "cursor-default bg-blue-100 text-blue-800 hover:bg-blue-100";
  if (stav === 1) return "cursor-default bg-amber-100 text-amber-800 hover:bg-amber-100";
  return "cursor-default bg-slate-100 text-slate-700 hover:bg-slate-100";
}

function statusButtonClass(value: LodickaStav, isCurrent: boolean): string {
  if (isCurrent) {
    return "!border-[#002060] !bg-[#002060] !text-white !hover:border-[#002060] !hover:bg-[#002060] !hover:text-white";
  }

  if (value === 4) {
    return "border-slate-300 text-slate-700 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800";
  }
  if (value === 3) {
    return "border-slate-300 text-slate-700 hover:border-orange-300 hover:bg-orange-100 hover:text-orange-800";
  }
  if (value === 2) {
    return "border-slate-300 text-slate-700 hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800";
  }
  if (value === 1) {
    return "border-slate-300 text-slate-700 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800";
  }
  return "border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-800";
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

function clampDate(value: string, min: string, max: string): string {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function formatDateCz(value: string): string {
  const datePart = value.includes(" ") ? value.split(" ")[0] : value;
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function formatDateTimeCz(value: string): string {
  const [datePart, timePart] = value.split(" ");
  if (!datePart) return value;
  const date = formatDateCz(datePart);
  if (!timePart) return date;
  return `${date} ${timePart.slice(0, 5)}`;
}

function getStudentPhotoUrl(student: ProtoStudent): string {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(student.id)}`;
}

function hash(input: string): number {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) >>> 0;
  }
  return value;
}

function getMockRvpBindings(lodicka: ProtoLodickaCatalogItem): Array<{ kod: string; text: string }> {
  const seed = Math.abs(hash(`${lodicka.id}-${lodicka.kod}`));
  const first = (seed % 40) + 1;
  const second = ((seed + 17) % 40) + 1;
  return [
    {
      kod: `OVU-${lodicka.stupen}-${String(first).padStart(2, "0")}`,
      text: `${lodicka.oblast}: očekávaný výstup pro ${lodicka.doRocniku}. ročník`,
    },
    {
      kod: `OVU-${lodicka.stupen}-${String(second).padStart(2, "0")}`,
      text: `${lodicka.predmet}${lodicka.podpředmět ? ` / ${lodicka.podpředmět}` : ""}: navazující výstup`,
    },
  ];
}
