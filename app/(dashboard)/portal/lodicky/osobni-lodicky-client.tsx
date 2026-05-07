"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import { CalendarDays, ChevronDown, ChevronUp, Filter, Info, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProtoDebugPanel, createProtoDebugEvent, type ProtoDebugEvent } from "@/components/proto/proto-debug-panel";
import { SailboatLoading } from "@/components/sailboat-loading";
import { cn } from "@/lib/utils";
import {
  LODICKA_STAV_LABEL,
  PROTO_ACTORS,
  PROTO_PARENT_CHILD_LINKS,
  PROTO_LODICKY_CATALOG,
  PROTO_OSOBNI_LODICKA_EVENTS,
  PROTO_OSOBNI_LODICKY,
  PROTO_STUDENTS,
  PROTO_ROLE_OPTIONS,
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

const TEST_LODICKA_STAV_LABEL: Record<LodickaStav, string> = {
  ...LODICKA_STAV_LABEL,
  // Test DB uses "Zahájeno" for value 1; do not show legacy proto alias "Rozpracováno".
  1: "Zahájeno",
};

type ScopeMode = "moje" | "vsechny";
type ViewMode = "po_lodickach" | "po_lidech";
type PaneSort = "nazev" | "garant" | "jmeno" | "rocnik" | "stav";
type PeopleGroupKey = "smecka" | "rocnik" | "none";
type LodickaGroupKey = "predmet" | "podpredmet" | "oblast" | "garant";

type StatusUndoAction = {
  actionId: string;
  personalId: string;
  createdEventId: string;
  createdStatus: LodickaStav;
  previousStatus: LodickaStav;
  newlyInvalidatedIds: string[];
};

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
    | "stav"
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
  displayName?: string | null;
  firstName?: string | null;
  nickname?: string | null;
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
  lodickaId: string;
  kodLodicky: string | null;
  kodOsobniLodicky: string | null;
  predmet: string;
  podpredmet: string;
  oblast: string;
  nazevLodicky: string;
  typ: string | null;
  stupen: string | null;
  rocnikOd: number | null;
  rocnikDo: number | null;
  garantPersonId: string | null;
  garantName: string | null;
  stav: string;
  hodnota: number | null;
  uspech: string;
  poznamka: string;
  datumStavu: string | null;
  history: LodickaHistoryRow[];
};

type LodickaHistoryRow = {
  id: string;
  stav: string;
  hodnota: number | null;
  datumStavu: string | null;
  poznamka: string | null;
  uspech: string | null;
  changedByPersonId: string | null;
  changedByLabel: string | null;
  sourceCreatedByLabel: string | null;
  sourceModifiedByLabel: string | null;
  sourceCreatedAt: string | null;
  sourceModifiedAt: string | null;
  createdAt: string | null;
};

type SessionUserContext = {
  displayName: string;
  email: string;
  role: string;
  roles: string[];
};

type ChildrenResponse = {
  parent: Parent;
  userEmail: string | null;
  children: Child[];
};

type LodickaCatalogCompactRow = {
  lodickaId: string;
  kodLodicky: string | null;
  predmet: string;
  podpredmet: string;
  oblast: string;
  nazevLodicky: string;
  typ: string | null;
  stupen: string | null;
  rocnikOd: number | null;
  rocnikDo: number | null;
  garantPersonId: string | null;
  garantName: string | null;
};

type OsobniLodickaCompactRow = [
  childIndex: number,
  id: string,
  lodickaIndex: number,
  kodOsobniLodicky: string | null,
  stav: string,
  hodnota: number | null,
  uspech: string,
  poznamka: string,
  datumStavu: string | null,
  history?: LodickaHistoryRow[],
];

type LodickyCompactResponse = ChildrenResponse & {
  lodickyCatalog: LodickaCatalogCompactRow[];
  osobniLodicky: OsobniLodickaCompactRow[];
};

class SessionExpiredError extends Error {
  constructor(message = "Přihlášení vypršelo.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

async function readApiErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const body = await response.json().catch(() => ({}));
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error.trim()) {
    return body.error;
  }
  return fallbackMessage;
}

const LODICKY_HYDRATION_CACHE_TTL_MS = 15_000;
const lodickyHydrationRequests = new Map<
  string,
  { expiresAt: number; promise: Promise<LodickyCompactResponse> }
>();

function fetchLodickyCompact(requestUrl: string): Promise<LodickyCompactResponse> {
  const now = Date.now();
  const existing = lodickyHydrationRequests.get(requestUrl);
  if (existing && existing.expiresAt > now) return existing.promise;
  if (existing) lodickyHydrationRequests.delete(requestUrl);

  const request = fetch(requestUrl, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        const message = await readApiErrorMessage(response, "Nepodařilo se načíst osobní lodičky.");
        if (response.status === 401) throw new SessionExpiredError(message);
        throw new Error(message);
      }
      return (await response.json()) as LodickyCompactResponse;
    })
    .catch((error) => {
      lodickyHydrationRequests.delete(requestUrl);
      throw error;
    });
  lodickyHydrationRequests.set(requestUrl, {
    expiresAt: now + LODICKY_HYDRATION_CACHE_TTL_MS,
    promise: request,
  });
  return request;
}

const DEFAULT_ROLE: ProtoRoleId = "rodic";
const RIGHT_TABLE_LODICKY = "T321";
const RIGHT_TABLE_LIDE = "T322";

