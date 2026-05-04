"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, ImageIcon, Loader2, Plus, Save, Search, Trash2, UploadCloud, UserPlus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type RegistrationStatus = "REGISTERED" | "UNREGISTERED" | "WAITLIST" | "CANCELED_BY_GUIDE";
type Focus = "" | "pohybovy" | "vytvarny" | "hudebni" | "badatelsky" | "online-svet";
type AudienceMode = "rocnik-stupen" | "smecka" | "studijni_skupina";

type Registration = {
  id?: string;
  personId: string;
  status: RegistrationStatus;
};

type RegistrationPolicy = {
  capacity: number | null;
  opensAt: string | null;
  closesAt: string | null;
};

type AudienceRule = {
  groupKind: string | null;
  groupCode: string | null;
};

type OstrovEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  lifecycleStatus: string;
  isActive: boolean;
  metadata: unknown;
  registrationPolicy: RegistrationPolicy | null;
  registrations: Registration[];
  audienceRules: AudienceRule[];
  kioskDisplayNumber: number | null;
  kioskDisplayColor: string | null;
};

type Term = {
  id: string;
  name: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  events: OstrovEvent[];
};

type Student = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  rocnik: string | null;
  smecka: string | null;
  smeckaCode: string | null;
  groupPairs: Array<{ kind: string; code: string }>;
  currentRegistration: {
    eventId: string;
    eventTitle: string;
    status: RegistrationStatus;
  } | null;
};

type StudentOverviewGroupBy = "smecka" | "rocnik";

type OverviewGuestRow = {
  key: string;
  eventId: string;
  eventTitle: string;
  guestIndex: number;
  name: string;
};

type GuideOption = {
  id: string;
  displayName: string;
  legalName: string;
  identifier: string | null;
  email: string | null;
};

type MoveDialogState =
  | {
      kind: "student";
      personId: string;
      sourceEventId: string;
      label: string;
    }
  | {
      kind: "guest";
      guestIndex: number;
      sourceEventId: string;
      label: string;
    };

type AudienceGroupOption = {
  kind: string;
  code: string;
  name: string | null;
  memberCount: number;
};

type GuideDraftItem = {
  personId?: string;
  name: string;
};

type EventDraft = {
  title: string;
  description: string;
  location: string;
  capacity: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  focus: Focus;
  thumbnailUrl: string;
  thumbnailSourceImageUrl: string;
  thumbnailSourceUrl: string;
  guides: string;
  audienceGroups: string;
};

type ImageActionResponse = {
  url: string;
  sourceImageUrl?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  license?: string | null;
  provider?: string | null;
  reason?: string | null;
};

type ImageOption = {
  imageUrl: string;
  previewUrl?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  license?: string | null;
  author?: string | null;
  provider?: string | null;
  reason?: string | null;
};

type ImageFindResponse = {
  options?: ImageOption[];
};

type EventPayload = {
  termId: string;
  title: string;
  description: string | null;
  location: string | null;
  capacity: number | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  focus: Focus | null;
  thumbnailUrl: string | null;
  thumbnailSourceImageUrl: string | null;
  thumbnailSourceUrl: string | null;
  guides: Array<{ personId?: string; name?: string }>;
  audienceGroups: Array<{ kind: string; code: string }>;
};

type AutoSaveState = "idle" | "saving" | "saved" | "error";

const FOCUS_OPTIONS: Array<{ value: Focus; label: string }> = [
  { value: "", label: "Bez zaměření" },
  { value: "pohybovy", label: "Pohybový" },
  { value: "vytvarny", label: "Výtvarný" },
  { value: "hudebni", label: "Hudební" },
  { value: "badatelsky", label: "Badatelský" },
  { value: "online-svet", label: "Online svět" },
];

const AUDIENCE_MODES: Array<{ value: AudienceMode; label: string; kinds: string[] }> = [
  { value: "rocnik-stupen", label: "Ročníky a stupně", kinds: ["stupen", "rocnik"] },
  { value: "smecka", label: "Smečky", kinds: ["smecka"] },
  { value: "studijni_skupina", label: "Studijní skupiny", kinds: ["studijni_skupina"] },
];

const ROCNIKY_BY_STUPEN: Record<string, string[]> = {
  "1": ["1", "2", "3", "4", "5"],
  "2": ["6", "7", "8", "9"],
};

const EMPTY_EVENT_DRAFT: EventDraft = {
  title: "",
  description: "",
  location: "",
  capacity: "12",
  registrationOpensAt: "",
  registrationClosesAt: "",
  focus: "",
  thumbnailUrl: "",
  thumbnailSourceImageUrl: "",
  thumbnailSourceUrl: "",
  guides: "",
  audienceGroups: "",
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return DATE_TIME_FORMATTER.format(new Date(value));
}

function formatTermName(term: Pick<Term, "name" | "startsAt">): string {
  if (term.startsAt) {
    return `Ostrovy ${DATE_ONLY_FORMATTER.format(new Date(term.startsAt))}`;
  }
  return term.name;
}

function toLocalInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function localInputToIso(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function defaultDateTimeLocal(daysAhead: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, minute, 0, 0);
  return toLocalInputValue(date.toISOString());
}

function nextMondayAtTime(hour: number, minute: number): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon
  const daysUntilMonday = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(hour, minute, 0, 0);
  return toLocalInputValue(monday.toISOString());
}

function parseLocalDateTime(value: string): Date | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDateToInputValue(date: Date): string {
  return toLocalInputValue(date.toISOString());
}

function addMinutesToLocalInput(startsAt: string, minutes: number): string {
  const start = parseLocalDateTime(startsAt);
  if (!start) return "";
  return localDateToInputValue(new Date(start.getTime() + minutes * 60_000));
}

function rangeDurationMinutes(startsAt: string, endsAt: string): number | null {
  const start = parseLocalDateTime(startsAt);
  const end = parseLocalDateTime(endsAt);
  if (!start || !end || end <= start) return null;
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

function formatDurationHours(startsAt: string, endsAt: string): string {
  const minutes = rangeDurationMinutes(startsAt, endsAt);
  if (minutes == null) return "";
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function parseDurationHours(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 2) / 2;
}

function shiftEndByStartDelta(previousStart: string, previousEnd: string, nextStart: string): string {
  const oldStart = parseLocalDateTime(previousStart);
  const oldEnd = parseLocalDateTime(previousEnd);
  const newStart = parseLocalDateTime(nextStart);
  if (!oldStart || !oldEnd || !newStart || oldEnd <= oldStart) {
    return addMinutesToLocalInput(nextStart, 60);
  }
  const delta = newStart.getTime() - oldStart.getTime();
  return localDateToInputValue(new Date(oldEnd.getTime() + delta));
}

function clampEndAfterStart(startsAt: string, endsAt: string): string {
  const start = parseLocalDateTime(startsAt);
  const end = parseLocalDateTime(endsAt);
  if (!start || !end) return endsAt;
  if (end > start) return endsAt;
  return addMinutesToLocalInput(startsAt, 30);
}

function defaultRegistrationWindowForTerm(term: Term | null): Pick<EventDraft, "registrationOpensAt" | "registrationClosesAt"> {
  const now = new Date();
  if (!term?.startsAt) {
    return {
      registrationOpensAt: toLocalInputValue(now.toISOString()),
      registrationClosesAt: "",
    };
  }

  const eventDate = new Date(term.startsAt);
  if (Number.isNaN(eventDate.getTime())) {
    return {
      registrationOpensAt: toLocalInputValue(now.toISOString()),
      registrationClosesAt: "",
    };
  }

  // Close registration 1.5 hours before term start
  const closesAt = new Date(eventDate.getTime() - 90 * 60_000);

  return {
    registrationOpensAt: toLocalInputValue(now.toISOString()),
    registrationClosesAt: toLocalInputValue(closesAt.toISOString()),
  };
}

function makeDraftForNewEvent(term: Term | null): EventDraft {
  return {
    ...EMPTY_EVENT_DRAFT,
    ...defaultRegistrationWindowForTerm(term),
  };
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function ostrovyMetadata(event: OstrovEvent): Record<string, unknown> {
  const metadata = metadataObject(event.metadata);
  return metadataObject(metadata.ostrovy);
}

function eventFocus(event: OstrovEvent): Focus {
  const focus = ostrovyMetadata(event).focus;
  return typeof focus === "string" && FOCUS_OPTIONS.some((item) => item.value === focus) ? (focus as Focus) : "";
}

function focusLabel(focus: Focus): string {
  return FOCUS_OPTIONS.find((item) => item.value === focus)?.label ?? "Bez zaměření";
}

function registrationStatusLabel(status: RegistrationStatus): string {
  switch (status) {
    case "REGISTERED":
      return "Zapsáno";
    case "WAITLIST":
      return "Náhradník";
    case "UNREGISTERED":
      return "Odhlášeno";
    case "CANCELED_BY_GUIDE":
      return "Zrušeno průvodcem";
    default:
      return status;
  }
}

function formatRocnikLabel(rocnik: string | null): string {
  if (!rocnik) return "Bez ročníku";
  const normalized = rocnik.trim();
  if (!normalized) return "Bez ročníku";
  if (/^\d+$/.test(normalized)) return `${normalized}. ročník`;
  return `Ročník ${normalized}`;
}

function formatStudentGroupMeta(student: Pick<Student, "smecka" | "rocnik">): string {
  const smecka = student.smecka?.trim() || "Bez smečky";
  return `${smecka} · ${formatRocnikLabel(student.rocnik)}`;
}

function studentSearchIndex(student: Pick<Student, "displayName" | "firstName" | "lastName" | "nickname" | "smecka" | "rocnik">): string {
  return normalizeSearchValue([
    student.displayName,
    student.firstName ?? "",
    student.lastName ?? "",
    student.nickname ?? "",
    student.smecka ?? "",
    student.rocnik ?? "",
  ].join(" "));
}

function studentStupenCode(student: Pick<Student, "rocnik">): string | null {
  const rocnik = student.rocnik?.trim() ?? "";
  if (!/^\d+$/.test(rocnik)) return null;
  const grade = Number(rocnik);
  if (!Number.isFinite(grade) || grade < 1) return null;
  return grade <= 5 ? "1" : "2";
}

function studentMatchesAudienceRule(student: Pick<Student, "rocnik" | "smeckaCode" | "groupPairs">, rule: AudienceRule): boolean {
  const kind = rule.groupKind?.trim().toLowerCase();
  const code = rule.groupCode?.trim().toLowerCase();
  if (!kind || !code) return false;

  if (kind === "rocnik") {
    return (student.rocnik?.trim().toLowerCase() ?? "") === code;
  }
  if (kind === "stupen") {
    return studentStupenCode(student) === code;
  }
  if (kind === "smecka") {
    return (student.smeckaCode?.trim().toLowerCase() ?? "") === code;
  }
  return student.groupPairs.some((group) => group.kind === kind && group.code === code);
}

function studentCanJoinEvent(student: Pick<Student, "rocnik" | "smeckaCode" | "groupPairs">, event: Pick<OstrovEvent, "audienceRules">): boolean {
  const groupRules = event.audienceRules.filter((rule) => Boolean(rule.groupKind && rule.groupCode));
  if (groupRules.length === 0) return true;
  return groupRules.some((rule) => studentMatchesAudienceRule(student, rule));
}

function eventRegisteredChildrenCount(event: Pick<OstrovEvent, "registrations">): number {
  return event.registrations.filter((registration) => registration.status === "REGISTERED" || registration.status === "WAITLIST").length;
}

function eventThumbnail(event: OstrovEvent): string {
  const value = ostrovyMetadata(event).thumbnailUrl;
  return typeof value === "string" ? value : "";
}

function eventThumbnailSourceImage(event: OstrovEvent): string {
  const value = ostrovyMetadata(event).thumbnailSourceImageUrl;
  return typeof value === "string" ? value : "";
}

function eventThumbnailSourcePage(event: OstrovEvent): string {
  const value = ostrovyMetadata(event).thumbnailSourceUrl;
  return typeof value === "string" ? value : "";
}

function eventGuides(event: OstrovEvent): string {
  const guides = ostrovyMetadata(event).guides;
  if (!Array.isArray(guides)) return "";
  return guides
    .map((guide) => {
      const item = metadataObject(guide);
      return [item.personId, item.name].filter((value) => typeof value === "string" && value.trim()).join(":");
    })
    .filter(Boolean)
    .join("\n");
}

function groupsToText(groups: AudienceRule[]): string {
  const parsed = groups
    .filter((group) => group.groupKind && group.groupCode)
    .map((group) => ({ kind: String(group.groupKind), code: String(group.groupCode) }));
  return serializeAudienceGroups(parsed);
}

function parseAudienceGroups(input: string): Array<{ kind: string; code: string }> {
  return input
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.includes(":") ? ":" : line.includes("=") ? "=" : null;
      if (!separator) return { kind: "smecka", code: line };
      const [kind, ...rest] = line.split(separator);
      return { kind: kind.trim(), code: rest.join(separator).trim() };
    })
    .filter((group) => group.kind && group.code);
}

