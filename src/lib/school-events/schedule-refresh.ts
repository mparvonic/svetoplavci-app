import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { AppSchoolEventLifecycleStatus } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import { enqueueSchoolEventCalendarSyncJobs } from "@/src/lib/calendar/school-event-sync";

type DbClient = PrismaClient | Prisma.TransactionClient;

interface LinkedLessonInput {
  lessonId: number;
  lessonDate?: Date | null;
  startsAt: Date;
  endsAt: Date;
  title?: string | null;
  location?: string | null;
  rooms?: string[] | null;
  courseId?: number | null;
  courseCode?: string | null;
  teacherPersonId?: number | null;
  roomId?: number | null;
  raw?: Record<string, unknown> | null;
}

export interface RefreshLinkedLessonParams {
  eventId?: string;
  lesson: LinkedLessonInput;
  actorPersonId?: string | null;
  sourceRef?: string | null;
}

interface RefreshEventResult {
  eventId: string;
  updatedTime: boolean;
  skippedTimeByLock: boolean;
  updatedTitle: boolean;
  updatedLocation: boolean;
}

export interface RefreshLinkedLessonResult {
  lessonId: number;
  matchedEvents: number;
  updatedEvents: number;
  skippedTimeByLock: number;
  eventResults: RefreshEventResult[];
  syncEnqueue?: {
    attempted: number;
    succeeded: number;
    failed: Array<{ schoolEventId: string; error: string }>;
  };
}

function sameDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

function resolvedLocation(lesson: LinkedLessonInput): string | null {
  if (lesson.location?.trim()) return lesson.location.trim();
  if (lesson.rooms && lesson.rooms.length > 0) return lesson.rooms.filter(Boolean).join(", ");
  return null;
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function refreshSingleEvent(
  tx: DbClient,
  event: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    title: string;
    location: string | null;
    timeOverrideLock: boolean;
    titleOverrideLock: boolean;
    locationOverrideLock: boolean;
    linkedLessonId: number | null;
    linkedLessonDate: Date | null;
  },
  lesson: LinkedLessonInput,
  now: Date,
  actorPersonId: string | null | undefined,
  sourceRef: string | null | undefined,
): Promise<RefreshEventResult> {
  const nextLocation = resolvedLocation(lesson);

  const updatedTime = !event.timeOverrideLock && (!sameDate(event.startsAt, lesson.startsAt) || !sameDate(event.endsAt, lesson.endsAt));
  const updatedTitle = !event.titleOverrideLock && Boolean(lesson.title?.trim()) && event.title !== lesson.title?.trim();
  const updatedLocation = !event.locationOverrideLock && nextLocation !== null && event.location !== nextLocation;

  await tx.appSchoolEvent.update({
    where: { id: event.id },
    data: {
      startsAt: updatedTime ? lesson.startsAt : undefined,
      endsAt: updatedTime ? lesson.endsAt : undefined,
      title: updatedTitle ? lesson.title?.trim() : undefined,
      location: updatedLocation ? nextLocation : undefined,
      linkedLessonId: lesson.lessonId,
      linkedLessonDate: lesson.lessonDate ?? undefined,
      linkedCourseId: lesson.courseId ?? undefined,
      linkedCourseCode: lesson.courseCode ?? undefined,
      linkedTeacherPersonId: lesson.teacherPersonId ?? undefined,
      linkedRoomId: lesson.roomId ?? undefined,
      linkedLessonSnapshot: toInputJsonValue({
        sourceRef: sourceRef ?? "schedule-refresh",
        refreshedAt: now.toISOString(),
        lessonId: lesson.lessonId,
        lessonDate: lesson.lessonDate?.toISOString().slice(0, 10) ?? null,
        startsAt: lesson.startsAt.toISOString(),
        endsAt: lesson.endsAt.toISOString(),
        title: lesson.title ?? null,
        location: lesson.location ?? null,
        rooms: lesson.rooms ?? null,
        courseId: lesson.courseId ?? null,
        courseCode: lesson.courseCode ?? null,
        teacherPersonId: lesson.teacherPersonId ?? null,
        roomId: lesson.roomId ?? null,
        raw: lesson.raw ?? null,
      }),
      lastLessonRefreshAt: now,
      updatedByPersonId: actorPersonId ?? undefined,
    },
  });

  return {
    eventId: event.id,
    updatedTime,
    skippedTimeByLock: event.timeOverrideLock,
    updatedTitle,
    updatedLocation,
  };
}

export async function refreshLinkedLesson(params: RefreshLinkedLessonParams): Promise<RefreshLinkedLessonResult> {
  const now = new Date();

  const baseResult = await prisma.$transaction(async (tx) => {
    const whereBase = params.eventId
      ? { id: params.eventId }
      : {
          isLinkedToSchedule: true,
          linkedLessonId: params.lesson.lessonId,
          lifecycleStatus: {
            in: [
              AppSchoolEventLifecycleStatus.DRAFT,
              AppSchoolEventLifecycleStatus.PUBLISHED,
              AppSchoolEventLifecycleStatus.REGISTRATION_CLOSED,
            ],
          },
          ...(params.lesson.lessonDate ? { linkedLessonDate: params.lesson.lessonDate } : {}),
        };

    const candidates = await tx.appSchoolEvent.findMany({
      where: whereBase,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        title: true,
        location: true,
        linkedLessonId: true,
        linkedLessonDate: true,
        isLinkedToSchedule: true,
        timeOverrideLock: true,
        titleOverrideLock: true,
        locationOverrideLock: true,
      },
    });

    const eventResults: RefreshEventResult[] = [];
    for (const event of candidates) {
      if (!event.isLinkedToSchedule) continue;
      if (event.linkedLessonId && event.linkedLessonId !== params.lesson.lessonId) continue;
      const result = await refreshSingleEvent(
        tx,
        event,
        params.lesson,
        now,
        params.actorPersonId,
        params.sourceRef,
      );
      eventResults.push(result);
    }

    return {
      lessonId: params.lesson.lessonId,
      matchedEvents: candidates.length,
      updatedEvents: eventResults.length,
      skippedTimeByLock: eventResults.filter((r) => r.skippedTimeByLock).length,
      eventResults,
    };
  });

  const uniqueEventIds = [...new Set(baseResult.eventResults.map((row) => row.eventId))];
  let succeeded = 0;
  const failed: Array<{ schoolEventId: string; error: string }> = [];
  for (const schoolEventId of uniqueEventIds) {
    try {
      await enqueueSchoolEventCalendarSyncJobs({
        schoolEventId,
        sourceRef: params.sourceRef ?? "schedule-refresh",
        priority: 80,
      });
      succeeded += 1;
    } catch (error) {
      failed.push({
        schoolEventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ...baseResult,
    syncEnqueue: {
      attempted: uniqueEventIds.length,
      succeeded,
      failed,
    },
  };
}