const STATUS_BUTTONS: Array<{ value: LodickaStav; label: string }> = [
  { value: 0, label: "0" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
];

const LODICKA_STAV_FILTER_OPTIONS: string[] = ([
  0,
  1,
  2,
  3,
  4,
] as LodickaStav[]).map((value) => TEST_LODICKA_STAV_LABEL[value]);

function isProtoRoleId(value: string | null): value is ProtoRoleId {
  return value === "garant" || value === "rodic" || value === "zak" || value === "spravce";
}

const SESSION_ROLE_TO_PROTO_ROLE: Record<string, ProtoRoleId> = {
  admin: "spravce",
  zamestnanec: "spravce",
  pruvodce: "garant",
  garant: "garant",
  rodic: "rodic",
  zak: "zak",
  tester: "spravce",
  proto: "spravce",
};

const WORK_VIEW_SESSION_ROLES = new Set(["garant", "pruvodce"]);

function getProtoRoleLabel(role: ProtoRoleId): string {
  return PROTO_ROLE_OPTIONS.find((option) => option.id === role)?.label ?? role;
}

function mapSessionRolesToProto(roles: string[], fallbackRole: string): ProtoRoleId[] {
  const mapped = new Set<ProtoRoleId>();
  roles.forEach((role) => {
    const next = SESSION_ROLE_TO_PROTO_ROLE[role];
    if (next) mapped.add(next);
  });
  const fallback = SESSION_ROLE_TO_PROTO_ROLE[fallbackRole];
  if (fallback) mapped.add(fallback);
  if (mapped.size === 0) mapped.add(DEFAULT_ROLE);
  return [...mapped];
}

function OsobniLodickyPrototypePageInner({
  adminToolsEnabled,
  sessionUser,
}: {
  adminToolsEnabled: boolean;
  sessionUser: SessionUserContext;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const queryRole = searchParams.get("role");
  const sessionRoleOptions = mapSessionRolesToProto(sessionUser.roles, sessionUser.role);
  const rawSessionRoles = useMemo(
    () => new Set([...sessionUser.roles, sessionUser.role]),
    [sessionUser.role, sessionUser.roles],
  );
  const sessionViewRoleOptions = useMemo(() => {
    const options: ProtoRoleId[] = [];
    if ([...WORK_VIEW_SESSION_ROLES].some((role) => rawSessionRoles.has(role))) options.push("garant");
    if (rawSessionRoles.has("rodic")) options.push("rodic");
    return options;
  }, [rawSessionRoles]);
  const effectiveSessionRoleOptions = sessionViewRoleOptions.length > 0 ? sessionViewRoleOptions : sessionRoleOptions;
  const preferredSessionRole: ProtoRoleId = effectiveSessionRoleOptions.includes("garant")
    ? "garant"
    : (effectiveSessionRoleOptions[0] ?? DEFAULT_ROLE);
  const queryRoleCandidate = isProtoRoleId(queryRole) ? queryRole : null;

  const todayIso = getTodayIsoForProto();
  const schoolYearBounds = getSchoolYearBounds(todayIso);
  const writableSemesterBounds = getSemesterBoundsForDate(todayIso);

  const initialRole: ProtoRoleId =
    queryRoleCandidate && effectiveSessionRoleOptions.includes(queryRoleCandidate)
      ? queryRoleCandidate
      : preferredSessionRole;
  const [activeRole, setActiveRole] = useState<ProtoRoleId>(initialRole);
  const queryUserId = adminToolsEnabled ? (searchParams.get("user") ?? "") : "";
  const [datasetVersion, setDatasetVersion] = useState(0);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbRefreshing, setDbRefreshing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [sessionActorId, setSessionActorId] = useState("");
  const [dbLoadProgress, setDbLoadProgress] = useState<{
    loaded: number;
    total: number;
    failed: number;
  } | null>(null);
  const initialRoleRef = useRef<ProtoRoleId>(initialRole);
  const initialQueryUserIdRef = useRef(queryUserId);
  const hasHydratedFromDbRef = useRef(false);
  const skipNextViewDateBlurRef = useRef(false);
  const usersForRoleRaw = useMemo(() => getActorsByRole(activeRole), [activeRole, datasetVersion]);

  const [selectedUserId, setSelectedUserId] = useState<string>(queryUserId);
  const activeUserId = useMemo(
    () =>
      usersForRoleRaw.some((item) => item.id === selectedUserId)
        ? selectedUserId
        : (usersForRoleRaw[0]?.id ?? ""),
    [selectedUserId, usersForRoleRaw],
  );

  const [scopeMode, setScopeMode] = useState<ScopeMode>("moje");
  const [viewMode, setViewMode] = useState<ViewMode>("po_lidech");
  const [viewDate, setViewDate] = useState<string>(todayIso);
  const [viewDateDraft, setViewDateDraft] = useState<string>(todayIso);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  const [peopleStupenFilter, setPeopleStupenFilter] = useState<string[]>([]);
  const [peopleRocnikFilter, setPeopleRocnikFilter] = useState<string[]>([]);
  const [peopleSmeckaFilter, setPeopleSmeckaFilter] = useState<string[]>([]);

  const [lodickyPredmetFilter, setLodickyPredmetFilter] = useState<string[]>([]);
  const [lodickyPodpredmetFilter, setLodickyPodpredmetFilter] = useState<string[]>([]);
  const [lodickyOblastFilter, setLodickyOblastFilter] = useState<string[]>([]);
  const [lodickyStavFilter, setLodickyStavFilter] = useState<string[]>([]);
  const [lodickyGarantFilter, setLodickyGarantFilter] = useState<string[]>([]);

  const [groupLodickyPredmet, setGroupLodickyPredmet] = useState(true);
  const [groupLodickyPodpredmet, setGroupLodickyPodpredmet] = useState(false);
  const [groupLodickyOblast, setGroupLodickyOblast] = useState(true);
  const [groupLodickyGarant, setGroupLodickyGarant] = useState(false);
  const [peopleGroupBy, setPeopleGroupBy] = useState<PeopleGroupKey>("smecka");

  const [searchInput, setSearchInput] = useState("");
  const [rightPaneSearchInput, setRightPaneSearchInput] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const leftSort: PaneSort = "nazev";
  const rightSort: PaneSort = "jmeno";

  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedPersonalId, setSelectedPersonalId] = useState<string | null>(null);
  const [detailSheet, setDetailSheet] = useState<DetailSheetState>({ type: "none" });

  const [events, setEvents] = useState<ProtoOsobniLodickaEvent[]>(PROTO_OSOBNI_LODICKA_EVENTS);
  const [invalidatedEventIds, setInvalidatedEventIds] = useState<string[]>([]);
  const [debugEvents, setDebugEvents] = useState<ProtoDebugEvent[]>([]);
  const [statusUndoActions, setStatusUndoActions] = useState<Record<string, StatusUndoAction>>({});
  const pushDebug = useCallback((event: Omit<ProtoDebugEvent, "id" | "at">) => {
    const debugEvent = createProtoDebugEvent(event);
    setDebugEvents((prev) => [debugEvent, ...prev].slice(0, 80));
    return debugEvent;
  }, []);

  const activeUser = usersForRoleRaw.find((item) => item.id === activeUserId) ?? usersForRoleRaw[0] ?? null;
  const effectiveWriterId = adminToolsEnabled ? activeUserId : (sessionActorId || activeUserId);
  const statusWriter =
    PROTO_ACTORS.find((actor) => actor.id === effectiveWriterId) ??
    activeUser ??
    null;
  const effectiveViewDate = clampDate(viewDate, schoolYearBounds.minDate, schoolYearBounds.maxDate);
  const hasHistoricalViewDate = effectiveViewDate !== todayIso;
  const effectiveScope: ScopeMode = activeRole === "garant" || activeRole === "spravce" ? scopeMode : "moje";
  const requestGarantId =
    adminToolsEnabled &&
    (activeRole === "garant" || activeRole === "spravce") &&
    effectiveScope === "moje" &&
    activeUserId
      ? activeUserId
      : "";
  const isReadonly = activeRole === "rodic" || activeRole === "zak";
  const isParentLayout = activeRole === "rodic";
  const effectiveViewMode: ViewMode = isParentLayout ? "po_lidech" : viewMode;
  const isViewDateWritableForGarant = isDateInRange(
    effectiveViewDate,
    writableSemesterBounds.minDate,
    writableSemesterBounds.maxDate,
  );
  const isReadonlyForDate = activeRole === "garant" && !isViewDateWritableForGarant;
  const effectiveReadonly = isReadonly || isReadonlyForDate;
  const showGarantControls = effectiveScope !== "moje";
  const pageTitle = `Pohled osobních lodiček - ${getProtoRoleLabel(activeRole)}`;
  const hasPendingViewDate = viewDateDraft !== effectiveViewDate;

  const commitViewDateDraft = useCallback(
    (nextValue: string) => {
      const clamped = clampDate(nextValue || effectiveViewDate, schoolYearBounds.minDate, schoolYearBounds.maxDate);
      setViewDateDraft(clamped);
      if (clamped === effectiveViewDate) return;
      setViewDate(clamped);
      pushDebug({
        elementId: "DATE-VIEW",
        label: "Datum pohledu",
        action: "change-date",
        hierarchy: "PERSONAL_LODICKY > TOP_BAR",
        payload: `date=${clamped}`,
      });
    },
    [effectiveViewDate, pushDebug, schoolYearBounds.maxDate, schoolYearBounds.minDate],
  );

  useEffect(() => {
    setViewDateDraft(effectiveViewDate);
  }, [effectiveViewDate]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const isInitialHydration = !hasHydratedFromDbRef.current;
    const abortHydration = () => {
      cancelled = true;
      controller.abort();
    };

    async function hydrateFromDb() {
      try {
        if (isInitialHydration) {
          setDbLoading(true);
        } else {
          setDbRefreshing(true);
        }
        setDbError(null);

        const commitDataset = (dataset: ProtoDatasetFromDb, resetUserSelection: boolean) => {
          if (cancelled) return;

          applyProtoDataset(dataset);
          setSessionActorId(dataset.parentActorId);

          if (resetUserSelection) {
            const nextRole: ProtoRoleId = initialRoleRef.current;
            const usersForNextRole = getActorsByRole(nextRole);
            const preferredQueryUserId = initialQueryUserIdRef.current;
            const nextUserId =
              (preferredQueryUserId &&
                usersForNextRole.some((item) => item.id === preferredQueryUserId) &&
                preferredQueryUserId) ||
              (usersForNextRole.some((item) => item.id === dataset.parentActorId) ? dataset.parentActorId : "") ||
              usersForNextRole[0]?.id ||
              dataset.parentActorId;

            setActiveRole(nextRole);
            setSelectedUserId(nextUserId);
            setInvalidatedEventIds([]);
            setStatusUndoActions({});
          }

          setEvents([...dataset.events]);
          setDatasetVersion((prev) => prev + 1);
        };

        const requestParams = new URLSearchParams();
        requestParams.set("role", activeRole);
        requestParams.set("scope", effectiveScope);
        requestParams.set("viewDate", effectiveViewDate);
        requestParams.set("includeHistory", hasHistoricalViewDate ? "1" : "0");
        requestParams.set("format", "compact");
        if (requestGarantId) {
          requestParams.set("garantId", requestGarantId);
        }

        const lodickyBody = await fetchLodickyCompact(`/api/m01/lodicky?${requestParams.toString()}`);
        const nextDataset = buildProtoDatasetFromCompact(lodickyBody);
        const shouldResetUserSelection = !hasHydratedFromDbRef.current;
        commitDataset(nextDataset, shouldResetUserSelection);
        hasHydratedFromDbRef.current = true;
        setDbLoadProgress(null);

        pushDebug({
          elementId: "API-M01-HYDRATE",
          label: "Hydratace proto UI z DB",
          action: "load",
          hierarchy: "OSOBNI_LODICKY > INIT",
          payload: `children=${lodickyBody.children.length}; rows=${nextDataset.lodickyRowsCount}; catalog=${lodickyBody.lodickyCatalog.length}; scope=${effectiveScope}; date=${effectiveViewDate}; history=${hasHistoricalViewDate ? "1" : "0"}`,
        });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof SessionExpiredError) {
          setDbError("Přihlášení vypršelo. Probíhá přesměrování na přihlášení.");
          const callbackUrl = `${window.location.pathname}${window.location.search}`;
          const loginUrl = `/auth/signin?reason=inactivity&callbackUrl=${encodeURIComponent(callbackUrl)}`;
          window.location.replace(loginUrl);
          return;
        }
        setDbError(error instanceof Error ? error.message : "Nepodařilo se načíst osobní lodičky.");
      } finally {
        if (!cancelled) {
          if (isInitialHydration) {
            setDbLoading(false);
          } else {
            setDbRefreshing(false);
          }
        }
      }
    }

    window.addEventListener("sv:signout-start", abortHydration);
    void hydrateFromDb();

    return () => {
      abortHydration();
      window.removeEventListener("sv:signout-start", abortHydration);
    };
  }, [activeRole, effectiveScope, effectiveViewDate, hasHistoricalViewDate, pushDebug, requestGarantId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (adminToolsEnabled) {
      if (!activeUserId) return;
      params.set("role", activeRole);
      params.set("user", activeUserId);
    } else {
      params.delete("user");
      if (effectiveSessionRoleOptions.length > 1) {
        params.set("role", activeRole);
      } else {
        params.delete("role");
      }
    }
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [activeRole, activeUserId, adminToolsEnabled, effectiveSessionRoleOptions.length, pathname]);

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
      stavy: LODICKA_STAV_FILTER_OPTIONS,
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
        stupne: isParentLayout ? [] : filterOptions.stupne,
        rocniky: isParentLayout ? [] : filterOptions.rocniky,
        smecky: isParentLayout ? [] : filterOptions.smecky,
        predmety: filterOptions.predmety,
        podpredmety: filterOptions.podpredmety,
        oblasti: filterOptions.oblasti,
        stavy: filterOptions.stavy,
        garanti: showGarantControls ? filterOptions.garanti : [],
        studentHaystacks: accessibleStudents.map((student) => buildStudentSearchHaystack(student)),
      }),
    [accessibleStudents, filterOptions, isParentLayout, searchInput, showGarantControls],
  );

  const getRocnikyForStupne = useCallback((stupne: string[]) => {
    const rocniky = new Set<string>();
    if (stupne.includes("1")) {
      ["1", "2", "3", "4", "5"].forEach((rocnik) => rocniky.add(rocnik));
    }
    if (stupne.includes("2")) {
      ["6", "7", "8", "9"].forEach((rocnik) => rocniky.add(rocnik));
    }
    return rocniky;
  }, []);

  const handlePeopleStupenFilterChange = useCallback(
    (nextStupne: string[]) => {
      const previousManagedRocniky = getRocnikyForStupne(peopleStupenFilter);
      const nextManagedRocniky = getRocnikyForStupne(nextStupne);
      setPeopleStupenFilter(nextStupne);
      setPeopleRocnikFilter((prev) => {
        const manualRocniky = prev.filter((rocnik) => !previousManagedRocniky.has(rocnik));
        return uniqueValues([...manualRocniky, ...nextManagedRocniky]);
      });
    },
    [getRocnikyForStupne, peopleStupenFilter],
  );

  const effectivePeopleStupenFilter = useMemo(
    () => (isParentLayout ? [] : uniqueValues([...peopleStupenFilter, ...searchPlan.people.stupen])),
    [isParentLayout, peopleStupenFilter, searchPlan.people.stupen],
  );
  const effectivePeopleRocnikFilter = useMemo(
    () => (isParentLayout ? [] : uniqueValues([...peopleRocnikFilter, ...searchPlan.people.rocnik])),
    [isParentLayout, peopleRocnikFilter, searchPlan.people.rocnik],
  );
  const effectivePeopleSmeckaFilter = useMemo(
    () => (isParentLayout ? [] : uniqueValues([...peopleSmeckaFilter, ...searchPlan.people.smecka])),
    [isParentLayout, peopleSmeckaFilter, searchPlan.people.smecka],
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
  const effectiveLodickyStavFilter = useMemo(
    () => uniqueValues([...lodickyStavFilter, ...searchPlan.lodicky.stav]),
    [lodickyStavFilter, searchPlan.lodicky.stav],
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
    datasetVersion,
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

  const searchSuggestionRows = useMemo(() => {
    const allowedStudentIds = new Set(
      accessibleStudents
        .filter((student) => {
          if (isParentLayout) return true;
          if (peopleStupenFilter.length > 0 && !peopleStupenFilter.includes(String(student.stupen))) return false;
          if (peopleRocnikFilter.length > 0 && !peopleRocnikFilter.includes(String(student.rocnik))) return false;
          if (peopleSmeckaFilter.length > 0 && !peopleSmeckaFilter.includes(student.smecka)) return false;
          return true;
        })
        .map((student) => student.id),
    );
    const allowedLodickaIds = new Set(
      PROTO_LODICKY_CATALOG.filter((lodicka) => {
        if (effectiveScope === "moje" && activeRole === "garant" && activeUserId) {
          if (lodicka.garantId !== activeUserId) return false;
        }
        if (lodickyPredmetFilter.length > 0 && !lodickyPredmetFilter.includes(lodicka.predmet)) return false;
        if (lodickyPodpredmetFilter.length > 0 && !lodickyPodpredmetFilter.includes(lodicka.podpředmět ?? "-")) {
          return false;
        }
        if (lodickyOblastFilter.length > 0 && !lodickyOblastFilter.includes(lodicka.oblast)) return false;
        if (
          showGarantControls &&
          lodickyGarantFilter.length > 0 &&
          !lodickyGarantFilter.includes(getGuideDisplayName(lodicka.garantId))
        ) {
          return false;
        }
        return true;
      }).map((lodicka) => lodicka.id),
    );
    const rows: PersonalWithSnapshot[] = [];

    PROTO_OSOBNI_LODICKY.forEach((personal) => {
      if (!allowedStudentIds.has(personal.studentId)) return;
      if (!allowedLodickaIds.has(personal.lodickaId)) return;

      const student = studentsById.get(personal.studentId);
      const lodicka = lodickyById.get(personal.lodickaId);
      if (!student || !lodicka) return;

      const snapshot = statusSnapshotByPersonal.get(personal.id);
      const stav = snapshot?.stav ?? 0;
      if (lodickyStavFilter.length > 0 && !lodickyStavFilter.includes(TEST_LODICKA_STAV_LABEL[stav])) return;

      rows.push({
        personal,
        student,
        lodicka,
        stav,
        lastEvent: snapshot?.lastEvent ?? null,
      });
    });

    return rows;
  }, [
    accessibleStudents,
    activeRole,
    activeUserId,
    datasetVersion,
    effectiveScope,
    isParentLayout,
    lodickyById,
    lodickyGarantFilter,
    lodickyOblastFilter,
    lodickyPodpredmetFilter,
    lodickyPredmetFilter,
    lodickyStavFilter,
    peopleRocnikFilter,
    peopleSmeckaFilter,
    peopleStupenFilter,
    showGarantControls,
    statusSnapshotByPersonal,
    studentsById,
  ]);

  const searchSuggestionStudents = useMemo(() => {
    const map = new Map<string, ProtoStudent>();
    searchSuggestionRows.forEach((row) => {
      map.set(row.student.id, row.student);
    });
    return [...map.values()];
  }, [searchSuggestionRows]);

  const searchSuggestionLodicky = useMemo(() => {
    const map = new Map<string, ProtoLodickaCatalogItem>();
    searchSuggestionRows.forEach((row) => {
      map.set(row.lodicka.id, row.lodicka);
    });
    return [...map.values()];
  }, [searchSuggestionRows]);

  const personalRows = useMemo(() => {
    const rows: PersonalWithSnapshot[] = [];

    PROTO_OSOBNI_LODICKY.forEach((personal) => {
      if (!filteredStudentIds.has(personal.studentId)) return;
      if (!filteredLodickaIds.has(personal.lodickaId)) return;

      const student = studentsById.get(personal.studentId);
      const lodicka = lodickyById.get(personal.lodickaId);
      if (!student || !lodicka) return;

      const snapshot = statusSnapshotByPersonal.get(personal.id);
      const stav = snapshot?.stav ?? 0;
      if (effectiveLodickyStavFilter.length > 0 && !effectiveLodickyStavFilter.includes(TEST_LODICKA_STAV_LABEL[stav])) {
        return;
      }
      rows.push({
        personal,
        student,
        lodicka,
        stav,
        lastEvent: snapshot?.lastEvent ?? null,
      });
    });

    return rows;
  }, [
    effectiveLodickyStavFilter,
    filteredLodickaIds,
    filteredStudentIds,
    lodickyById,
    statusSnapshotByPersonal,
    studentsById,
  ]);

  const leftItems = useMemo(() => {
    if (effectiveViewMode === "po_lodickach") {
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

      return sortLeftItems(items, leftSort, effectiveViewMode, activeRole) as LeftItem[];
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

    return sortLeftItems(items, leftSort, effectiveViewMode, activeRole) as LeftItem[];
  }, [activeRole, effectiveViewMode, filteredLodicky, filteredStudents, leftSort, personalRows]);

  const selectedLeftIdEffective = useMemo(() => {
    const ids = leftItems.map((item) => (item.kind === "lodicka" ? item.lodicka.id : item.student.id));
    if (ids.length === 0) return null;
    if (selectedLeftId && ids.includes(selectedLeftId)) return selectedLeftId;
    return ids[0];
  }, [leftItems, selectedLeftId]);

  const selectedLeftLabel = useMemo(() => {
    if (!selectedLeftIdEffective) return "";
    const item = leftItems.find((entry) =>
      entry.kind === "lodicka"
        ? entry.lodicka.id === selectedLeftIdEffective
        : entry.student.id === selectedLeftIdEffective,
    );
    if (!item) return "";
    return item.kind === "lodicka" ? item.lodicka.nazev : getStudentDisplayName(item.student, activeRole);
  }, [activeRole, leftItems, selectedLeftIdEffective]);

  const rightRows = useMemo(() => {
    if (!selectedLeftIdEffective) return [] as PersonalWithSnapshot[];
    const result =
      effectiveViewMode === "po_lodickach"
        ? personalRows.filter((row) => row.lodicka.id === selectedLeftIdEffective)
        : personalRows.filter((row) => row.student.id === selectedLeftIdEffective);
    return sortRightRows(result, rightSort, effectiveViewMode, activeRole);
  }, [activeRole, effectiveViewMode, personalRows, rightSort, selectedLeftIdEffective]);

  const visibleRightRows = useMemo(() => {
    const tokens = tokenizeSearch(rightPaneSearchInput);
    if (tokens.length === 0) return rightRows;
    return rightRows.filter((row) =>
      tokens.every((token) => buildRightPaneSearchHaystack(row, effectiveViewMode, activeRole).includes(token)),
    );
  }, [activeRole, effectiveViewMode, rightPaneSearchInput, rightRows]);

  const selectedParentStudent = useMemo(() => {
    if (!isParentLayout || !selectedLeftIdEffective) return null;
    return studentsById.get(selectedLeftIdEffective) ?? null;
  }, [isParentLayout, selectedLeftIdEffective, studentsById]);

  const selectedPersonalEffective = useMemo(() => {
    if (visibleRightRows.length === 0) return null;
    if (selectedPersonalId && visibleRightRows.some((row) => row.personal.id === selectedPersonalId)) {
      return selectedPersonalId;
    }
    return visibleRightRows[0]?.personal.id ?? null;
  }, [selectedPersonalId, visibleRightRows]);

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
    const filterSuggestions: SearchSuggestion[] = [];
    const entitySuggestions: SearchSuggestion[] = [];
    const seen = new Set<string>();
    const tokens = tokenizeSearch(searchInput);

    const filterMatchers: Array<{
      type: SearchSuggestion["type"];
      label: string;
      options: string[];
    }> = [
      ...(!isParentLayout
        ? [
            { type: "smecka" as const, label: "Smečka", options: filterOptions.smecky },
            { type: "rocnik" as const, label: "Ročník", options: filterOptions.rocniky },
            { type: "stupen" as const, label: "Stupeň", options: filterOptions.stupne },
          ]
        : []),
      { type: "predmet", label: "Předmět", options: filterOptions.predmety },
      { type: "podpredmet", label: "Podpředmět", options: filterOptions.podpredmety },
      { type: "oblast", label: "Oblast", options: filterOptions.oblasti },
      { type: "stav", label: "Stav lodičky", options: filterOptions.stavy },
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
            filterSuggestions.push({
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
    const studentSuggestions: SearchSuggestion[] = [];
    const lodickaSuggestions: SearchSuggestion[] = [];

    searchSuggestionStudents
      .map((student) => ({ student, score: scoreStudentSuggestion(student, queryNeedle) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.student.jmeno.localeCompare(b.student.jmeno, "cs"))
      .slice(0, 5)
      .forEach(({ student }) => {
        const display = getStudentDisplayName(student, activeRole);
        const id = `student-${student.id}`;
        if (seen.has(id)) return;
        seen.add(id);
        studentSuggestions.push({ id, label: `Dítě: ${display}`, type: "student", value: display });
      });

    searchSuggestionLodicky
      .map((lodicka) => ({ lodicka, score: scoreLodickaSuggestion(lodicka, queryNeedle) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.lodicka.nazev.localeCompare(b.lodicka.nazev, "cs"))
      .slice(0, 8)
      .forEach(({ lodicka }) => {
        const id = `lodicka-${lodicka.id}`;
        if (seen.has(id)) return;
        seen.add(id);
        lodickaSuggestions.push({ id, label: `Lodička: ${lodicka.nazev}`, type: "lodicka", value: lodicka.nazev });
      });

    entitySuggestions.push(...studentSuggestions, ...lodickaSuggestions);

    return [...entitySuggestions, ...filterSuggestions].slice(0, 10);
  }, [
    activeRole,
    filterOptions,
    isParentLayout,
    searchInput,
    searchSuggestionLodicky,
    searchSuggestionStudents,
    showGarantControls,
  ]);

  const options = filterOptions;

  const leftTableId = effectiveViewMode === "po_lodickach" ? "T221" : "T222";
  const rightTableId = effectiveViewMode === "po_lodickach" ? RIGHT_TABLE_LODICKY : RIGHT_TABLE_LIDE;

  function handleSessionRoleChange(nextRole: ProtoRoleId) {
    if (!effectiveSessionRoleOptions.includes(nextRole)) return;
    const usersForNextRole = getActorsByRole(nextRole);
    const nextUserId = usersForNextRole.some((item) => item.id === activeUserId)
      ? activeUserId
      : (usersForNextRole[0]?.id ?? "");
    setActiveRole(nextRole);
    setSelectedUserId(nextUserId);

    pushDebug({
      elementId: "HDR-ROLE",
      label: "Přepnutí role uživatele",
      action: "switch-session-role",
      hierarchy: "OSOBNI_LODICKY > HEADER",
      payload: `role=${nextRole}; user=${nextUserId || "-"}`,
    });
  }

  function handleAdminRoleChange(nextRole: ProtoRoleId) {
    if (!adminToolsEnabled) return;
    const usersForNextRole = getActorsByRole(nextRole);
    const nextUserId = usersForNextRole[0]?.id ?? "";
    setActiveRole(nextRole);
    setSelectedUserId(nextUserId);

    pushDebug({
      elementId: "TOOLS-ROLE",
      label: "Nástroje: změna role",
      action: "tools-change-role",
      hierarchy: "OSOBNI_LODICKY > TOOLS",
      payload: `role=${nextRole}; user=${nextUserId || "-"}`,
    });
  }

  function handleAdminUserChange(nextUserId: string) {
    if (!adminToolsEnabled) return;
    setSelectedUserId(nextUserId);

    pushDebug({
      elementId: "TOOLS-USER",
      label: "Nástroje: změna uživatele",
      action: "tools-change-user",
      hierarchy: "OSOBNI_LODICKY > TOOLS",
      payload: `role=${activeRole}; user=${nextUserId || "-"}`,
    });
  }

  function clearAllFilters() {
    setPeopleStupenFilter([]);
    setPeopleRocnikFilter([]);
    setPeopleSmeckaFilter([]);
    setLodickyPredmetFilter([]);
    setLodickyPodpredmetFilter([]);
    setLodickyOblastFilter([]);
    setLodickyStavFilter([]);
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
    } else if (suggestion.type === "stav") {
      setLodickyStavFilter((prev) => (prev.includes(suggestion.value) ? prev : [...prev, suggestion.value]));
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

  function canWriteStatusForRow(row: PersonalWithSnapshot): boolean {
    if (effectiveReadonly) return false;
    if (activeRole !== "garant") return false;
    return Boolean(effectiveWriterId && row.lodicka.garantId === effectiveWriterId);
  }

  function updateStatus(personalId: string, nextStatus: LodickaStav) {
    if (effectiveReadonly || !statusWriter) return;

    const targetRow = personalRows.find((row) => row.personal.id === personalId);
    if (!targetRow || !canWriteStatusForRow(targetRow)) return;

    const activeEvents = [...(eventsByPersonalActive.get(personalId) ?? [])];
    const previousStatus = statusSnapshotByPersonal.get(personalId)?.stav ?? 0;
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
      zapsalId: statusWriter.id,
      poznamka: "Prototyp: ruční změna stavu.",
    };

    const toInvalidate = [
      ...sameDateEvents.map((event) => event.id),
      ...(invalidateNewer ? newerEvents.map((event) => event.id) : []),
    ];
    const newlyInvalidatedIds = toInvalidate.filter((id) => !invalidatedEventIdSet.has(id));
    if (newlyInvalidatedIds.length > 0) {
      setInvalidatedEventIds((prev) => uniqueValues([...prev, ...newlyInvalidatedIds]));
    }

    setEvents((prev) => [...prev, event]);
    setSelectedPersonalId(personalId);

    const undoActionId = adminToolsEnabled ? `status:${event.id}` : undefined;
    const debugEvent = pushDebug({
      elementId: `BTN-S${nextStatus}-${personalId}`,
      label: "Změna stavu osobní lodičky",
      action: "set-status",
      tableId: effectiveViewMode === "po_lodickach" ? RIGHT_TABLE_LODICKY : RIGHT_TABLE_LIDE,
      rowId: personalId,
      hierarchy: "PERSONAL_LODICKY > RIGHT_PANE > STATUS_BUTTONS",
      payload: `from=${previousStatus}; to=${nextStatus}; datum=${effectiveViewDate}; overwriteSameDate=${sameDateEvents.length > 0}; invalidateNewer=${invalidateNewer}`,
      undoActionId,
    });

    if (adminToolsEnabled && undoActionId) {
      setStatusUndoActions((prev) => ({
        ...prev,
        [undoActionId]: {
          actionId: undoActionId,
          personalId,
          createdEventId: event.id,
          createdStatus: nextStatus,
          previousStatus,
          newlyInvalidatedIds,
        },
      }));
      pushDebug({
        elementId: `ADMIN-STATUS-${debugEvent.id}`,
        label: "Admin audit: změna stavu",
        action: "admin-status-change",
        tableId: effectiveViewMode === "po_lodickach" ? RIGHT_TABLE_LODICKY : RIGHT_TABLE_LIDE,
        rowId: personalId,
        hierarchy: "OSOBNI_LODICKY > ADMIN_AUDIT",
        payload: `undo=${undoActionId}; from=${previousStatus}; to=${nextStatus}`,
      });
    }
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

  const canUndoDebugAction = useCallback(
    (undoActionId: string) => Boolean(statusUndoActions[undoActionId]),
    [statusUndoActions],
  );

  const undoDebugAction = useCallback(
    (undoActionId: string) => {
      if (!adminToolsEnabled) return;
      const action = statusUndoActions[undoActionId];
      if (!action) return;

      const invalidatedSet = new Set(action.newlyInvalidatedIds);
      setEvents((prev) => prev.filter((event) => event.id !== action.createdEventId));
      if (invalidatedSet.size > 0) {
        setInvalidatedEventIds((prev) => prev.filter((id) => !invalidatedSet.has(id)));
      }
      setSelectedPersonalId(action.personalId);
      setStatusUndoActions((prev) => {
        const next = { ...prev };
        delete next[undoActionId];
        return next;
      });

      pushDebug({
        elementId: `UNDO-${action.createdEventId}`,
        label: "Vzetí zpět změny stavu",
        action: "undo-set-status",
        tableId: effectiveViewMode === "po_lodickach" ? RIGHT_TABLE_LODICKY : RIGHT_TABLE_LIDE,
        rowId: action.personalId,
        hierarchy: "OSOBNI_LODICKY > ADMIN_AUDIT",
        payload: `undo=${undoActionId}; from=${action.createdStatus}; to=${action.previousStatus}`,
      });
    },
    [adminToolsEnabled, effectiveViewMode, pushDebug, statusUndoActions],
  );

  const leftRows = renderLeftPaneRows({
    viewMode: effectiveViewMode,
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
    rows: visibleRightRows,
    selectedPersonalId: selectedPersonalEffective,
    viewMode: effectiveViewMode,
    tableId: rightTableId,
    canWriteStatusForRow,
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
    onOpenPersonalDetail: openPersonalDetail,
    onOpenLodickaDetail: openLodickaDetail,
    onOpenStudentDetail: openStudentDetail,
  });

  if (dbError && !hasHydratedFromDbRef.current) {
    return (
      <main className="min-h-screen bg-[#EEF2F7]">
        <section className="app-page-container py-6">
          <div className="rounded-md border border-[#C8372D]/30 bg-[#FAEAE9] p-4 text-sm text-[#A42A22]">
            {dbError}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#EEF2F7] pb-44">
      <section className="app-page-container space-y-4 py-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="sv-eyebrow text-[#C8372D]">Osobní lodičky</p>
              <h1 className="sv-display-md text-[#0E2A5C]">{pageTitle}</h1>
            </div>

            {(Boolean(dbLoadProgress && dbLoadProgress.loaded < dbLoadProgress.total) ||
              effectiveSessionRoleOptions.length > 1) && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {dbLoadProgress && dbLoadProgress.loaded < dbLoadProgress.total && (
                <Badge className="bg-[#FFF7E8] text-[#8A5A00] hover:bg-[#FFF7E8]">
                  Načítám detailní data: {dbLoadProgress.loaded}/{dbLoadProgress.total}
                  {dbLoadProgress.failed > 0 ? `, chyb ${dbLoadProgress.failed}` : ""}
                </Badge>
              )}

              {effectiveSessionRoleOptions.length > 1 && (
                <div className="inline-flex rounded-xl border border-[#D6DFF0] bg-white p-1">
                  {effectiveSessionRoleOptions.map((roleId) => (
                    <button
                      key={roleId}
                      type="button"
                      onClick={() => handleSessionRoleChange(roleId)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                        activeRole === roleId ? "bg-[#0E2A5C] text-white" : "text-slate-600 hover:bg-[#EEF2F7]"
                      }`}
                    >
                      {getProtoRoleLabel(roleId)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>
        </header>

        {adminToolsEnabled && (
          <Card className="border-[#D6DFF0]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-[#0E2A5C]">Nástroje</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#D6DFF0]"
                  onClick={() => setToolsOpen((prev) => !prev)}
                >
                  {toolsOpen ? "Skrýt nástroje" : "Zobrazit nástroje"}
                </Button>
              </div>
            </CardHeader>

            {toolsOpen && (
              <CardContent className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                    Role
                  </span>
                  <select
                    value={activeRole}
                    onChange={(event) => {
                      const nextRole = event.target.value;
                      if (!isProtoRoleId(nextRole)) return;
                      handleAdminRoleChange(nextRole);
                    }}
                    className="h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
                  >
                    {PROTO_ROLE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                    Uživatel
                  </span>
                  <select
                    value={activeUserId}
                    onChange={(event) => handleAdminUserChange(event.target.value)}
                    className="h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
                  >
                    {usersForRoleRaw.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.jmeno}
                      </option>
                    ))}
                  </select>
                </label>
              </CardContent>
            )}
          </Card>
        )}

        {dbError && (
          <div className="rounded-md border border-[#C8372D]/30 bg-[#FAEAE9] p-3 text-sm text-[#A42A22]">
            {dbError}
          </div>
        )}

        <Card className="border-[#D6DFF0]">
          <CardContent className="space-y-3 p-3 sm:p-4">
              <div className="grid gap-2 min-[900px]:grid-cols-[minmax(320px,0.8fr)_280px_auto_auto]">
                <div className="relative">
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-[#D6DFF0] bg-white px-3">
                    <Search className="size-4 shrink-0 text-[#1E3F7A]" />
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
                      placeholder="Vyhledat lodičku, oblast, předmět nebo dítě"
                      className="min-w-0 flex-1 text-sm text-slate-700 outline-none"
                    />
                    {searchInput.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchInput("");
                          setSuggestionsOpen(false);
                        }}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Vymazat vyhledávání"
                        title="Vymazat vyhledávání"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                    <Badge className="hidden bg-[#EEF2F7] text-[#1E3F7A] hover:bg-[#EEF2F7] sm:inline-flex">
                      <Filter className="mr-1 size-3.5" />
                      fulltext
                    </Badge>
                  </div>

                  {suggestionsOpen && suggestions.length > 0 && (
                    <div className="absolute top-[calc(100%+6px)] z-20 w-full rounded-xl border border-[#D6DFF0] bg-white p-1 shadow-xl">
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

                <label className="block">
                  <span className="sr-only">Datum pohledu</span>
                  <div
                    className={`flex h-10 items-center gap-2 rounded-xl border px-3 ${
                      hasHistoricalViewDate ? "border-[#C8372D] bg-[#FAEAE9]" : "border-[#D6DFF0] bg-[#EEF2F7]"
                    }`}
                  >
                    <CalendarDays className={`size-4 shrink-0 ${hasHistoricalViewDate ? "text-[#C8372D]" : "text-[#1E3F7A]"}`} />
                    <input
                      type="date"
                      min={schoolYearBounds.minDate}
                      max={schoolYearBounds.maxDate}
                      value={viewDateDraft}
                      onChange={(e) => {
                        setViewDateDraft(e.target.value);
                      }}
                      onBlur={() => {
                        if (skipNextViewDateBlurRef.current) {
                          skipNextViewDateBlurRef.current = false;
                          return;
                        }
                        commitViewDateDraft(viewDateDraft);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          skipNextViewDateBlurRef.current = true;
                          commitViewDateDraft(e.currentTarget.value);
                          e.currentTarget.blur();
                        }
                        if (e.key === "Escape") {
                          skipNextViewDateBlurRef.current = true;
                          setViewDateDraft(effectiveViewDate);
                          e.currentTarget.blur();
                        }
                      }}
                      className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
                        hasHistoricalViewDate ? "text-[#B42318]" : "text-slate-700"
                      }`}
                    />
                    {hasPendingViewDate && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="h-7 shrink-0 border-[#D6DFF0] px-2 text-xs font-semibold text-[#0E2A5C]"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => commitViewDateDraft(viewDateDraft)}
                      >
                        Použít
                      </Button>
                    )}
                  </div>
                  {isReadonlyForDate && (
                    <span className="mt-2 block text-[11px] font-medium text-[#B42318]">
                      Datum je mimo aktuální pololetí. Není možné zapisovat změny.
                    </span>
                  )}
                </label>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 border-[#D6DFF0] px-3"
                  onClick={clearAllFilters}
                >
                  Vymazat filtry
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 border-[#D6DFF0] px-3"
                  onClick={() => setFiltersCollapsed((prev) => !prev)}
                >
                  {filtersCollapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                  Filtry
                </Button>
              </div>

              {!filtersCollapsed && (
              <div className="space-y-3 border-t border-[#E3ECF9] pt-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-semibold text-[#0E2A5C]">Nastavení a filtry</p>
                </div>

              <div
                className={
                  isParentLayout
                    ? "grid gap-4"
                    : "grid gap-4 min-[1180px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
                }
              >
                <div className="grid content-start gap-4">
                  {(!isParentLayout || accessibleStudents.length > 1) && (
                    <Card className="border-[#E3ECF9]">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-[#0E2A5C]">Zobrazení</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3">
                        {!isParentLayout && (
                          <SegmentControl
                            label="Základní volba"
                            options={[
                              { id: "moje", label: "Moje lodičky" },
                              { id: "vsechny", label: "Všechny lodičky" },
                            ]}
                            value={effectiveScope}
                            onChange={(value) => {
                              if (activeRole === "zak") return;
                              setScopeMode(value as ScopeMode);
                              pushDebug({
                                elementId: "SEG-SCOPE",
                                label: "Přepnutí rozsahu",
                                action: "change-scope",
                                hierarchy: "PERSONAL_LODICKY > TOP_BAR",
                                payload: `scope=${value}`,
                              });
                            }}
                            disabled={activeRole === "zak"}
                          />
                        )}

                        {!isParentLayout && (
                          <SegmentControl
                            label="Pohled"
                            options={[
                              { id: "po_lidech", label: "Po dětech" },
                              { id: "po_lodickach", label: "Po lodičkách" },
                            ]}
                            value={viewMode}
                            onChange={(value) => {
                              setViewMode(value as ViewMode);
                              setSelectedLeftId(null);
                              setSelectedPersonalId(null);
                            pushDebug({
                                elementId: "SEG-VIEW",
                                label: "Přepnutí režimu zobrazení",
                                action: "change-view",
                                hierarchy: "PERSONAL_LODICKY > TOP_BAR",
                                payload: `view=${value}`,
                              });
                            }}
                          />
                        )}

                        {isParentLayout && accessibleStudents.length > 1 && (
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                              Dítě
                            </span>
                            <select
                              value={selectedLeftIdEffective ?? ""}
                              onChange={(event) => {
                                setSelectedLeftId(event.target.value);
                                setSelectedPersonalId(null);
                                pushDebug({
                                  elementId: "SELECT-PARENT-CHILD",
                                  label: "Přepnutí dítěte rodiče",
                                  action: "change-parent-child",
                                  hierarchy: "PERSONAL_LODICKY > TOP_BAR",
                                  payload: `student=${event.target.value}`,
                                });
                              }}
                              className="h-10 w-full rounded-xl border border-[#D6DFF0] bg-[#EEF2F7] px-3 text-sm font-semibold text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
                            >
                              {accessibleStudents.map((student) => (
                                <option key={student.id} value={student.id}>
                                  {getStudentDisplayName(student, activeRole)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </CardContent>
                    </Card>
                  )}

                {!isParentLayout && (
                  <Card className="border-[#E3ECF9]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-[#0E2A5C]">Filtry po dětech</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <MultiToggleSelect
                        label="Stupeň"
                        options={options.stupne}
                        value={effectivePeopleStupenFilter}
                        onChange={handlePeopleStupenFilterChange}
                        renderOptionLabel={(option) => `${option}. stupeň`}
                      />
                      <MultiToggleSelect
                        label="Ročník"
                        options={uniqueValues([...options.rocniky, ...effectivePeopleRocnikFilter]).sort(
                          (a, b) => Number(a) - Number(b),
                        )}
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
                )}
                </div>

                <Card className="border-[#E3ECF9]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#0E2A5C]">Filtry po lodičkách</CardTitle>
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
                    <MultiToggleSelect
                      label="Stav lodičky"
                      options={options.stavy}
                      value={effectiveLodickyStavFilter}
                      onChange={setLodickyStavFilter}
                    />
                    {showGarantControls && (
                      <MultiToggleSelect
                        label="Garant"
                        options={options.garanti}
                        value={effectiveLodickyGarantFilter}
                        onChange={setLodickyGarantFilter}
                      />
                    )}
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-normal text-slate-500">Seskupování</p>
                      <div className="flex flex-wrap gap-2 rounded-xl border border-[#D6DFF0] bg-[#EEF2F7] p-2.5">
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
              </div>
              )}
            </CardContent>
        </Card>

        {!dbLoading && (
          <section
            className={
              isParentLayout
                ? "grid gap-4 min-[1180px]:items-start"
                : "grid gap-4 min-[1180px]:items-start min-[1180px]:grid-cols-[minmax(280px,0.38fr)_minmax(0,0.62fr)]"
            }
          >
          {!isParentLayout && (
            <Card className="min-w-0 border-[#D6DFF0]">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-[#0E2A5C]">
                      {effectiveViewMode === "po_lodickach" ? "Lodičky" : "Děti"}
                    </CardTitle>
                    <p className="mt-1 text-xs text-slate-500">
                      Celkem: {leftItems.length} {effectiveViewMode === "po_lodickach" ? "lodiček" : "dětí"}
                    </p>
                  </div>
                  {effectiveViewMode === "po_lidech" && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
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
                    </div>
                  )}
                </div>
              </CardHeader>
              {selectedLeftLabel && (
                <div
                  aria-live="polite"
                  className="fixed bottom-5 left-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-[#BFD0EA] bg-[#EEF4FF]/95 px-3 py-2 text-sm text-[#0E2A5C] shadow-lg backdrop-blur sm:left-6 min-[1180px]:left-10"
                >
                  <span className="text-xs font-semibold uppercase tracking-normal text-[#4A5A7C]">Vybráno</span>
                  <div className="mt-0.5 truncate font-semibold">{selectedLeftLabel}</div>
                </div>
              )}
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {effectiveViewMode === "po_lodickach" ? (
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
                        <TableCell
                          colSpan={showGarantControls && effectiveViewMode === "po_lodickach" ? 3 : 2}
                          className="py-8 text-center text-slate-500"
                        >
                          Žádná data pro zvolený filtr.
                        </TableCell>
                      </TableRow>
                    )}
                    {leftRows}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card className="min-w-0 border-[#D6DFF0]">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-[#0E2A5C]">
                    {effectiveViewMode === "po_lodickach"
                      ? "Děti pro vybranou lodičku"
                      : selectedParentStudent
                        ? `Lodičky dítěte ${getStudentDisplayName(selectedParentStudent, activeRole)}`
                        : "Lodičky vybraného dítěte"}
                  </CardTitle>
                  <p className="mt-1 text-xs text-slate-500">
                    Celkem: {visibleRightRows.length}
                    {rightPaneSearchInput.trim().length > 0 && ` z ${rightRows.length}`}{" "}
                    {effectiveViewMode === "po_lodickach" ? "dětí" : "lodiček"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="flex min-w-[220px] max-w-full items-center gap-2 rounded-xl border border-[#D6DFF0] bg-white px-3 py-2 min-[1180px]:w-[360px]">
                    <Search className="size-4 shrink-0 text-[#1E3F7A]" />
                    <input
                      value={rightPaneSearchInput}
                      onChange={(e) => setRightPaneSearchInput(e.target.value)}
                      placeholder={effectiveViewMode === "po_lodickach" ? "Hledat dítě" : "Hledat lodičku"}
                      className="min-w-0 flex-1 text-sm text-slate-700 outline-none"
                    />
                    {rightPaneSearchInput.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRightPaneSearchInput("")}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Vymazat hledání v pravém panelu"
                        title="Vymazat hledání v pravém panelu"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                  {effectiveViewMode === "po_lodickach" && (
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
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{effectiveViewMode === "po_lodickach" ? "Dítě" : "Lodička"}</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead className="text-right">{isParentLayout ? "Stav" : "Změna"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rightRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-slate-500">
                        {isParentLayout
                          ? "Pro vybrané dítě nejsou v aktuálním filtru žádné lodičky."
                          : "Pravý panel je prázdný. Vyber vlevo řádek nebo uprav filtr."}
                      </TableCell>
                    </TableRow>
                  )}
                  {rightRows.length > 0 && visibleRightRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-slate-500">
                        Nic neodpovídá hledání v pravém panelu.
                      </TableCell>
                    </TableRow>
                  )}
                  {rightRowsRendered}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          </section>
        )}
      </section>

      {(dbLoading || dbRefreshing) && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#EEF2F7]/80 px-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label={dbLoading ? "Načítám osobní lodičky" : "Přenačítám osobní lodičky"}
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#D6DFF0] bg-white/95 px-6 py-4 shadow-xl">
            <SailboatLoading className="py-6" message={dbLoading ? "Načítám osobní lodičky…" : "Přenačítám osobní lodičky…"} />
          </div>
        </div>
      )}

      <DetailSheet
        state={detailSheet}
        eventsByPersonal={eventsByPersonalAll}
        activeRole={activeRole}
        onClose={() => setDetailSheet({ type: "none" })}
      />

      {adminToolsEnabled && (
        <ProtoDebugPanel
          events={debugEvents}
          onClear={() => {
            setDebugEvents([]);
            setStatusUndoActions({});
          }}
          onUndoAction={undoDebugAction}
          canUndoAction={canUndoDebugAction}
        />
      )}
    </main>
  );
}

export default function OsobniLodickyPrototypePage({
  adminToolsEnabled = false,
  sessionUser,
}: {
  adminToolsEnabled?: boolean;
  sessionUser: SessionUserContext;
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#EEF2F7]">
          <section className="app-page-container py-6">
            <SailboatLoading message="Načítám osobní lodičky…" />
          </section>
        </main>
      }
    >
      <OsobniLodickyPrototypePageInner adminToolsEnabled={adminToolsEnabled} sessionUser={sessionUser} />
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
      ? "max-w-[460px]"
      : state.type === "personal"
        ? "max-w-[920px]"
        : "max-w-[620px]";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#07173A]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`relative max-h-[90vh] w-full ${detailWidthClass} overflow-y-auto rounded-xl border border-[#D6DFF0] bg-white shadow-[var(--sv-shadow-lift)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="absolute right-4 top-4 h-8 w-8 rounded-full border-[#D6DFF0] p-0 text-[#0E2A5C]"
          onClick={onClose}
        >
          <X className="size-4" />
          <span className="sr-only">Zavřít</span>
        </Button>
        {state.type === "student" && student && (
          <>
            <DetailModalHeader title="Detail dítěte" description={student.prezdivka} />
            <div className="space-y-4 p-4 pt-0">
              <div className="flex items-start gap-4 rounded-xl border border-[#D6DFF0] bg-[#EEF2F7] p-3">
                <Image
                  src={getStudentPhotoUrl(student)}
                  alt={`Fotka ${student.jmeno}`}
                  width={80}
                  height={80}
                  unoptimized
                  className="h-20 w-20 rounded-xl border border-[#D6DFF0] bg-white object-cover"
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#0E2A5C]">{student.prezdivka}</p>
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
            <DetailModalHeader title="Detail lodičky" description={lodicka.nazev} />
            <div className="space-y-4 p-4 pt-0">
              <div className="grid gap-2 rounded-xl border border-[#D6DFF0] bg-[#EEF2F7] p-3">
                <InfoCell label="Kód" value={lodicka.kod} />
                <InfoCell label="Předmět" value={lodicka.predmet} />
                <InfoCell label="Podpředmět" value={lodicka.podpředmět ?? "-"} />
                <InfoCell label="Oblast" value={lodicka.oblast} />
                <InfoCell label="Garant" value={getGuideDisplayName(lodicka.garantId)} />
                <InfoCell label="Ročníky plnění" value={formatLodickaRocnikRange(lodicka.odRocniku, lodicka.doRocniku)} />
                <InfoCell label="Typ" value={formatLodickaTyp(lodicka.typ)} />
              </div>

            </div>
          </>
        )}

        {state.type === "personal" && personal && student && lodicka && (
          <>
            <DetailModalHeader
              title="Detail osobní lodičky"
              description={`${getStudentDisplayName(student, activeRole)} · ${lodicka.nazev}`}
            />
            <div className="space-y-4 p-4 pt-0">
              <div className="grid gap-2 rounded-xl border border-[#D6DFF0] bg-[#EEF2F7] p-3">
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
                      <TableCell>{TEST_LODICKA_STAV_LABEL[event.stav]}</TableCell>
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
      </div>
    </div>
  );
}

function DetailModalHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4 border-b border-[#D6DFF0] px-4 py-4 pr-14">
      <div className="font-semibold text-[#0E2A5C]">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{description}</div>
    </div>
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

function buildProtoDatasetFromCompact(data: LodickyCompactResponse): ProtoDatasetFromDb {
  const children = Array.isArray(data.children) ? data.children : [];
  const lodickyCatalog = Array.isArray(data.lodickyCatalog) ? data.lodickyCatalog : [];
  const osobniLodicky = Array.isArray(data.osobniLodicky) ? data.osobniLodicky : [];
  const rowsByChild: Record<string, LodickaRow[]> = {};
  for (const child of children) rowsByChild[child.id] = [];

  for (const personal of osobniLodicky) {
    const [
      childIndex,
      id,
      lodickaIndex,
      kodOsobniLodicky,
      stav,
      hodnota,
      uspech,
      poznamka,
      datumStavu,
      history = [],
    ] = personal;
    const childId = children[childIndex]?.id ?? "";
    const catalog = lodickyCatalog[lodickaIndex] ?? null;
    if (!childId || !catalog) continue;
    if (!rowsByChild[childId]) rowsByChild[childId] = [];

    rowsByChild[childId].push({
      id,
      lodickaId: catalog.lodickaId,
      kodLodicky: catalog.kodLodicky,
      kodOsobniLodicky,
      predmet: catalog.predmet,
      podpredmet: catalog.podpredmet,
      oblast: catalog.oblast,
      nazevLodicky: catalog.nazevLodicky,
      typ: catalog.typ,
      stupen: catalog.stupen,
      rocnikOd: catalog.rocnikOd,
      rocnikDo: catalog.rocnikDo,
      garantPersonId: catalog.garantPersonId,
      garantName: catalog.garantName,
      stav,
      hodnota,
      uspech,
      poznamka,
      datumStavu,
      history,
    });
  }

  return buildProtoDatasetFromDb({ ...data, children }, rowsByChild);
}

function buildProtoDatasetFromDb(
  childrenData: ChildrenResponse,
  rowsByChild: Record<string, LodickaRow[]>,
): ProtoDatasetFromDb {
  const parentActorId =
    childrenData.parent.id?.trim() || `u-rodic-${slugify(childrenData.parent.name || "db")}`;
  const parentName = childrenData.parent.name?.trim() || "Rodič";
  const parentEmail = (childrenData.userEmail ?? "").trim().toLowerCase();

  const students: ProtoStudent[] = childrenData.children.map((child) => {
    const rocnik = normalizeChildRocnik(child.rocnik);
    const stupen = normalizeChildStupen(child.stupen, rocnik);
    return {
      id: child.id,
      jmeno: child.name,
      prezdivka: child.nickname?.trim() || toNickname(child.displayName?.trim() || child.name),
      searchAliases: uniqueValues([
        child.name,
        child.displayName?.trim() ?? "",
        child.firstName?.trim() ?? "",
        child.nickname?.trim() ?? "",
      ].filter(Boolean)),
      stupen,
      rocnik,
      smecka: normalizeChildSmecka(child.smecka),
    };
  });

  const actorsMap = new Map<string, ProtoActor>();
  const parentActor: ProtoActor = {
    id: parentActorId,
    jmeno: parentName,
    email: parentEmail,
    roles: ["rodic", "spravce"],
  };
  actorsMap.set(parentActor.id, parentActor);
  for (const student of students) {
    actorsMap.set(`u-zak-${student.id}`, {
      id: `u-zak-${student.id}`,
      jmeno: student.jmeno,
      email: "",
      roles: ["zak"],
      linkedStudentId: student.id,
    });
  }

  function ensureActor(id: string, name: string, role: ProtoRoleId) {
    const trimmedId = id.trim();
    if (!trimmedId) return;
    const trimmedName = name.trim() || trimmedId;
    const existing = actorsMap.get(trimmedId);
    if (existing) {
      if (!existing.roles.includes(role)) {
        existing.roles = [...existing.roles, role];
      }
      if (!existing.jmeno.trim()) {
        existing.jmeno = trimmedName;
      }
      return;
    }
    actorsMap.set(trimmedId, {
      id: trimmedId,
      jmeno: trimmedName,
      email: "",
      roles: [role],
    });
  }

  const parentLinks: ProtoParentChildLink[] = students.map((student) => ({
    parentId: parentActorId,
    studentId: student.id,
  }));

  const studentsById = new Map(students.map((student) => [student.id, student]));
  const catalogById = new Map<string, ProtoLodickaCatalogItem>();
  const osobniLodicky: ProtoOsobniLodicka[] = [];
  const events: ProtoOsobniLodickaEvent[] = [];
  const personalSeen = new Set<string>();
  let rowsCount = 0;

  for (const [childId, childRows] of Object.entries(rowsByChild)) {
    const student = studentsById.get(childId);
    const studentStupen = student?.stupen ?? null;
    const studentRocnik = student?.rocnik ?? null;

    childRows.forEach((row, index) => {
      rowsCount += 1;

      const lodickaId = row.lodickaId.trim() || row.id;
      const garantActorId = row.garantPersonId?.trim() || "";
      if (garantActorId && row.garantName) {
        ensureActor(garantActorId, row.garantName, "garant");
      }

      let lodicka = catalogById.get(lodickaId);
      if (!lodicka) {
        lodicka = {
          id: lodickaId,
          kod: normalizeLodickaCode(row.kodLodicky, row.kodOsobniLodicky),
          nazev: row.nazevLodicky,
          popis: row.poznamka && row.poznamka !== "—" ? row.poznamka : row.nazevLodicky,
          predmet: row.predmet,
          podpředmět: row.podpredmet === "—" ? undefined : row.podpredmet,
          oblast: row.oblast,
          stupen: mapLodickaStupen(row.stupen, studentStupen),
          odRocniku: normalizeGradeBound(row.rocnikOd, studentRocnik),
          doRocniku: normalizeGradeBound(row.rocnikDo, studentRocnik),
          garantId: garantActorId || "db-unknown-actor",
          typ: mapLodickaTyp(row.typ),
        };
        catalogById.set(lodickaId, lodicka);
      }

      const personalId = row.id;
      if (!personalSeen.has(personalId)) {
        personalSeen.add(personalId);
        osobniLodicky.push({
          id: personalId,
          studentId: childId,
          lodickaId: lodicka.id,
        });
      }

      if (row.history.length > 0) {
        row.history.forEach((historyItem) => {
          const actorId = resolveHistoryActorId(historyItem, ensureActor);
          events.push({
            id: historyItem.id,
            osobniLodickaId: personalId,
            datumStavu: normalizeIsoDate(historyItem.datumStavu ?? row.datumStavu),
            zapsanoAt: normalizeIsoDateTime(
              historyItem.sourceModifiedAt ??
                historyItem.sourceCreatedAt ??
                historyItem.createdAt ??
                historyItem.datumStavu ??
                row.datumStavu,
            ),
            stav: mapDbStavToProto(historyItem.stav, historyItem.hodnota),
            zapsalId: actorId,
            poznamka:
              historyItem.poznamka && historyItem.poznamka.trim()
                ? historyItem.poznamka
                : historyItem.uspech && historyItem.uspech.trim()
                  ? historyItem.uspech
                  : undefined,
          });
        });
      } else {
        events.push({
          id: `current-${row.id}-${index}`,
          osobniLodickaId: personalId,
          datumStavu: normalizeIsoDate(row.datumStavu),
          zapsanoAt: normalizeIsoDateTime(row.datumStavu),
          stav: mapDbStavToProto(row.stav, row.hodnota),
          zapsalId: "db-unknown-actor",
          poznamka: row.poznamka && row.poznamka !== "—" ? row.poznamka : undefined,
        });
      }
    });
  }

  ensureActor("db-unknown-actor", "Neznámý (DB)", "spravce");

  return {
    parentActorId,
    actors: [...actorsMap.values()],
    students,
    parentLinks,
    lodickyCatalog: [...catalogById.values()],
    osobniLodicky,
    events,
    lodickyRowsCount: rowsCount,
  };
}

function mapDbStavToProto(stav: string | null | undefined, hodnota: number | null = null): LodickaStav {
  if (typeof hodnota === "number" && Number.isFinite(hodnota)) {
    const rounded = Math.round(hodnota);
    if (rounded >= 4) return 4;
    if (rounded === 3) return 3;
    if (rounded === 2) return 2;
    if (rounded === 1) return 1;
  }

  const normalized = normalizeSearch(stav ?? "");
  if (normalized.includes("samostat")) return 4;
  if (normalized.includes("castec")) return 3;
  if (normalized.includes("dopomoc")) return 2;
  if (normalized.includes("rozprac")) return 1;
  if (normalized.includes("nezah")) return 0;
  if (normalized.startsWith("zahaj")) return 1;
  return 0;
}

function normalizeIsoDate(value: string | null): string {
  if (!value) return getTodayIsoForProto();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return getTodayIsoForProto();
  return date.toISOString().slice(0, 10);
}

function normalizeIsoDateTime(value: string | null): string {
  if (!value) return `${getTodayIsoForProto()} 00:00`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `${getTodayIsoForProto()} 00:00`;
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
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
  return trimmed.length > 0 ? trimmed : "—";
}

function normalizeLodickaCode(kodLodicky: string | null, kodOsobniLodicky: string | null): string {
  const lodickaCode = (kodLodicky ?? "").trim();
  if (lodickaCode) return lodickaCode;
  const personalCode = (kodOsobniLodicky ?? "").trim();
  if (personalCode) return personalCode;
  return "—";
}

function mapLodickaTyp(value: string | null): "individualni" | "hromadna" {
  const normalized = normalizeSearch(value ?? "");
  return normalized.includes("hromad") ? "hromadna" : "individualni";
}

function mapLodickaStupen(value: string | null, studentStupen: 1 | 2 | null): 1 | 2 {
  const normalized = normalizeSearch(value ?? "");
  if (normalized.includes("ii") || normalized.includes("2")) return 2;
  if (normalized.includes("i") || normalized.includes("1")) return 1;
  if (studentStupen === 2) return 2;
  return 1;
}

function normalizeGradeBound(value: number | null, studentRocnik: number | null): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    if (rounded >= 1 && rounded <= 9) return rounded;
  }
  if (typeof studentRocnik === "number" && Number.isFinite(studentRocnik)) {
    const rounded = Math.round(studentRocnik);
    if (rounded >= 1 && rounded <= 9) return rounded;
  }
  return 0;
}

function resolveHistoryActorId(
  historyItem: LodickaHistoryRow,
  ensureActor: (id: string, name: string, role: ProtoRoleId) => void,
): string {
  const personId = (historyItem.changedByPersonId ?? "").trim();
  if (personId) {
    const personName =
      (historyItem.changedByLabel ?? "").trim() ||
      (historyItem.sourceModifiedByLabel ?? "").trim() ||
      (historyItem.sourceCreatedByLabel ?? "").trim() ||
      personId;
    ensureActor(personId, personName, "spravce");
    return personId;
  }

  const label =
    (historyItem.changedByLabel ?? "").trim() ||
    (historyItem.sourceModifiedByLabel ?? "").trim() ||
    (historyItem.sourceCreatedByLabel ?? "").trim();
  if (label) {
    const labelId = `db-label-${slugify(label)}`;
    ensureActor(labelId, label, "spravce");
    return labelId;
  }

  return "db-unknown-actor";
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
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <div className="inline-flex rounded-full border border-[#D6DFF0] bg-[#EEF2F7] p-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              value === option.id ? "bg-[#0E2A5C] text-white" : "text-slate-600 hover:bg-[#EEF2F7]"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
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
        className="rounded-full border border-[#D6DFF0] bg-white px-3 py-1.5 text-xs text-[#0E2A5C] outline-none focus:border-[#C8372D]"
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
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">{label}</p>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label={`Vymazat filtr ${label}`}
            title={`Vymazat filtr ${label}`}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#D6DFF0] bg-[#EEF2F7] p-2">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                if (selected) {
                  onChange(value.filter((item) => item !== option));
                } else {
                  onChange([...value, option]);
                }
              }}
              className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                selected
                  ? "border-[#0E2A5C] bg-[#0E2A5C] text-white hover:border-[#0E2A5C] hover:bg-[#0E2A5C]"
                  : "border-[#D6DFF0] bg-white text-slate-700 hover:bg-[#EEF2F7]"
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
          ? "border-[#0E2A5C] bg-[#0E2A5C] text-white hover:border-[#0E2A5C] hover:bg-[#0E2A5C]"
          : "border-[#D6DFF0] bg-white text-slate-700 hover:bg-[#EEF2F7]"
      }`}
    >
      {label}: {enabled ? "ano" : "ne"}
    </button>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D6DFF0] bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#0E2A5C]">{value}</p>
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
            <TableCell colSpan={showGarantControls ? 3 : 2} className="text-xs font-semibold uppercase tracking-normal text-[#1E3F7A]">
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
            className={cn(
              "cursor-pointer border-l-4 border-l-transparent",
              isSelected && "border-l-[#0E2A5C] bg-[#EEF4FF] hover:bg-[#E4EDFF]",
            )}
            onClick={() =>
              onSelect(
                item.lodicka.id,
                item.lodicka.nazev,
                String(rowCounter),
                `${tableId} > GROUP:${groupName} > LODICKA:${item.lodicka.id}`,
              )
            }
          >
            <TableCell className={cn("font-medium text-[#0E2A5C]", isSelected && "font-semibold")}>
              <div className="inline-flex items-center gap-1.5">
                <span>{item.lodicka.nazev}</span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-5 w-5 p-0 text-slate-500 hover:text-[#1E3F7A]"
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
          <TableCell colSpan={2} className="text-xs font-semibold uppercase tracking-normal text-[#1E3F7A]">
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
          className={cn(
            "cursor-pointer border-l-4 border-l-transparent",
            isSelected && "border-l-[#0E2A5C] bg-[#EEF4FF] hover:bg-[#E4EDFF]",
          )}
          onClick={() =>
            onSelect(
              item.student.id,
              displayName,
              String(rowCounter),
              `${tableId} > GROUP:${groupName} > STUDENT:${item.student.id}`,
            )
          }
        >
          <TableCell className={cn("font-medium text-[#0E2A5C]", isSelected && "font-semibold")}>
            <div className="inline-flex items-center gap-1.5">
              <span>{displayName}</span>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="h-5 w-5 p-0 text-slate-500 hover:text-[#1E3F7A]"
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
  canWriteStatusForRow,
  activeRole,
  peopleGroupBy,
  lodickaGroupKeys,
  onSelectRow,
  onSetStatus,
  onOpenPersonalDetail,
  onOpenLodickaDetail,
  onOpenStudentDetail,
}: {
  rows: PersonalWithSnapshot[];
  selectedPersonalId: string | null;
  viewMode: ViewMode;
  tableId: string;
  canWriteStatusForRow: (row: PersonalWithSnapshot) => boolean;
  activeRole: ProtoRoleId;
  peopleGroupBy: PeopleGroupKey;
  lodickaGroupKeys: LodickaGroupKey[];
  onSelectRow: (personalId: string, label: string, rowId: string, hierarchy: string) => void;
  onSetStatus: (personalId: string, status: LodickaStav) => void;
  onOpenPersonalDetail: (personalId: string, eventId?: string) => void;
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
          <TableCell colSpan={3} className="text-xs font-semibold uppercase tracking-normal text-[#1E3F7A]">
            {groupName} ({groupItems.length})
          </TableCell>
        </TableRow>,
      );
    }

    groupItems.forEach((row) => {
      rowCounter += 1;
      const isSelected = selectedPersonalId === row.personal.id;
      const rowLabel = viewMode === "po_lodickach" ? getStudentDisplayName(row.student, activeRole) : row.lodicka.nazev;
      const canWriteStatus = canWriteStatusForRow(row);

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
          <TableCell className="font-medium text-[#0E2A5C]">
            <div className="inline-flex items-center gap-1.5">
              <span>{rowLabel}</span>
              {viewMode === "po_lodickach" ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-5 w-5 p-0 text-slate-500 hover:text-[#1E3F7A]"
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
                  className="h-5 w-5 p-0 text-slate-500 hover:text-[#1E3F7A]"
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
            <Badge className={stavBadgeClass(row.stav)}>{TEST_LODICKA_STAV_LABEL[row.stav]}</Badge>
          </TableCell>
          <TableCell className="text-right">
            <TooltipProvider delayDuration={450}>
              <div className="inline-flex items-center justify-end gap-1">
                {STATUS_BUTTONS.map((statusButton) => (
                  <Tooltip key={statusButton.value}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={!canWriteStatus}
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
                      {TEST_LODICKA_STAV_LABEL[statusButton.value]}
                    </TooltipContent>
                  </Tooltip>
                ))}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="h-7 border-[#D6DFF0] px-2.5 text-xs font-semibold text-[#0E2A5C] hover:border-[#1E3F7A] hover:bg-[#EEF2F7]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenPersonalDetail(row.personal.id, row.lastEvent?.id);
                      }}
                    >
                      Detail
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    Detail osobní lodičky
                  </TooltipContent>
                </Tooltip>
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
  const aliases = student.searchAliases?.join(" ") ?? "";
  return normalizeSearch(
    `${student.jmeno} ${firstName} ${lastName} ${student.prezdivka} ${aliases} ${student.smecka} ${student.rocnik}`,
  );
}

function buildLodickaSearchHaystack(lodicka: ProtoLodickaCatalogItem): string {
  return normalizeSearch(
    `${lodicka.nazev} ${lodicka.popis} ${lodicka.oblast} ${lodicka.predmet} ${lodicka.podpředmět ?? ""} ${getGuideDisplayName(lodicka.garantId)}`,
  );
}

function buildRightPaneSearchHaystack(
  row: PersonalWithSnapshot,
  viewMode: ViewMode,
  activeRole: ProtoRoleId,
): string {
  const visibleLabel = viewMode === "po_lodickach" ? getStudentDisplayName(row.student, activeRole) : row.lodicka.nazev;
  return normalizeSearch(
    [
      visibleLabel,
      buildStudentSearchHaystack(row.student),
      buildLodickaSearchHaystack(row.lodicka),
      TEST_LODICKA_STAV_LABEL[row.stav],
      row.lastEvent?.poznamka ?? "",
    ].join(" "),
  );
}

function scoreTextMatch(value: string, needle: string): number {
  if (!needle) return 0;
  const normalized = normalizeSearch(value);
  const index = normalized.indexOf(needle);
  if (index < 0) return 0;
  const wordStartBonus = index === 0 || normalized[index - 1] === " " ? 20 : 0;
  return 100 + wordStartBonus - Math.min(index, 40);
}

function scoreStudentSuggestion(student: ProtoStudent, needle: string): number {
  const aliasScore = Math.max(...(student.searchAliases ?? []).map((alias) => scoreTextMatch(alias, needle)), 0);
  return Math.max(
    scoreTextMatch(student.jmeno, needle),
    scoreTextMatch(getFirstName(student.jmeno), needle),
    scoreTextMatch(getLastName(student.jmeno), needle),
    scoreTextMatch(student.prezdivka, needle),
    aliasScore,
    buildStudentSearchHaystack(student).includes(needle) ? 10 : 0,
  );
}

function scoreLodickaSuggestion(lodicka: ProtoLodickaCatalogItem, needle: string): number {
  return Math.max(
    scoreTextMatch(lodicka.nazev, needle) + 1_000,
    scoreTextMatch(lodicka.oblast, needle) + 200,
    scoreTextMatch(lodicka.predmet, needle) + 100,
    scoreTextMatch(lodicka.podpředmět ?? "", needle) + 100,
    buildLodickaSearchHaystack(lodicka).includes(needle) ? 10 : 0,
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

function buildSmartSearchPlan(
  input: string,
  options: {
    stupne: string[];
    rocniky: string[];
    smecky: string[];
    predmety: string[];
    podpredmety: string[];
    oblasti: string[];
    stavy: string[];
    garanti: string[];
    studentHaystacks: string[];
  },
) {
  void options;
  const tokens = tokenizeSearch(input);
  return {
    people: { stupen: [] as string[], rocnik: [] as string[], smecka: [] as string[] },
    lodicky: {
      predmet: [] as string[],
      podpredmet: [] as string[],
      oblast: [] as string[],
      stav: [] as string[],
      garant: [] as string[],
    },
    freeTokens: uniqueValues(tokens),
  };
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
  return actor.jmeno;
}

function getActorDisplayName(actorId: string, activeRole: ProtoRoleId): string {
  const actor = PROTO_ACTORS.find((item) => item.id === actorId);
  if (!actor) return actorId;

  if (actor.roles.includes("rodic")) return actor.jmeno;
  if (actor.roles.includes("garant")) return actor.jmeno;
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

function formatLodickaRocnikRange(odRocniku: number, doRocniku: number): string {
  if (odRocniku <= 0 || doRocniku <= 0) return "—";
  return `${odRocniku}. až ${doRocniku}. ročník`;
}

function formatLodickaTyp(typ: "individualni" | "hromadna"): string {
  return typ === "hromadna" ? "Hromadná" : "Individuální";
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
    return "!border-[#0E2A5C] !bg-[#0E2A5C] !text-white !hover:border-[#0E2A5C] !hover:bg-[#0E2A5C] !hover:text-white";
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
  return [...map.entries()].sort(([a], [b]) => compareGroupNames(a, b));
}

function compareGroupNames(a: string, b: string): number {
  if (a === b) return 0;
  if (a === "__all__") return -1;
  if (b === "__all__") return 1;

  return a.localeCompare(b, "cs", {
    numeric: true,
    sensitivity: "base",
  });
}

function getSchoolYearBounds(dateIso: string) {
  const [year, month] = parseIsoYearMonth(dateIso);
  const startYear = month >= 9 ? year : year - 1;
  return {
    minDate: `${startYear}-09-01`,
    maxDate: `${startYear + 1}-08-31`,
  };
}

function getSemesterBoundsForDate(dateIso: string) {
  const [year, month] = parseIsoYearMonth(dateIso);
  if (month >= 9) {
    return {
      minDate: `${year}-09-01`,
      maxDate: `${year + 1}-01-31`,
    };
  }
  if (month === 1) {
    return {
      minDate: `${year - 1}-09-01`,
      maxDate: `${year}-01-31`,
    };
  }
  return {
    minDate: `${year}-02-01`,
    maxDate: `${year}-08-31`,
  };
}

function parseIsoYearMonth(dateIso: string): [number, number] {
  const [yearRaw, monthRaw] = dateIso.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month) return [new Date().getFullYear(), new Date().getMonth() + 1];
  return [year, month];
}

function isDateInRange(value: string, min: string, max: string): boolean {
  return value >= min && value <= max;
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