function audienceGroupKey(group: { kind: string; code: string }): string {
  return `${group.kind.trim().toLowerCase()}:${group.code.trim().toLowerCase()}`;
}

function normalizedAudienceGroup(group: { kind: string; code: string }): { kind: string; code: string } | null {
  const kind = group.kind.trim().toLowerCase();
  const code = group.code.trim();
  if (!kind || !code) return null;
  return { kind, code };
}

function rocnikCodesForStupen(code: string): string[] {
  return ROCNIKY_BY_STUPEN[code.trim()] ?? [];
}

function stupenCodeForRocnik(code: string): string | null {
  const normalizedCode = code.trim();
  for (const [stupenCode, rocnikCodes] of Object.entries(ROCNIKY_BY_STUPEN)) {
    if (rocnikCodes.includes(normalizedCode)) return stupenCode;
  }
  return null;
}

function audienceSortWeight(group: { kind: string; code: string }): number {
  const weights: Record<string, number> = {
    stupen: 1,
    rocnik: 2,
    smecka: 3,
    studijni_skupina: 4,
  };
  return weights[group.kind] ?? 9;
}

function sortAudienceGroups(groups: Array<{ kind: string; code: string }>): Array<{ kind: string; code: string }> {
  return [...groups].sort((a, b) => {
    const weightDiff = audienceSortWeight(a) - audienceSortWeight(b);
    if (weightDiff !== 0) return weightDiff;
    const aNumber = Number(a.code);
    const bNumber = Number(b.code);
    if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) return aNumber - bNumber;
    return a.code.localeCompare(b.code, "cs");
  });
}

function normalizeAudienceGroups(groups: Array<{ kind: string; code: string }>): Array<{ kind: string; code: string }> {
  const unique = new Map<string, { kind: string; code: string }>();
  for (const group of groups) {
    const normalized = normalizedAudienceGroup(group);
    if (!normalized) continue;
    unique.set(audienceGroupKey(normalized), normalized);
  }

  for (const [stupenCode, rocnikCodes] of Object.entries(ROCNIKY_BY_STUPEN)) {
    const stupenKey = audienceGroupKey({ kind: "stupen", code: stupenCode });
    const rocnikKeys = rocnikCodes.map((code) => audienceGroupKey({ kind: "rocnik", code }));

    if (unique.has(stupenKey)) {
      for (const key of rocnikKeys) unique.delete(key);
      continue;
    }

    if (rocnikKeys.every((key) => unique.has(key))) {
      for (const key of rocnikKeys) unique.delete(key);
      unique.set(stupenKey, { kind: "stupen", code: stupenCode });
    }
  }

  return sortAudienceGroups([...unique.values()]);
}

function serializeAudienceGroups(groups: Array<{ kind: string; code: string }>): string {
  return normalizeAudienceGroups(groups).map((group) => `${group.kind}:${group.code}`).join("\n");
}

function groupKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    stupen: "Stupně",
    rocnik: "Ročníky",
    smecka: "Smečky",
    posadka: "Posádky",
    studijni_skupina: "Studijní skupiny",
  };
  return labels[kind.toLowerCase()] ?? kind;
}

function groupLabel(group: { kind: string; code: string; name?: string | null }): string {
  if (group.name?.trim()) return group.name.trim();
  if (group.kind === "rocnik" && /^\d+$/.test(group.code)) return `${group.code}. ročník`;
  if (group.kind === "stupen" && /^\d+$/.test(group.code)) return `${group.code}. stupeň`;
  return group.code;
}

function parseGuides(input: string): Array<{ personId?: string; name?: string }> {
  return input
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, ...rest] = line.split(":");
      if (rest.length === 0) return { name: left.trim() };
      return { personId: left.trim(), name: rest.join(":").trim() };
    });
}

function guideDraftItems(input: string): GuideDraftItem[] {
  return parseGuides(input)
    .map((guide) => ({
      personId: guide.personId?.trim() || undefined,
      name: guide.name?.trim() || guide.personId?.trim() || "",
    }))
    .filter((guide) => guide.name || guide.personId);
}

function serializeGuideItems(guides: GuideDraftItem[]): string {
  return guides
    .map((guide) => {
      const name = guide.name.trim();
      const personId = guide.personId?.trim();
      if (personId) return `${personId}:${name}`;
      return name;
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function makeDraftFromEvent(event: OstrovEvent): EventDraft {
  return {
    title: event.title,
    description: event.description ?? "",
    location: event.location ?? "",
    capacity: event.registrationPolicy?.capacity == null ? "" : String(event.registrationPolicy.capacity),
    registrationOpensAt: toLocalInputValue(event.registrationPolicy?.opensAt),
    registrationClosesAt: toLocalInputValue(event.registrationPolicy?.closesAt),
    focus: eventFocus(event),
    thumbnailUrl: eventThumbnail(event),
    thumbnailSourceImageUrl: eventThumbnailSourceImage(event),
    thumbnailSourceUrl: eventThumbnailSourcePage(event),
    guides: eventGuides(event),
    audienceGroups: groupsToText(event.audienceRules),
  };
}

function buildEventPayload(termId: string, draft: EventDraft): EventPayload | null {
  const title = draft.title.trim();
  if (!termId || !title) return null;

  const capacityText = draft.capacity.trim();
  const capacity = capacityText ? Number(capacityText) : null;
  if (capacityText && (!Number.isFinite(capacity) || capacity === null || capacity <= 0)) return null;

  const registrationOpensAt = localInputToIso(draft.registrationOpensAt);
  const registrationClosesAt = localInputToIso(draft.registrationClosesAt);
  if (draft.registrationOpensAt.trim() && !registrationOpensAt) return null;
  if (draft.registrationClosesAt.trim() && !registrationClosesAt) return null;
  if (registrationOpensAt && registrationClosesAt && new Date(registrationClosesAt) <= new Date(registrationOpensAt)) return null;

  return {
    termId,
    title,
    description: draft.description || null,
    location: draft.location || null,
    capacity,
    registrationOpensAt,
    registrationClosesAt,
    focus: draft.focus || null,
    thumbnailUrl: draft.thumbnailUrl || null,
    thumbnailSourceImageUrl: draft.thumbnailSourceImageUrl || null,
    thumbnailSourceUrl: draft.thumbnailSourceUrl || null,
    guides: parseGuides(draft.guides),
    audienceGroups: parseAudienceGroups(draft.audienceGroups),
  };
}

function eventPayloadSignature(termId: string, draft: EventDraft): string | null {
  const payload = buildEventPayload(termId, draft);
  return payload ? JSON.stringify(payload) : null;
}

function guestChildrenFromEvent(event: OstrovEvent): string[] {
  const meta = metadataObject(metadataObject(event.metadata).ostrovy);
  return Array.isArray(meta.guestChildren) ? (meta.guestChildren as string[]) : [];
}

function occupancy(event: OstrovEvent): number {
  const registered = event.registrations.filter((registration) => registration.status === "REGISTERED" || registration.status === "WAITLIST").length;
  return registered + guestChildrenFromEvent(event).length;
}

function hasCapacity(event: OstrovEvent): boolean {
  const capacity = event.registrationPolicy?.capacity;
  return capacity == null || occupancy(event) < capacity;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text().catch(() => "");
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = {};
    }
  }
  if (!res.ok) {
    const errorMessage =
      body && typeof body === "object" && "error" in body ? (body as { error?: unknown }).error : null;
    const message = typeof errorMessage === "string" && errorMessage.trim()
      ? errorMessage
      : `Operace se nepodařila (HTTP ${res.status}).`;
    throw new Error(message);
  }
  return body as T;
}

export default function OstrovyGuideClient() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [guideOptions, setGuideOptions] = useState<GuideOption[]>([]);
  const [groupOptions, setGroupOptions] = useState<AudienceGroupOption[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft>(EMPTY_EVENT_DRAFT);
  const [newTermStartsAt, setNewTermStartsAt] = useState(() => nextMondayAtTime(13, 30));
  const [newTermEndsAt, setNewTermEndsAt] = useState(() => nextMondayAtTime(15, 0));
  const [newTermDurationHours, setNewTermDurationHours] = useState("1.5");
  const [editTermStartsAt, setEditTermStartsAt] = useState("");
  const [editTermEndsAt, setEditTermEndsAt] = useState("");
  const [editTermDurationHours, setEditTermDurationHours] = useState("");
  const [termMoveTargetId, setTermMoveTargetId] = useState("");
  const [showTermManagement, setShowTermManagement] = useState(false);
  const [isEventEditorOpen, setIsEventEditorOpen] = useState(false);
  const [isStudentOverviewOpen, setIsStudentOverviewOpen] = useState(false);
  const [studentOverviewGroupBy, setStudentOverviewGroupBy] = useState<StudentOverviewGroupBy>("smecka");
  const [studentOverviewSearch, setStudentOverviewSearch] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageSearching, setImageSearching] = useState(false);
  const [imageSearchInfo, setImageSearchInfo] = useState<string | null>(null);
  const [imageOptions, setImageOptions] = useState<ImageOption[]>([]);
  const [imageSavingUrl, setImageSavingUrl] = useState<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [guideSearch, setGuideSearch] = useState("");
  const [guestGuideName, setGuestGuideName] = useState("");
  const [guestStudentName, setGuestStudentName] = useState("");
  const [overviewGuestName, setOverviewGuestName] = useState("");
  const [overviewGuestTargetEventId, setOverviewGuestTargetEventId] = useState("");
  const [overviewGuestTransferTargets, setOverviewGuestTransferTargets] = useState<Record<string, string>>({});
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("rocnik-stupen");
  const [studentToAdd, setStudentToAdd] = useState("");
  const [studentAddQuery, setStudentAddQuery] = useState("");
  const [studentAddMenuOpen, setStudentAddMenuOpen] = useState(false);
  const [moveDialog, setMoveDialog] = useState<MoveDialogState | null>(null);
  const [moveDialogTargetId, setMoveDialogTargetId] = useState("");
  const [overviewTargets, setOverviewTargets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTerm = terms.find((term) => term.id === selectedTermId) ?? terms[0] ?? null;
  const selectedEvent = selectedTerm?.events.find((event) => event.id === selectedEventId) ?? null;
  const selectedTermSyncId = selectedTerm?.id ?? "";
  const selectedEventSyncId = selectedEvent?.id ?? "";
  const selectedTermRef = useRef<Term | null>(null);
  const selectedEventRef = useRef<OstrovEvent | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveLastSignatureRef = useRef<string | null>(null);
  const autoSavePendingSignatureRef = useRef<string | null>(null);
  const autoSaveRequestRef = useRef(0);
  selectedTermRef.current = selectedTerm;
  selectedEventRef.current = selectedEvent;
  const selectedEventDraftSignature = selectedEventSyncId && selectedTermSyncId
    ? eventPayloadSignature(selectedTermSyncId, eventDraft)
    : null;
  const selectedEventDraftCanSave = Boolean(selectedEvent && selectedEventDraftSignature);
  const selectedEventDraftHasChanges = Boolean(
    selectedEventDraftSignature && selectedEventDraftSignature !== autoSaveLastSignatureRef.current,
  );
  const selectedEventSaveDisabled = (
    saving ||
    autoSaveState === "saving" ||
    !selectedEventDraftCanSave ||
    !selectedEventDraftHasChanges
  );
  const selectedEventSaveTitle = !selectedEventDraftCanSave
    ? "Zkontrolujte název, kapacitu a termíny zápisu."
    : !selectedEventDraftHasChanges
      ? "Není co uložit."
      : undefined;
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const selectedGuides = useMemo(() => guideDraftItems(eventDraft.guides), [eventDraft.guides]);
  const selectedGuidePersonIds = useMemo(
    () => new Set(selectedGuides.map((guide) => guide.personId).filter((personId): personId is string => Boolean(personId))),
    [selectedGuides],
  );
  const selectedAudienceGroups = useMemo(() => parseAudienceGroups(eventDraft.audienceGroups), [eventDraft.audienceGroups]);
  const selectedAudienceKeys = useMemo(() => new Set(selectedAudienceGroups.map(audienceGroupKey)), [selectedAudienceGroups]);
  const effectiveSelectedAudienceKeys = useMemo(() => {
    const keys = new Set(selectedAudienceKeys);
    for (const group of selectedAudienceGroups) {
      if (group.kind.trim().toLowerCase() !== "stupen") continue;
      for (const rocnikCode of rocnikCodesForStupen(group.code)) {
        keys.add(audienceGroupKey({ kind: "rocnik", code: rocnikCode }));
      }
    }
    return keys;
  }, [selectedAudienceGroups, selectedAudienceKeys]);
  const groupOptionByKey = useMemo(() => new Map(groupOptions.map((group) => [audienceGroupKey(group), group])), [groupOptions]);
  const activeAudienceMode = AUDIENCE_MODES.find((mode) => mode.value === audienceMode) ?? AUDIENCE_MODES[0];
  const visibleAudienceOptions = useMemo(() => {
    const visibleKinds = new Set(activeAudienceMode.kinds);
    return groupOptions.filter((option) => visibleKinds.has(option.kind));
  }, [activeAudienceMode, groupOptions]);
  const groupedVisibleAudienceOptions = useMemo(() => {
    const groups = new Map<string, AudienceGroupOption[]>();
    for (const option of visibleAudienceOptions) {
      const items = groups.get(option.kind) ?? [];
      items.push(option);
      groups.set(option.kind, items);
    }
    return [...groups.entries()];
  }, [visibleAudienceOptions]);
  const filteredGuideOptions = useMemo(() => {
    const query = normalizeSearchValue(guideSearch.trim());
    return guideOptions
      .filter((guide) => !selectedGuidePersonIds.has(guide.id))
      .filter((guide) => {
        if (!query) return true;
        return normalizeSearchValue(
          `${guide.displayName} ${guide.legalName} ${guide.email ?? ""} ${guide.identifier ?? ""}`,
        ).includes(query);
      })
      .slice(0, 8);
  }, [guideOptions, guideSearch, selectedGuidePersonIds]);
  const guideOptionById = useMemo(() => new Map(guideOptions.map((guide) => [guide.id, guide])), [guideOptions]);
  const eligibleStudentsForSelectedEvent = useMemo(() => {
    return students
      .filter((student) => (selectedEvent ? studentCanJoinEvent(student, selectedEvent) : true))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "cs"));
  }, [selectedEvent, students]);
  const studentAddSuggestions = useMemo(() => {
    const query = normalizeSearchValue(studentAddQuery.trim());
    return eligibleStudentsForSelectedEvent
      .filter((student) => (query ? studentSearchIndex(student).includes(query) : true))
      .slice(0, 14);
  }, [eligibleStudentsForSelectedEvent, studentAddQuery]);
  const studentsWithRegistrationCount = useMemo(
    () => students.filter((student) => student.currentRegistration !== null).length,
    [students],
  );
  const studentsWithoutRegistrationCount = Math.max(students.length - studentsWithRegistrationCount, 0);
  const eligibleEventIdsByStudent = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const termEvents = selectedTerm?.events ?? [];
    for (const student of students) {
      const allowed = new Set<string>();
      for (const event of termEvents) {
        if (studentCanJoinEvent(student, event)) allowed.add(event.id);
      }
      map.set(student.id, allowed);
    }
    return map;
  }, [selectedTerm?.events, students]);
  const moveDialogOptions = useMemo(() => {
    if (!moveDialog || !selectedTerm) return [];
    if (moveDialog.kind === "student") {
      const allowed = eligibleEventIdsByStudent.get(moveDialog.personId) ?? new Set<string>();
      return selectedTerm.events.filter((event) => (
        event.id !== moveDialog.sourceEventId &&
        allowed.has(event.id) &&
        hasCapacity(event)
      ));
    }
    return selectedTerm.events.filter((event) => event.id !== moveDialog.sourceEventId && hasCapacity(event));
  }, [eligibleEventIdsByStudent, moveDialog, selectedTerm]);
  const eventStatsById = useMemo(() => {
    const stats = new Map<string, { capacity: number | null; registered: number; unregistered: number; eligible: number }>();
    for (const event of selectedTerm?.events ?? []) {
      const eligible = students.filter((student) => studentCanJoinEvent(student, event)).length;
      const registered = eventRegisteredChildrenCount(event);
      const capacity = event.registrationPolicy?.capacity ?? null;
      const maxForUnregistered = capacity ?? eligible;
      const unregistered = Math.max(maxForUnregistered - registered, 0);
      stats.set(event.id, { capacity, registered, unregistered, eligible });
    }
    return stats;
  }, [selectedTerm?.events, students]);
  const termCapacity = useMemo(() => {
    const capacities = (selectedTerm?.events ?? []).map((event) => event.registrationPolicy?.capacity ?? null);
    if (capacities.length === 0) return null;
    if (capacities.some((capacity) => capacity == null)) return null;
    const finiteCapacities = capacities.filter((capacity): capacity is number => capacity != null);
    return finiteCapacities.reduce((sum, capacity) => sum + capacity, 0);
  }, [selectedTerm?.events]);
  const filteredStudentsForOverview = useMemo(() => {
    const query = normalizeSearchValue(studentOverviewSearch.trim());
    return students
      .filter((student) => (query ? studentSearchIndex(student).includes(query) : true))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "cs"));
  }, [studentOverviewSearch, students]);
  const groupedStudentsForOverview = useMemo(() => {
    const groups = new Map<string, { label: string; sortGrade: number; sortPack: string; students: Student[] }>();
    for (const student of filteredStudentsForOverview) {
      const rocnikCode = student.rocnik?.trim() ?? "";
      const rocnikSort = /^\d+$/.test(rocnikCode) ? Number(rocnikCode) : 999;
      const smeckaName = student.smecka?.trim() || "Nezařazené";
      if (studentOverviewGroupBy === "rocnik") {
        const label = formatRocnikLabel(student.rocnik);
        const key = `rocnik:${rocnikCode || "__none"}`;
        const group = groups.get(key) ?? { label, sortGrade: rocnikSort, sortPack: "", students: [] };
        group.students.push(student);
        groups.set(key, group);
        continue;
      }
      const key = `smecka:${normalizeSearchValue(smeckaName)}`;
      const label = smeckaName;
      const group = groups.get(key) ?? { label, sortGrade: rocnikSort, sortPack: normalizeSearchValue(smeckaName), students: [] };
      group.sortGrade = Math.min(group.sortGrade, rocnikSort);
      group.students.push(student);
      groups.set(key, group);
    }
    return [...groups.values()]
      .sort((a, b) => {
        if (a.sortGrade !== b.sortGrade) return a.sortGrade - b.sortGrade;
        return a.sortPack.localeCompare(b.sortPack, "cs");
      })
      .map((group) => ({
        label: group.label,
        students: group.students.sort((a, b) => {
          const aGrade = /^\d+$/.test(a.rocnik?.trim() ?? "") ? Number(a.rocnik?.trim()) : 999;
          const bGrade = /^\d+$/.test(b.rocnik?.trim() ?? "") ? Number(b.rocnik?.trim()) : 999;
          if (aGrade !== bGrade) return aGrade - bGrade;
          return a.displayName.localeCompare(b.displayName, "cs");
        }),
      }));
  }, [filteredStudentsForOverview, studentOverviewGroupBy]);
  const filteredGuestsForOverview = useMemo(() => {
    const query = normalizeSearchValue(studentOverviewSearch.trim());
    const rows: OverviewGuestRow[] = [];
    for (const event of selectedTerm?.events ?? []) {
      const guests = guestChildrenFromEvent(event);
      guests.forEach((guestName, guestIndex) => {
        const trimmedName = guestName.trim();
        if (!trimmedName) return;
        const searchable = normalizeSearchValue(`${trimmedName} ${event.title}`);
        if (query && !searchable.includes(query)) return;
        rows.push({
          key: `${event.id}:${guestIndex}:${trimmedName.toLowerCase()}`,
          eventId: event.id,
          eventTitle: event.title,
          guestIndex,
          name: trimmedName,
        });
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name, "cs"));
  }, [selectedTerm?.events, studentOverviewSearch]);

  const loadTerms = useCallback(async () => {
    const from = encodeURIComponent(new Date().toISOString());
    const body = await fetch(`/api/ostrovy/guide/terms?from=${from}`).then((res) => readJson<{ terms: Term[] }>(res));
    setTerms(body.terms);
    setSelectedTermId((current) => {
      if (current && body.terms.some((term) => term.id === current)) return current;
      return body.terms[0]?.id ?? "";
    });
  }, []);

  const loadStudents = useCallback(async (termId: string) => {
    if (!termId) {
      setStudents([]);
      return;
    }
    const body = await fetch(`/api/ostrovy/guide/students?termId=${encodeURIComponent(termId)}`)
      .then((res) => readJson<{ students: Student[] }>(res));
    setStudents(body.students);
  }, []);

  const loadOptions = useCallback(async () => {
    const body = await fetch("/api/ostrovy/guide/options")
      .then((res) => readJson<{ guides: GuideOption[]; groups: AudienceGroupOption[] }>(res));
    setGuideOptions(body.guides);
    setGroupOptions(body.groups);
  }, []);

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await Promise.all([loadTerms(), loadOptions()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se načíst Ostrovy.");
    } finally {
      setLoading(false);
    }
  }, [loadOptions, loadTerms]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedTerm?.id) return;
    void loadStudents(selectedTerm.id).catch((err) => setError(err instanceof Error ? err.message : "Nepodařilo se načíst děti."));
  }, [loadStudents, selectedTerm?.id]);

  useEffect(() => {
    if (!selectedTerm) {
      setEditTermStartsAt("");
      setEditTermEndsAt("");
      setEditTermDurationHours("");
      return;
    }

    const startsAt = toLocalInputValue(selectedTerm.startsAt);
    const endsAt = toLocalInputValue(selectedTerm.endsAt);
    setEditTermStartsAt(startsAt);
    setEditTermEndsAt(endsAt);
    setEditTermDurationHours(formatDurationHours(startsAt, endsAt));
  }, [selectedTerm]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setImageSearchInfo(null);
    setImageOptions([]);
    setAutoSaveState("idle");
    setAutoSaveError(null);

    const event = selectedEventRef.current;
    const term = selectedTermRef.current;
    if (event) {
      const nextDraft = makeDraftFromEvent(event);
      setEventDraft(nextDraft);
      autoSaveLastSignatureRef.current = term?.id ? eventPayloadSignature(term.id, nextDraft) : null;
      return;
    }

    autoSaveLastSignatureRef.current = null;
    setEventDraft(makeDraftForNewEvent(term));
  }, [selectedEventSyncId, selectedTermSyncId]);

  async function runAction(action: () => Promise<void>, success: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await loadTerms();
      if (selectedTerm?.id) await loadStudents(selectedTerm.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operace se nepodařila.");
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(field: keyof EventDraft, value: string) {
    setEventDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === "thumbnailUrl" ? { thumbnailSourceImageUrl: "", thumbnailSourceUrl: "" } : {}),
    }));
  }

  const mergeEventIntoSelectedTerm = useCallback((event: OstrovEvent) => {
    if (!selectedTermSyncId) return;
    setTerms((current) => current.map((term) => {
      if (term.id !== selectedTermSyncId) return term;
      return {
        ...term,
        events: term.events.map((item) => (item.id === event.id ? event : item)),
      };
    }));
  }, [selectedTermSyncId]);

  const persistExistingEventDraft = useCallback(async (
    draft: EventDraft,
    options: { force?: boolean; successMessage?: string } = {},
  ): Promise<OstrovEvent | null> => {
    if (!selectedEventSyncId || !selectedTermSyncId) return null;

    const payload = buildEventPayload(selectedTermSyncId, draft);
    if (!payload) {
      setAutoSaveState("idle");
      setAutoSaveError(null);
      if (options.force) throw new Error("Zkontrolujte název, kapacitu a termíny zápisu.");
      return null;
    }

    const signature = JSON.stringify(payload);
    if (!options.force && (
      signature === autoSaveLastSignatureRef.current ||
      signature === autoSavePendingSignatureRef.current
    )) {
      return null;
    }

    const requestId = autoSaveRequestRef.current + 1;
    autoSaveRequestRef.current = requestId;
    autoSavePendingSignatureRef.current = signature;
    setAutoSaveState("saving");
    setAutoSaveError(null);

    try {
      const body = await fetch(`/api/ostrovy/guide/events/${selectedEventSyncId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((res) => readJson<{ event: OstrovEvent }>(res));

      if (requestId === autoSaveRequestRef.current) {
        autoSaveLastSignatureRef.current = signature;
        if (autoSavePendingSignatureRef.current === signature) autoSavePendingSignatureRef.current = null;
        setAutoSaveState("saved");
        setAutoSaveError(null);
        if (options.successMessage) setMessage(options.successMessage);
      }
      mergeEventIntoSelectedTerm(body.event);
      return body.event;
    } catch (err) {
      if (requestId === autoSaveRequestRef.current) {
        if (autoSavePendingSignatureRef.current === signature) autoSavePendingSignatureRef.current = null;
        setAutoSaveState("error");
        setAutoSaveError(err instanceof Error ? err.message : "Automatické uložení se nepodařilo.");
      }
      throw err;
    }
  }, [mergeEventIntoSelectedTerm, selectedEventSyncId, selectedTermSyncId]);

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (!isEventEditorOpen || !selectedEventSyncId || !selectedTermSyncId) return;

    const signature = eventPayloadSignature(selectedTermSyncId, eventDraft);
    if (!signature) {
      autoSaveRequestRef.current += 1;
      setAutoSaveState("idle");
      setAutoSaveError(null);
      return;
    }
    if (signature === autoSaveLastSignatureRef.current) {
      setAutoSaveState((current) => (current === "error" ? "idle" : current));
      setAutoSaveError(null);
      return;
    }
    if (signature === autoSavePendingSignatureRef.current) {
      setAutoSaveState("saving");
      return;
    }

    setAutoSaveState("idle");
    setAutoSaveError(null);
    autoSaveTimerRef.current = setTimeout(() => {
      void persistExistingEventDraft(eventDraft).catch(() => undefined);
    }, 900);
  }, [eventDraft, isEventEditorOpen, persistExistingEventDraft, selectedEventSyncId, selectedTermSyncId]);

  function selectTerm(termId: string) {
    setSelectedTermId(termId);
    setSelectedEventId(null);
    setIsEventEditorOpen(false);
    setIsStudentOverviewOpen(false);
  }

  function startNewEvent() {
    setSelectedEventId(null);
    setEventDraft(makeDraftForNewEvent(selectedTerm));
    setIsEventEditorOpen(true);
    setIsStudentOverviewOpen(false);
  }

  function selectEvent(termId: string, eventId: string) {
    setSelectedTermId(termId);
    setSelectedEventId(eventId);
    setIsEventEditorOpen(true);
    setIsStudentOverviewOpen(false);
  }

  function openStudentsOverview(termId: string) {
    setSelectedTermId(termId);
    setSelectedEventId(null);
    setIsEventEditorOpen(false);
    setIsStudentOverviewOpen(true);
  }

  function closeEventEditor() {
    setSelectedEventId(null);
    setIsEventEditorOpen(false);
    setIsStudentOverviewOpen(false);
  }

  function applyImageResponse(body: ImageActionResponse) {
    const nextDraft = {
      ...eventDraft,
      thumbnailUrl: body.url,
      thumbnailSourceImageUrl: body.sourceImageUrl ?? "",
      thumbnailSourceUrl: body.sourceUrl ?? "",
    };
    setEventDraft(nextDraft);
    setImageSearchInfo(
      [body.sourceTitle, body.provider, body.license].filter((value) => value && value.trim()).join(" · ") || null,
    );
    if (selectedEventSyncId) {
      void persistExistingEventDraft(nextDraft, { force: true, successMessage: "Obrázek byl uložen k ostrovu." }).catch(() => undefined);
    }
  }

  async function selectImageOption(option: ImageOption) {
    setError(null);
    setMessage(null);
    setImageSavingUrl(option.imageUrl);
    try {
      const body = await fetch("/api/ostrovy/guide/images/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...option,
          title: eventDraft.title,
        }),
      }).then((res) => readJson<ImageActionResponse>(res));
      applyImageResponse(body);
      setMessage(selectedEventSyncId ? "Obrázek byl vybrán, ukládám změnu." : "Obrázek byl vybrán.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Obrázek se nepodařilo uložit.");
    } finally {
      setImageSavingUrl(null);
    }
  }

  async function uploadImageFile(file: File) {
    setImageUploading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("title", eventDraft.title);
      const body = await fetch("/api/ostrovy/guide/images/upload", {
        method: "POST",
        body: formData,
      }).then((res) => readJson<ImageActionResponse>(res));
      setImageOptions([]);
      applyImageResponse(body);
      setMessage(selectedEventSyncId ? "Obrázek byl nahrán, ukládám změnu." : "Obrázek byl nahrán.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Obrázek se nepodařilo nahrát.");
    } finally {
      setImageUploading(false);
    }
  }

  async function findImageForDraft() {
    const title = eventDraft.title.trim();
    const description = eventDraft.description.trim();
    if (!title && !description) {
      setError("Pro hledání obrázku vyplňte název nebo popis.");
      return;
    }

    setImageSearching(true);
    setError(null);
    setMessage(null);
    try {
      const body = await fetch("/api/ostrovy/guide/images/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      }).then((res) => readJson<ImageFindResponse>(res));
      const options = body.options ?? [];
      if (options.length === 0) throw new Error("Codex nenašel žádný použitelný obrázek.");
      setImageOptions(options);
      setImageSearchInfo(null);
      setMessage(options.length > 1 ? "Vyberte jeden z nalezených obrázků." : "Vyberte nalezený obrázek.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Obrázek se nepodařilo najít.");
    } finally {
      setImageSearching(false);
    }
  }

  function setGuideDraftItems(guides: GuideDraftItem[]) {
    updateDraft("guides", serializeGuideItems(guides));
  }

  function addGuide(option: GuideOption) {
    if (selectedGuidePersonIds.has(option.id)) return;
    setGuideDraftItems([...selectedGuides, { personId: option.id, name: option.displayName }]);
    setGuideSearch("");
  }

  function guideDraftLabel(guide: GuideDraftItem): string {
    if (!guide.personId) return guide.name;
    return guideOptionById.get(guide.personId)?.displayName ?? guide.name;
  }

  function addGuestGuide() {
    const name = guestGuideName.trim();
    if (!name) return;
    setGuideDraftItems([...selectedGuides, { name }]);
    setGuestGuideName("");
  }

  function removeGuide(index: number) {
    setGuideDraftItems(selectedGuides.filter((_, itemIndex) => itemIndex !== index));
  }

  function selectStudentToAdd(student: Student) {
    setStudentToAdd(student.id);
    setStudentAddQuery(student.displayName);
    setStudentAddMenuOpen(false);
  }

  function toggleAudienceGroup(option: { kind: string; code: string }) {
    const normalized = normalizedAudienceGroup(option);
    if (!normalized) return;

    const key = audienceGroupKey(normalized);
    const next = new Map(selectedAudienceGroups.map((group) => [audienceGroupKey(group), group]));

    if (normalized.kind === "stupen") {
      const rocnikKeys = rocnikCodesForStupen(normalized.code).map((code) => audienceGroupKey({ kind: "rocnik", code }));
      if (selectedAudienceKeys.has(key)) {
        next.delete(key);
        for (const rocnikKey of rocnikKeys) next.delete(rocnikKey);
      } else {
        for (const rocnikKey of rocnikKeys) next.delete(rocnikKey);
        next.set(key, normalized);
      }
      updateDraft("audienceGroups", serializeAudienceGroups([...next.values()]));
      return;
    }

    if (normalized.kind === "rocnik") {
      const parentStupenCode = stupenCodeForRocnik(normalized.code);
      const parentStupenKey = parentStupenCode ? audienceGroupKey({ kind: "stupen", code: parentStupenCode }) : null;

      if (parentStupenCode && parentStupenKey && selectedAudienceKeys.has(parentStupenKey)) {
        next.delete(parentStupenKey);
        for (const rocnikCode of rocnikCodesForStupen(parentStupenCode)) {
          if (rocnikCode !== normalized.code) {
            next.set(audienceGroupKey({ kind: "rocnik", code: rocnikCode }), { kind: "rocnik", code: rocnikCode });
          }
        }
      } else if (selectedAudienceKeys.has(key)) {
        next.delete(key);
      } else {
        next.set(key, normalized);
      }
      updateDraft("audienceGroups", serializeAudienceGroups([...next.values()]));
      return;
    }

    if (selectedAudienceKeys.has(key)) {
      next.delete(key);
    } else {
      next.set(key, normalized);
    }
    updateDraft("audienceGroups", serializeAudienceGroups([...next.values()]));
  }

  function updateNewTermStart(value: string) {
    const nextEnd = shiftEndByStartDelta(newTermStartsAt, newTermEndsAt, value);
    setNewTermStartsAt(value);
    setNewTermEndsAt(nextEnd);
    setNewTermDurationHours(formatDurationHours(value, nextEnd));
  }

  function updateNewTermEnd(value: string) {
    const nextEnd = clampEndAfterStart(newTermStartsAt, value);
    setNewTermEndsAt(nextEnd);
    setNewTermDurationHours(formatDurationHours(newTermStartsAt, nextEnd));
  }

  function updateNewTermDuration(value: string) {
    setNewTermDurationHours(value);
    const hours = parseDurationHours(value);
    if (hours == null) return;
    const nextEnd = addMinutesToLocalInput(newTermStartsAt, hours * 60);
    setNewTermEndsAt(nextEnd);
  }

  function updateEditTermStart(value: string) {
    const nextEnd = shiftEndByStartDelta(editTermStartsAt, editTermEndsAt, value);
    setEditTermStartsAt(value);
    setEditTermEndsAt(nextEnd);
    setEditTermDurationHours(formatDurationHours(value, nextEnd));
  }

  function updateEditTermEnd(value: string) {
    const nextEnd = clampEndAfterStart(editTermStartsAt, value);
    setEditTermEndsAt(nextEnd);
    setEditTermDurationHours(formatDurationHours(editTermStartsAt, nextEnd));
  }

  function updateEditTermDuration(value: string) {
    setEditTermDurationHours(value);
    const hours = parseDurationHours(value);
    if (hours == null) return;
    const nextEnd = addMinutesToLocalInput(editTermStartsAt, hours * 60);
    setEditTermEndsAt(nextEnd);
  }

  async function createTerm() {
    const startsAt = localInputToIso(newTermStartsAt);
    const endsAt = localInputToIso(newTermEndsAt);
    if (!startsAt || !endsAt) throw new Error("Vyplňte platný začátek a konec termínu.");
    const body = await fetch("/api/ostrovy/guide/terms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt, endsAt }),
    }).then((res) => readJson<{ term: Term }>(res));
    setSelectedTermId(body.term.id);
    setIsEventEditorOpen(false);
  }

  async function updateSelectedTerm() {
    if (!selectedTerm) throw new Error("Vyberte termín.");
    const startsAt = localInputToIso(editTermStartsAt);
    const endsAt = localInputToIso(editTermEndsAt);
    if (!startsAt || !endsAt) throw new Error("Vyplňte platný začátek a konec termínu.");
    const body = await fetch(`/api/ostrovy/guide/terms/${selectedTerm.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt, endsAt }),
    }).then((res) => readJson<{ term: Term }>(res));
    setSelectedTermId(body.term.id);
  }

  async function saveEvent() {
    if (!selectedTerm) throw new Error("Vyberte termín.");
    const registrationOpensAt = localInputToIso(eventDraft.registrationOpensAt);
    const registrationClosesAt = localInputToIso(eventDraft.registrationClosesAt);
    const payload = {
      termId: selectedTerm.id,
      title: eventDraft.title,
      description: eventDraft.description || null,
      location: eventDraft.location || null,
      capacity: eventDraft.capacity.trim() ? Number(eventDraft.capacity) : null,
      registrationOpensAt,
      registrationClosesAt,
      focus: eventDraft.focus || null,
      thumbnailUrl: eventDraft.thumbnailUrl || null,
      thumbnailSourceImageUrl: eventDraft.thumbnailSourceImageUrl || null,
      thumbnailSourceUrl: eventDraft.thumbnailSourceUrl || null,
      guides: parseGuides(eventDraft.guides),
      audienceGroups: parseAudienceGroups(eventDraft.audienceGroups),
    };
    const url = selectedEvent ? `/api/ostrovy/guide/events/${selectedEvent.id}` : "/api/ostrovy/guide/events";
    const method = selectedEvent ? "PATCH" : "POST";
    const body = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((res) => readJson<{ event: OstrovEvent }>(res));
    setSelectedEventId(body.event.id);
    setIsEventEditorOpen(true);
  }

  async function saveExistingEventNow() {
    if (!selectedEventDraftHasChanges) return;
    await persistExistingEventDraft(eventDraft, { force: true });
  }

  async function cancelEvent(eventId: string) {
    await fetch(`/api/ostrovy/guide/events/${eventId}`, { method: "DELETE" }).then((res) => readJson(res));
    if (selectedEventId === eventId) closeEventEditor();
  }

  async function cancelTermWithEvents(termId: string) {
    await fetch(`/api/ostrovy/guide/terms/${termId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: "cancel_with_events" }),
    }).then((res) => readJson(res));
    if (selectedTermId === termId) setSelectedTermId("");
    setSelectedEventId(null);
    setIsEventEditorOpen(false);
  }

  async function moveAndCancelTerm(termId: string) {
    if (!termMoveTargetId) throw new Error("Vyberte cílový termín.");
    await fetch(`/api/ostrovy/guide/terms/${termId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: "move_events", targetTermId: termMoveTargetId }),
    }).then((res) => readJson(res));
    setSelectedTermId(termMoveTargetId);
    setSelectedEventId(null);
    setIsEventEditorOpen(false);
    setTermMoveTargetId("");
  }

  async function registerStudent(eventId: string, personId: string, allowTransfer: boolean) {
    await fetch(`/api/ostrovy/guide/events/${eventId}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, action: "register", allowTransfer }),
    }).then((res) => readJson(res));
    setStudentToAdd("");
    setStudentAddQuery("");
    setStudentAddMenuOpen(false);
  }

  async function unregisterStudent(eventId: string, personId: string) {
    await fetch(`/api/ostrovy/guide/events/${eventId}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, action: "unregister" }),
    }).then((res) => readJson(res));
  }

  async function patchGuestChildren(eventId: string, guestChildren: string[]) {
    const body = await fetch(`/api/ostrovy/guide/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestChildren }),
    }).then((res) => readJson<{ event: OstrovEvent }>(res));
    mergeEventIntoSelectedTerm(body.event);
  }

  function eventById(eventId: string): OstrovEvent | null {
    return selectedTerm?.events.find((event) => event.id === eventId) ?? null;
  }

  async function addGuestStudentToEvent(eventId: string, name: string) {
    const event = eventById(eventId);
    if (!event) throw new Error("Vyberte ostrov pro hosta.");
    await patchGuestChildren(event.id, [...guestChildrenFromEvent(event), name]);
  }

  async function removeGuestStudentFromEvent(eventId: string, guestIndex: number) {
    const event = eventById(eventId);
    if (!event) throw new Error("Vybraný ostrov už neexistuje.");
    await patchGuestChildren(event.id, guestChildrenFromEvent(event).filter((_, index) => index !== guestIndex));
  }

  async function moveGuestStudentBetweenEvents(sourceEventId: string, guestIndex: number, targetEventId: string) {
    if (sourceEventId === targetEventId) return;
    const sourceEvent = eventById(sourceEventId);
    const targetEvent = eventById(targetEventId);
    if (!sourceEvent || !targetEvent) throw new Error("Zdrojový nebo cílový ostrov už neexistuje.");

    const sourceGuests = [...guestChildrenFromEvent(sourceEvent)];
    const movedName = sourceGuests[guestIndex];
    if (!movedName) throw new Error("Host už na zdrojovém ostrově není.");

    sourceGuests.splice(guestIndex, 1);
    const targetGuests = [...guestChildrenFromEvent(targetEvent), movedName];

    await patchGuestChildren(sourceEvent.id, sourceGuests);
    await patchGuestChildren(targetEvent.id, targetGuests);
  }

  function addGuestStudent() {
    const name = guestStudentName.trim();
    if (!name || !selectedEvent) return;
    void runAction(
      () => addGuestStudentToEvent(selectedEvent.id, name),
      "Host byl přidán.",
    );
    setGuestStudentName("");
  }

  function removeGuestStudent(index: number) {
    if (!selectedEvent) return;
    void runAction(
      () => removeGuestStudentFromEvent(selectedEvent.id, index),
      "Host byl odebrán.",
    );
  }

  function openStudentMoveDialog(personId: string, label: string) {
    if (!selectedEvent) return;
    setMoveDialog({
      kind: "student",
      personId,
      sourceEventId: selectedEvent.id,
      label,
    });
    setMoveDialogTargetId("");
  }

  function openGuestMoveDialog(guestIndex: number, label: string) {
    if (!selectedEvent) return;
    setMoveDialog({
      kind: "guest",
      guestIndex,
      sourceEventId: selectedEvent.id,
      label,
    });
    setMoveDialogTargetId("");
  }

  function closeMoveDialog() {
    setMoveDialog(null);
    setMoveDialogTargetId("");
  }

  async function submitMoveDialog() {
    if (!moveDialog || !moveDialogTargetId) return;
    if (moveDialog.kind === "student") {
      await registerStudent(moveDialogTargetId, moveDialog.personId, true);
      return;
    }
    await moveGuestStudentBetweenEvents(moveDialog.sourceEventId, moveDialog.guestIndex, moveDialogTargetId);
  }

  const registeredRows = selectedEvent?.registrations
    .filter((registration) => registration.status === "REGISTERED" || registration.status === "WAITLIST")
    .map((registration) => ({
      registration,
      student: studentById.get(registration.personId),
    })) ?? [];

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#D6DFF0] bg-white p-5 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" />
        Načítám Ostrovy.
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header className="sv-section-header flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="sv-eyebrow text-[#C8372D]">Průvodce</p>
          <h1 className="sv-display-md mt-1 text-[#0E2A5C]">Správa ostrovů</h1>
          <p className="mt-2 text-sm text-[#4A5A7C]">Termíny, nabídka ostrovů a zápisy dětí.</p>
        </div>
        <Button
          type="button"
          variant={showTermManagement ? "default" : "outline"}
          className={showTermManagement ? "bg-[#0E2A5C] text-white hover:bg-[#07173A]" : ""}
          onClick={() => setShowTermManagement((current) => !current)}
        >
          <CalendarPlus />
          Správa termínů
        </Button>
      </header>

      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {showTermManagement && (
        <Card className="border-[#D6DFF0]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#0E2A5C]">Správa termínů</CardTitle>
            <CardDescription>Založení, změna nebo zrušení termínu je schované mimo běžnou práci s ostrovy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border border-[#D6DFF0] bg-[#EEF2F7] p-3">
              <div className="mb-3 text-sm font-semibold text-[#0E2A5C]">Založit nový termín</div>
              <div className="grid gap-3 md:grid-cols-[1fr_8rem_1fr_auto]">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">Začátek</span>
                  <Input type="datetime-local" value={newTermStartsAt} onChange={(event) => updateNewTermStart(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">Délka</span>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    inputMode="decimal"
                    value={newTermDurationHours}
                    onChange={(event) => updateNewTermDuration(event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">Konec</span>
                  <Input
                    type="datetime-local"
                    min={newTermStartsAt}
                    value={newTermEndsAt}
                    onChange={(event) => updateNewTermEnd(event.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  className="self-end bg-[#0E2A5C] text-white hover:bg-[#07173A]"
                  disabled={saving}
                  onClick={() => void runAction(createTerm, "Termín byl založen.")}
                >
                  <CalendarPlus />
                  Založit
                </Button>
              </div>
            </div>

            {selectedTerm && (
              <div className="rounded-md border border-[#D6DFF0] bg-white p-3">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[#0E2A5C]">Upravit vybraný termín</div>
                    <div className="text-xs text-slate-500">{formatTermName(selectedTerm)}</div>
                  </div>
                  <Badge variant="outline">{selectedTerm.events.length} ostrovů</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_8rem_1fr_auto]">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">Začátek</span>
                    <Input type="datetime-local" value={editTermStartsAt} onChange={(event) => updateEditTermStart(event.target.value)} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">Délka</span>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      inputMode="decimal"
                      value={editTermDurationHours}
                      onChange={(event) => updateEditTermDuration(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">Konec</span>
                    <Input
                      type="datetime-local"
                      min={editTermStartsAt}
                      value={editTermEndsAt}
                      onChange={(event) => updateEditTermEnd(event.target.value)}
                    />
                  </label>
                  <Button
                    type="button"
                    className="self-end bg-[#0E2A5C] text-white hover:bg-[#07173A]"
                    disabled={saving}
                    onClick={() => void runAction(updateSelectedTerm, "Termín byl uložen.")}
                  >
                    <Save />
                    Uložit
                  </Button>
                </div>

                <div className="mt-4 grid gap-2 border-t border-[#EDF2F8] pt-4 lg:grid-cols-[1fr_auto_auto]">
                  {selectedTerm.events.length > 0 && (
                    <>
                      <select
                        className="h-10 rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
                        value={termMoveTargetId}
                        onChange={(event) => setTermMoveTargetId(event.target.value)}
                      >
                        <option value="">Přesunout ostrovy do termínu...</option>
                        {terms.filter((item) => item.id !== selectedTerm.id).map((item) => (
                          <option key={item.id} value={item.id}>{formatTermName(item)}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        onClick={() => void runAction(() => moveAndCancelTerm(selectedTerm.id), "Termín byl zrušen a ostrovy přesunuty.")}
                      >
                        Přesunout a zrušit termín
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#C8372D] text-[#C8372D] hover:bg-[#FAEAE9]"
                    disabled={saving}
                    onClick={() => void runAction(() => cancelTermWithEvents(selectedTerm.id), "Termín byl zrušen.")}
                  >
                    <Trash2 />
                    Zrušit včetně ostrovů
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-[#D6DFF0]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#0E2A5C]">Termíny a ostrovy</CardTitle>
          <CardDescription>Vyberte termín a potom ostrov v daném termínu.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(420px,1.2fr)]">
          <section className="space-y-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Nadcházející termíny</div>
            {terms.length === 0 && (
              <p className="rounded-lg bg-[#EEF2F7] p-4 text-sm text-slate-500">Zatím není založený žádný termín. Použijte Správu termínů.</p>
            )}
            {terms.map((term) => (
              <button
                key={term.id}
                type="button"
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm",
                  selectedTerm?.id === term.id ? "border-[#0E2A5C] bg-[#EEF2F7]" : "border-slate-200 bg-white hover:bg-[#EEF2F7]",
                )}
                onClick={() => selectTerm(term.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#0E2A5C]">{formatTermName(term)}</span>
                  <span className="block text-xs text-slate-500">{formatDateTime(term.startsAt)} - {formatDateTime(term.endsAt)}</span>
                </span>
                <Badge variant="outline">{term.events.length}</Badge>
              </button>
            ))}
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Ostrovy ve vybraném termínu</div>
                <div className="text-sm font-semibold text-[#0E2A5C]">
                  {selectedTerm ? formatTermName(selectedTerm) : "Bez termínu"}
                </div>
              </div>
              <Button
                type="button"
                className="bg-[#0E2A5C] text-white hover:bg-[#07173A]"
                disabled={!selectedTerm}
                onClick={startNewEvent}
              >
                <Plus />
                Založit ostrov
              </Button>
            </div>

            {!selectedTerm && (
              <p className="rounded-lg bg-[#EEF2F7] p-4 text-sm text-slate-500">Vyberte nebo založte termín.</p>
            )}
            {selectedTerm && (
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm",
                  isStudentOverviewOpen
                    ? "border-[#0E2A5C] bg-[#EEF2F7] text-[#0E2A5C]"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-[#EEF2F7]",
                )}
                onClick={() => openStudentsOverview(selectedTerm.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">Všechny děti a zápisy</span>
                  <span className="block text-xs text-slate-500">Přehled zápisů v termínu</span>
                </span>
                <span className="shrink-0 text-right text-xs text-slate-500">
                  <span>Kapacita {termCapacity ?? "bez limitu"}</span>
                  <span className="mx-1.5">·</span>
                  <span>Zapsáno {studentsWithRegistrationCount}</span>
                  <span className="mx-1.5">·</span>
                  <span>Nezapsáno {studentsWithoutRegistrationCount}</span>
                </span>
              </button>
            )}
            {selectedTerm && selectedTerm.events.length === 0 && (
              <p className="rounded-lg border border-dashed border-[#D6DFF0] bg-[#EEF2F7] p-4 text-sm text-slate-500">
                V tomto termínu zatím nejsou založené žádné ostrovy.
              </p>
            )}
            {selectedTerm?.events.map((event) => (
              <button
                key={event.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm",
                  selectedEvent?.id === event.id ? "border-[#0E2A5C] bg-[#EEF2F7] text-[#0E2A5C]" : "border-slate-200 bg-white text-slate-700 hover:bg-[#EEF2F7]",
                )}
                onClick={() => selectEvent(selectedTerm.id, event.id)}
              >
                <span className="min-w-0 flex items-center gap-2">
                  {event.kioskDisplayNumber != null && event.kioskDisplayColor && (
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                      style={{ backgroundColor: event.kioskDisplayColor }}
                    >
                      {event.kioskDisplayNumber}
                    </span>
                  )}
                  <span>
                    <span className="block truncate font-medium">{event.title}</span>
                    <span className="block text-xs text-slate-500">
                      {focusLabel(eventFocus(event))}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-slate-500">
                  <span>Kapacita {eventStatsById.get(event.id)?.capacity ?? "bez limitu"}</span>
                  <span className="mx-1.5">·</span>
                  <span>Zapsáno {eventStatsById.get(event.id)?.registered ?? 0}</span>
                  <span className="mx-1.5">·</span>
                  <span>Nezapsáno {eventStatsById.get(event.id)?.unregistered ?? 0}</span>
                </span>
                {!event.isActive && <Badge variant="outline">zrušený</Badge>}
              </button>
            ))}
          </section>
        </CardContent>
      </Card>

      <Card className="border-[#D6DFF0]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#0E2A5C]">
            {isStudentOverviewOpen ? "Přehled zápisů dětí" : isEventEditorOpen ? (selectedEvent ? "Detail ostrova" : "Nový ostrov") : "Detail ostrova"}
          </CardTitle>
          <CardDescription>{selectedTerm ? formatTermName(selectedTerm) : "Nejdříve vyberte nebo založte termín."}</CardDescription>
        </CardHeader>
        <CardContent>
          {isStudentOverviewOpen ? (
            <div className="space-y-4">
              <div className="rounded-md border border-[#D6DFF0] bg-[#EEF2F7] p-3">
                <div className="text-sm font-semibold text-[#0E2A5C]">Všechny děti ve vybraném termínu</div>
                <div className="text-xs text-slate-500">
                  Zapsáno {studentsWithRegistrationCount} z {students.length} dětí
                </div>
              </div>
              <div className="grid gap-2 rounded-md border border-[#D6DFF0] bg-white p-3 md:grid-cols-[minmax(220px,1fr)_auto]">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">Vyhledat dítě</span>
                  <Input
                    value={studentOverviewSearch}
                    onChange={(event) => setStudentOverviewSearch(event.target.value)}
                    placeholder="Jméno, příjmení nebo přezdívka"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">Seskupit podle</span>
                  <select
                    className="h-10 rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
                    value={studentOverviewGroupBy}
                    onChange={(event) => setStudentOverviewGroupBy(event.target.value as StudentOverviewGroupBy)}
                  >
                    <option value="smecka">Smečky</option>
                    <option value="rocnik">Ročníky</option>
                  </select>
                </label>
              </div>
              <div className="space-y-3 rounded-md border border-[#D6DFF0] bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-[#0E2A5C]">Hosté (děti bez účtu)</div>
                    <div className="text-xs text-slate-500">
                      {filteredGuestsForOverview.length > 0
                        ? `${filteredGuestsForOverview.length} hostů v aktuálním filtru`
                        : "Zatím nejsou zapsáni žádní hosté."}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)_auto]">
                  <Input
                    value={overviewGuestName}
                    onChange={(event) => setOverviewGuestName(event.target.value)}
                    placeholder="Jméno hosta"
                  />
                  <select
                    className="h-10 rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
                    value={overviewGuestTargetEventId}
                    onChange={(event) => setOverviewGuestTargetEventId(event.target.value)}
                  >
                    <option value="">Vyberte ostrov...</option>
                    {selectedTerm?.events.map((event) => (
                      <option key={event.id} value={event.id} disabled={!hasCapacity(event)}>
                        {event.title} ({occupancy(event)}/{event.registrationPolicy?.capacity ?? "bez limitu"})
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving || !overviewGuestName.trim() || !overviewGuestTargetEventId}
                    onClick={() => {
                      const trimmedName = overviewGuestName.trim();
                      if (!trimmedName || !overviewGuestTargetEventId) return;
                      void runAction(
                        () => addGuestStudentToEvent(overviewGuestTargetEventId, trimmedName),
                        "Host byl přidán.",
                      );
                      setOverviewGuestName("");
                    }}
                  >
                    <Plus />
                    Přidat hosta
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Host</TableHead>
                      <TableHead>Aktuální zápis</TableHead>
                      <TableHead>Změnit</TableHead>
                      <TableHead className="text-right">Akce</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGuestsForOverview.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-4 text-center text-sm text-slate-500">
                          V aktuálním filtru nejsou žádní hosté.
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredGuestsForOverview.map((guest) => {
                      const target = overviewGuestTransferTargets[guest.key] ?? "";
                      return (
                        <TableRow key={guest.key}>
                          <TableCell>
                            <div className="font-medium text-[#0E2A5C]">{guest.name}</div>
                            <div className="text-xs text-slate-500">Host bez účtu</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-slate-700">{guest.eventTitle}</div>
                          </TableCell>
                          <TableCell>
                            <select
                              className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
                              value={target}
                              onChange={(event) => setOverviewGuestTransferTargets((current) => ({ ...current, [guest.key]: event.target.value }))}
                            >
                              <option value="">Ostrov...</option>
                              {selectedTerm?.events
                                .filter((event) => event.id !== guest.eventId)
                                .map((event) => (
                                  <option key={event.id} value={event.id} disabled={!hasCapacity(event)}>
                                    {event.title} ({occupancy(event)}/{event.registrationPolicy?.capacity ?? "bez limitu"})
                                  </option>
                                ))}
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={saving || !target}
                                onClick={() => void runAction(
                                  () => moveGuestStudentBetweenEvents(guest.eventId, guest.guestIndex, target),
                                  "Host byl přesunut.",
                                )}
                              >
                                Změnit
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-[#C8372D] text-[#C8372D] hover:bg-[#FAEAE9]"
                                disabled={saving}
                                onClick={() => void runAction(
                                  () => removeGuestStudentFromEvent(guest.eventId, guest.guestIndex),
                                  "Host byl odebrán.",
                                )}
                              >
                                Zrušit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-4">
                {groupedStudentsForOverview.length === 0 && (
                  <div className="rounded-lg border border-dashed border-[#D6DFF0] bg-[#EEF2F7] p-4 text-sm text-slate-500">
                    Žádné dítě neodpovídá aktuálnímu filtru.
                  </div>
                )}
                {groupedStudentsForOverview.map((group) => (
                  <div key={group.label} className="space-y-2 rounded-md border border-[#D6DFF0] bg-white p-3">
                    <div className="text-sm font-semibold text-[#0E2A5C]">{group.label}</div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dítě</TableHead>
                          <TableHead>Aktuální zápis</TableHead>
                          <TableHead>Změnit</TableHead>
                          <TableHead className="text-right">Akce</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.students.map((student) => {
                          const target = overviewTargets[student.id] ?? student.currentRegistration?.eventId ?? "";
                          const eligibleEventIds = eligibleEventIdsByStudent.get(student.id) ?? new Set<string>();
                          return (
                            <TableRow key={student.id}>
                              <TableCell>
                                <div className="font-medium text-[#0E2A5C]">{student.displayName}</div>
                                <div className="text-xs text-slate-500">{formatStudentGroupMeta(student)}</div>
                              </TableCell>
                              <TableCell>
                                {student.currentRegistration ? (
                                  <div className="space-y-1">
                                    <div className="text-sm text-slate-700">{student.currentRegistration.eventTitle}</div>
                                    <Badge className="bg-[#0E2A5C] text-white hover:bg-[#0E2A5C]">
                                      {registrationStatusLabel(student.currentRegistration.status)}
                                    </Badge>
                                  </div>
                                ) : (
                                  <Badge variant="outline">Nezapsáno</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <select
                                  className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
                                  value={target}
                                  onChange={(event) => setOverviewTargets((current) => ({ ...current, [student.id]: event.target.value }))}
                                >
                                  <option value="">Ostrov...</option>
                                  {selectedTerm?.events.map((event) => (
                                    <option
                                      key={event.id}
                                      value={event.id}
                                      disabled={
                                        !eligibleEventIds.has(event.id) ||
                                        (!hasCapacity(event) && event.id !== student.currentRegistration?.eventId)
                                      }
                                    >
                                      {event.title} ({occupancy(event)}/{event.registrationPolicy?.capacity ?? "bez limitu"})
                                    </option>
                                  ))}
                                </select>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={saving || !target || target === student.currentRegistration?.eventId || !eligibleEventIds.has(target)}
                                    onClick={() => void runAction(
                                      () => registerStudent(target, student.id, true),
                                      student.currentRegistration ? "Zápis dítěte byl změněn." : "Dítě bylo zapsáno.",
                                    )}
                                  >
                                    {student.currentRegistration ? "Změnit" : "Zapsat"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-[#C8372D] text-[#C8372D] hover:bg-[#FAEAE9]"
                                    disabled={saving || !student.currentRegistration}
                                    onClick={() => {
                                      const currentRegistration = student.currentRegistration;
                                      if (!currentRegistration) return;
                                      void runAction(
                                        () => unregisterStudent(currentRegistration.eventId, student.id),
                                        "Dítě bylo odhlášeno.",
                                      );
                                    }}
                                  >
                                    Zrušit
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </div>
          ) : isEventEditorOpen ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(420px,1.15fr)_minmax(340px,0.85fr)]">
              <section className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span className="font-medium text-slate-700">Název</span>
                    <Input value={eventDraft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="Robotika" />
                  </label>
                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span className="font-medium text-slate-700">Popis</span>
                    <textarea
                      className="min-h-24 rounded-[12px] border border-[#D6DFF0] bg-white px-3 py-2 text-sm text-[#0E2A5C] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
                      value={eventDraft.description}
                      onChange={(event) => updateDraft("description", event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">Místo</span>
                    <Input value={eventDraft.location} onChange={(event) => updateDraft("location", event.target.value)} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">Kapacita</span>
                    <Input type="number" min="1" value={eventDraft.capacity} onChange={(event) => updateDraft("capacity", event.target.value)} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">Zápis od</span>
                    <Input type="datetime-local" value={eventDraft.registrationOpensAt} onChange={(event) => updateDraft("registrationOpensAt", event.target.value)} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">Zápis do</span>
                    <Input type="datetime-local" value={eventDraft.registrationClosesAt} onChange={(event) => updateDraft("registrationClosesAt", event.target.value)} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">Zaměření</span>
                    <select
                      className="h-10 rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
                      value={eventDraft.focus}
                      onChange={(event) => updateDraft("focus", event.target.value)}
                    >
                      {FOCUS_OPTIONS.map((item) => <option key={item.value || "none"} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>

                  <div className="space-y-3 rounded-[20px] border border-[#D6DFF0] bg-white p-4 text-sm shadow-[var(--sv-shadow-paper)] md:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-700">Obrázek</span>
                      {imageSearchInfo && <span className="text-xs text-slate-500">{imageSearchInfo}</span>}
                    </div>
                    {eventDraft.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={eventDraft.thumbnailUrl} alt="" className="h-36 w-full rounded-md object-cover" />
                    ) : (
                      <div className="sv-placeholder h-36 min-h-0 border border-dashed border-[#D6DFF0] text-slate-400">
                        <ImageIcon className="size-6" aria-hidden="true" />
                      </div>
                    )}
                    <div className="grid gap-2 xl:grid-cols-[1fr_auto_auto]">
                      <Input
                        value={eventDraft.thumbnailUrl}
                        onChange={(event) => updateDraft("thumbnailUrl", event.target.value)}
                        placeholder="/uploads/ostrovy/obrazek.jpg"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={imageSearching || (!eventDraft.title.trim() && !eventDraft.description.trim())}
                        onClick={() => void findImageForDraft()}
                      >
                        {imageSearching ? <Loader2 className="animate-spin" /> : <Search />}
                        Najít
                      </Button>
                      <label className={cn(
                        "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#D6DFF0] bg-white px-4 py-2 text-sm font-semibold text-[#0E2A5C] transition hover:border-[#0E2A5C] hover:bg-[#EEF2F7]",
                        imageUploading && "pointer-events-none opacity-60",
                      )}>
                        {imageUploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                        Nahrát
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="sr-only"
                          disabled={imageUploading}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = "";
                            if (file) void uploadImageFile(file);
                          }}
                        />
                      </label>
                    </div>
                    {imageOptions.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-3">
                        {imageOptions.map((option, index) => (
                          <button
                            key={`${option.imageUrl}-${index}`}
                            type="button"
                            className={cn(
                              "group overflow-hidden rounded-[12px] border bg-white text-left shadow-[var(--sv-shadow-paper)] transition hover:border-[#0E2A5C] hover:bg-[#EEF2F7] disabled:cursor-wait disabled:opacity-70",
                              imageSavingUrl === option.imageUrl ? "border-[#0E2A5C] ring-2 ring-[#0E2A5C]/15" : "border-[#D6DFF0]",
                            )}
                            disabled={Boolean(imageSavingUrl)}
                            onClick={() => void selectImageOption(option)}
                          >
                            <span className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={option.previewUrl ?? option.imageUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                              {imageSavingUrl === option.imageUrl && (
                                <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[#0E2A5C]">
                                  <Loader2 className="size-5 animate-spin" />
                                </span>
                              )}
                            </span>
                            <span className="block space-y-1 p-2">
                              <span className="block truncate text-xs font-semibold text-[#0E2A5C]">
                                {option.sourceTitle ?? `Obrázek ${index + 1}`}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {[option.provider, option.license].filter(Boolean).join(" · ") || "Zdroj"}
                              </span>
                              {option.reason && (
                                <span className="line-clamp-2 block text-xs text-slate-500">{option.reason}</span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-[20px] border border-[#D6DFF0] bg-white p-4 text-sm shadow-[var(--sv-shadow-paper)] md:col-span-2">
                    <span className="font-medium text-slate-700">Průvodci</span>
                    {selectedGuides.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedGuides.map((guide, index) => (
                          <Badge key={`${guide.personId ?? guide.name}-${index}`} variant="outline" className="gap-1 border-[#D6DFF0] bg-[#EEF2F7] text-slate-700">
                            {guideDraftLabel(guide)}
                            <button
                              type="button"
                              className="ml-1 rounded-full text-slate-500 hover:text-[#C8372D]"
                              onClick={() => removeGuide(index)}
                              aria-label={`Odebrat ${guideDraftLabel(guide)}`}
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <Input
                        value={guideSearch}
                        onChange={(event) => setGuideSearch(event.target.value)}
                        placeholder="Vyhledat průvodce"
                      />
                      {guideSearch.trim() && (
                        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-[#D6DFF0] bg-white shadow-lg">
                          {filteredGuideOptions.length === 0 && (
                            <div className="px-3 py-2 text-sm text-slate-500">Žádný průvodce</div>
                          )}
                          {filteredGuideOptions.map((guide) => (
                            <button
                              key={guide.id}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#EEF2F7]"
                              onClick={() => addGuide(guide)}
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-[#0E2A5C]">{guide.displayName}</span>
                                {guide.legalName !== guide.displayName && (
                                  <span className="block truncate text-xs text-slate-500">{guide.legalName}</span>
                                )}
                                {guide.email && <span className="block truncate text-xs text-slate-500">{guide.email}</span>}
                              </span>
                              <UserPlus className="size-4 shrink-0 text-slate-500" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input
                        value={guestGuideName}
                        onChange={(event) => setGuestGuideName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          addGuestGuide();
                        }}
                        placeholder="Host bez účtu"
                      />
                      <Button type="button" variant="outline" onClick={addGuestGuide} disabled={!guestGuideName.trim()}>
                        <Plus />
                        Přidat hosta
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-[20px] border border-[#D6DFF0] bg-white p-4 text-sm shadow-[var(--sv-shadow-paper)] md:col-span-2">
                    <span className="font-medium text-slate-700">Cílové skupiny</span>
                    {selectedAudienceGroups.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedAudienceGroups.map((group) => {
                          const option = groupOptionByKey.get(audienceGroupKey(group));
                          const label = option ? groupLabel(option) : `${group.kind}:${group.code}`;
                          return (
                            <Badge key={audienceGroupKey(group)} variant="outline" className="gap-1 border-[#D6DFF0] bg-[#EEF2F7] text-slate-700">
                              {label}
                              <button
                                type="button"
                                className="ml-1 rounded-full text-slate-500 hover:text-[#C8372D]"
                                onClick={() => toggleAudienceGroup(group)}
                                aria-label={`Odebrat ${label}`}
                              >
                                <X className="size-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {AUDIENCE_MODES.map((mode) => (
                        <Button
                          key={mode.value}
                          type="button"
                          variant={audienceMode === mode.value ? "default" : "outline"}
                          size="sm"
                          className={audienceMode === mode.value ? "bg-[#0E2A5C] text-white hover:bg-[#07173A]" : ""}
                          onClick={() => setAudienceMode(mode.value)}
                        >
                          {mode.label}
                        </Button>
                      ))}
                    </div>
                    {groupedVisibleAudienceOptions.length === 0 && (
                      <p className="rounded-md bg-[#EEF2F7] px-3 py-2 text-sm text-slate-500">Žádné aktivní skupiny pro tento režim.</p>
                    )}
                    {groupedVisibleAudienceOptions.map(([kind, options]) => (
                      <div key={kind} className="space-y-2 border-t border-[#EDF2F8] pt-3">
                        <div className="text-xs font-semibold text-[#0E2A5C]">{groupKindLabel(kind)}</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {options.map((option) => (
                            <label key={audienceGroupKey(option)} className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={effectiveSelectedAudienceKeys.has(audienceGroupKey(option))}
                                onChange={() => toggleAudienceGroup(option)}
                                className="size-4 rounded border-[#D6DFF0]"
                              />
                              <span>{groupLabel(option)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedEvent ? (
                    <>
                      <Button
                        type="button"
                        className="bg-[#0E2A5C] text-white hover:bg-[#07173A]"
                        disabled={selectedEventSaveDisabled}
                        title={selectedEventSaveTitle}
                        onClick={() => void runAction(saveExistingEventNow, "Ostrov byl uložen.")}
                      >
                        {autoSaveState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Save />}
                        Uložit
                      </Button>
                      {autoSaveState === "saved" && !selectedEventDraftHasChanges && (
                        <span className="text-sm text-slate-500">Uloženo</span>
                      )}
                      {autoSaveState === "error" && autoSaveError && (
                        <span className="text-sm text-[#C8372D]">{autoSaveError}</span>
                      )}
                    </>
                  ) : (
                    <Button
                      type="button"
                      className="bg-[#0E2A5C] text-white hover:bg-[#07173A]"
                      disabled={saving || !selectedTerm}
                      onClick={() => void runAction(saveEvent, "Ostrov byl založen.")}
                    >
                      <Save />
                      Založit ostrov
                    </Button>
                  )}
                  {selectedEvent && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-[#C8372D] text-[#C8372D] hover:bg-[#FAEAE9]"
                      disabled={saving}
                      onClick={() => void runAction(() => cancelEvent(selectedEvent.id), "Ostrov byl zrušen.")}
                    >
                      <Trash2 />
                      Zrušit ostrov
                    </Button>
                  )}
                  <Button type="button" variant="outline" disabled={saving} onClick={closeEventEditor}>
                    Zavřít
                  </Button>
                </div>
              </section>

              <section className="space-y-3 rounded-md border border-[#D6DFF0] bg-white p-3">
                <div>
                  <div className="text-sm font-semibold text-[#0E2A5C]">Zapsané děti</div>
                  <div className="text-xs text-slate-500">{selectedEvent ? selectedEvent.title : "Zápisy půjde spravovat po uložení ostrova."}</div>
                </div>

                {selectedEvent ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <label className="relative grid gap-1 text-sm">
                        <span className="font-medium text-slate-700">Přidat nebo přesunout dítě</span>
                        <Input
                          value={studentAddQuery}
                          onFocus={() => setStudentAddMenuOpen(true)}
                          onBlur={() => setTimeout(() => setStudentAddMenuOpen(false), 120)}
                          onChange={(event) => {
                            const next = event.target.value;
                            setStudentAddQuery(next);
                            setStudentAddMenuOpen(true);
                            setStudentToAdd("");
                          }}
                          placeholder="Jméno, příjmení nebo přezdívka"
                        />
                        {studentAddMenuOpen && (
                          <div className="absolute z-20 mt-[68px] max-h-60 w-full overflow-auto rounded-md border border-[#D6DFF0] bg-white shadow-lg">
                            {studentAddSuggestions.length === 0 && (
                              <div className="px-3 py-2 text-sm text-slate-500">Žádné dítě neodpovídá zadání.</div>
                            )}
                            {studentAddSuggestions.map((student) => (
                              <button
                                key={student.id}
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-[#EEF2F7]"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  selectStudentToAdd(student);
                                }}
                              >
                                <span className="block truncate font-medium text-[#0E2A5C]">{student.displayName}</span>
                                <span className="block truncate text-xs text-slate-500">
                                  {student.firstName ?? ""} {student.lastName ?? ""} · {formatStudentGroupMeta(student)}
                                  {student.currentRegistration ? ` · ${student.currentRegistration.eventTitle}` : ""}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </label>
                      <Button
                        type="button"
                        className="bg-[#0E2A5C] text-white hover:bg-[#07173A]"
                        disabled={saving || !studentToAdd}
                        onClick={() => void runAction(
                          () => registerStudent(selectedEvent.id, studentToAdd, true),
                          "Zápis dítěte byl uložen.",
                        )}
                      >
                        <UserPlus />
                        Zapsat
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input
                        value={guestStudentName}
                        onChange={(e) => setGuestStudentName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGuestStudent(); } }}
                        placeholder="Host bez účtu"
                      />
                      <Button type="button" variant="outline" onClick={addGuestStudent} disabled={!guestStudentName.trim() || saving}>
                        <Plus />
                        Přidat hosta
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dítě</TableHead>
                          <TableHead className="text-right">Akce</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registeredRows.length === 0 && guestChildrenFromEvent(selectedEvent).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="py-6 text-center text-slate-500">Zatím není nikdo zapsaný.</TableCell>
                          </TableRow>
                        )}
                        {registeredRows.map(({ registration, student }) => {
                          return (
                            <TableRow key={registration.personId}>
                              <TableCell>
                                <div className="font-medium text-[#0E2A5C]">{student?.displayName ?? registration.personId}</div>
                                {student && <div className="text-xs text-slate-500">{formatStudentGroupMeta(student)}</div>}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={saving}
                                    onClick={() => openStudentMoveDialog(registration.personId, student?.displayName ?? registration.personId)}
                                  >
                                    Změnit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-[#C8372D] text-[#C8372D] hover:bg-[#FAEAE9]"
                                    disabled={saving}
                                    onClick={() => void runAction(
                                      () => unregisterStudent(selectedEvent.id, registration.personId),
                                      "Dítě bylo odhlášeno.",
                                    )}
                                  >
                                    Odhlásit
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {guestChildrenFromEvent(selectedEvent).map((name, idx) => (
                          <TableRow key={`guest-${idx}`}>
                            <TableCell>
                              <div className="font-medium text-[#0E2A5C]">{name}</div>
                              <div className="text-xs text-slate-500">host</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={saving}
                                  onClick={() => openGuestMoveDialog(idx, name)}
                                >
                                  Změnit
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="border-[#C8372D] text-[#C8372D] hover:bg-[#FAEAE9]"
                                  disabled={saving}
                                  onClick={() => removeGuestStudent(idx)}
                                >
                                  Odebrat
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                ) : (
                  <p className="rounded-lg border border-dashed border-[#D6DFF0] bg-[#EEF2F7] p-4 text-sm text-slate-500">
                    Nejprve ostrov uložte, potom půjde spravovat zapsané děti.
                  </p>
                )}
              </section>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#D6DFF0] bg-[#EEF2F7] p-6 text-sm text-slate-500">
              Vyberte ostrov ze seznamu pro editaci, nebo použijte tlačítko Založit ostrov v horním okně.
            </div>
          )}
        </CardContent>
      </Card>

      {moveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#D6DFF0] bg-white p-4 shadow-xl">
            <div className="mb-1 text-base font-semibold text-[#0E2A5C]">Změnit ostrov</div>
            <div className="mb-3 text-sm text-slate-600">
              {moveDialog.label}
            </div>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Dostupné ostrovy</span>
              <select
                className="h-10 rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
                value={moveDialogTargetId}
                onChange={(event) => setMoveDialogTargetId(event.target.value)}
              >
                <option value="">Vyberte ostrov...</option>
                {moveDialogOptions.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} ({occupancy(event)}/{event.registrationPolicy?.capacity ?? "bez limitu"})
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeMoveDialog} disabled={saving}>
                Zrušit
              </Button>
              <Button
                type="button"
                className="bg-[#0E2A5C] text-white hover:bg-[#07173A]"
                disabled={saving || !moveDialogTargetId}
                onClick={() => void runAction(
                  async () => {
                    await submitMoveDialog();
                    closeMoveDialog();
                  },
                  moveDialog.kind === "student" ? "Dítě bylo přesunuto." : "Host byl přesunut.",
                )}
              >
                Přesunout
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
