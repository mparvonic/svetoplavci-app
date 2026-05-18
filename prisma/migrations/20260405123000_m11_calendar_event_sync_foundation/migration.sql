-- M11 foundation: Google Calendar sync + dynamic school event types

-- Enums
CREATE TYPE "AppCalendarProvider" AS ENUM ('GOOGLE_WORKSPACE');
CREATE TYPE "AppCalendarTarget" AS ENUM ('STUDENT', 'GROUP', 'BOTH');
CREATE TYPE "AppCalendarBehavior" AS ENUM ('NONE', 'SEPARATE_EVENT', 'UPDATE_LINKED_LESSON');
CREATE TYPE "AppScheduleLinkPolicy" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED');
CREATE TYPE "AppEventGroupSource" AS ENUM ('NONE', 'SMECKA', 'POSADKA', 'KURZ');
CREATE TYPE "AppCalendarEventLinkStatus" AS ENUM ('ACTIVE', 'CANCELED', 'DELETED');
CREATE TYPE "AppCalendarSyncJobType" AS ENUM (
  'ENSURE_STUDENT_CALENDAR',
  'ENSURE_GROUP_CALENDAR',
  'INITIAL_STUDENT_SYNC',
  'REFRESH_STUDENT_DAY',
  'REFRESH_GROUP_DAY',
  'PROCESS_CHANGE_DELTA',
  'UPSERT_SCHOOL_EVENT'
);
CREATE TYPE "AppCalendarSyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');
CREATE TYPE "AppSchoolEventTargetType" AS ENUM ('PERSON', 'GROUP');

-- Provider config (Google Workspace service account + impersonation)
CREATE TABLE "app_calendar_provider_config" (
  "id" TEXT NOT NULL,
  "provider" "AppCalendarProvider" NOT NULL DEFAULT 'GOOGLE_WORKSPACE',
  "name" TEXT NOT NULL,
  "service_account_email" TEXT NOT NULL,
  "impersonated_user_email" TEXT NOT NULL,
  "workspace_domain" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_calendar_provider_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_calendar_provider_config_provider_name_key"
  ON "app_calendar_provider_config"("provider", "name");
CREATE INDEX "app_calendar_provider_config_is_active_idx"
  ON "app_calendar_provider_config"("is_active");

-- Per-student calendars
CREATE TABLE "app_student_calendar" (
  "id" TEXT NOT NULL,
  "provider_config_id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "calendar_id" TEXT NOT NULL,
  "calendar_summary" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Prague',
  "sync_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "last_provisioned_at" TIMESTAMPTZ(3),
  "last_sync_at" TIMESTAMPTZ(3),
  "last_sync_status" TEXT,
  "last_sync_error" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_student_calendar_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_student_calendar_provider_config_id_fkey"
    FOREIGN KEY ("provider_config_id")
    REFERENCES "app_calendar_provider_config"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "app_student_calendar_person_id_fkey"
    FOREIGN KEY ("person_id")
    REFERENCES "app_person"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "app_student_calendar_person_id_key"
  ON "app_student_calendar"("person_id");
CREATE UNIQUE INDEX "app_student_calendar_calendar_id_key"
  ON "app_student_calendar"("calendar_id");
CREATE INDEX "app_student_calendar_provider_config_id_idx"
  ON "app_student_calendar"("provider_config_id");
CREATE INDEX "app_student_calendar_active_sync_idx"
  ON "app_student_calendar"("is_active", "sync_enabled");

-- Group calendars (smecka/posadka/kurz)
CREATE TABLE "app_group_calendar" (
  "id" TEXT NOT NULL,
  "provider_config_id" TEXT NOT NULL,
  "group_kind" TEXT NOT NULL,
  "group_code" TEXT NOT NULL,
  "group_name" TEXT,
  "calendar_id" TEXT NOT NULL,
  "calendar_summary" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Prague',
  "sync_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_group_calendar_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_group_calendar_provider_config_id_fkey"
    FOREIGN KEY ("provider_config_id")
    REFERENCES "app_calendar_provider_config"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "app_group_calendar_provider_kind_code_key"
  ON "app_group_calendar"("provider_config_id", "group_kind", "group_code");
CREATE UNIQUE INDEX "app_group_calendar_calendar_id_key"
  ON "app_group_calendar"("calendar_id");
CREATE INDEX "app_group_calendar_active_sync_idx"
  ON "app_group_calendar"("is_active", "sync_enabled");

-- Dynamic event type dictionary
CREATE TABLE "app_school_event_type" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "calendar_behavior" "AppCalendarBehavior" NOT NULL DEFAULT 'SEPARATE_EVENT',
  "schedule_link_policy" "AppScheduleLinkPolicy" NOT NULL DEFAULT 'OPTIONAL',
  "calendar_target" "AppCalendarTarget" NOT NULL DEFAULT 'STUDENT',
  "group_source" "AppEventGroupSource" NOT NULL DEFAULT 'NONE',
  "sort_order" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_type_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_school_event_type_code_key"
  ON "app_school_event_type"("code");
CREATE INDEX "app_school_event_type_is_active_idx"
  ON "app_school_event_type"("is_active");

-- School event instances (can be linked to Edookit lesson)
CREATE TABLE "app_school_event" (
  "id" TEXT NOT NULL,
  "school_year_id" TEXT,
  "event_type_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT,
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "ends_at" TIMESTAMPTZ(3) NOT NULL,
  "all_day" BOOLEAN NOT NULL DEFAULT FALSE,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Prague',
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_linked_to_schedule" BOOLEAN NOT NULL DEFAULT FALSE,
  "linked_lesson_id" INTEGER,
  "linked_lesson_date" DATE,
  "linked_course_id" INTEGER,
  "linked_course_code" TEXT,
  "linked_teacher_person_id" INTEGER,
  "linked_room_id" INTEGER,
  "linked_lesson_snapshot" JSONB,
  "source" TEXT NOT NULL DEFAULT 'app',
  "source_ref" TEXT,
  "metadata" JSONB,
  "created_by_person_id" TEXT,
  "updated_by_person_id" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_school_event_type_fkey"
    FOREIGN KEY ("event_type_id")
    REFERENCES "app_school_event_type"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "app_school_event_created_by_fkey"
    FOREIGN KEY ("created_by_person_id")
    REFERENCES "app_person"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "app_school_event_updated_by_fkey"
    FOREIGN KEY ("updated_by_person_id")
    REFERENCES "app_person"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "app_school_event_time_order_check"
    CHECK ("ends_at" >= "starts_at"),
  CONSTRAINT "app_school_event_linked_lesson_check"
    CHECK (
      ("is_linked_to_schedule" = FALSE AND "linked_lesson_id" IS NULL)
      OR
      ("is_linked_to_schedule" = TRUE AND "linked_lesson_id" IS NOT NULL)
    )
);

CREATE INDEX "app_school_event_type_starts_idx"
  ON "app_school_event"("event_type_id", "starts_at");
CREATE INDEX "app_school_event_linked_lesson_idx"
  ON "app_school_event"("linked_lesson_id", "linked_lesson_date");
CREATE INDEX "app_school_event_school_year_id_idx"
  ON "app_school_event"("school_year_id");

-- Who receives event in calendars
CREATE TABLE "app_school_event_target" (
  "id" TEXT NOT NULL,
  "school_event_id" TEXT NOT NULL,
  "target_type" "AppSchoolEventTargetType" NOT NULL,
  "person_id" TEXT,
  "group_kind" TEXT,
  "group_code" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_target_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_school_event_target_school_event_fkey"
    FOREIGN KEY ("school_event_id")
    REFERENCES "app_school_event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "app_school_event_target_person_fkey"
    FOREIGN KEY ("person_id")
    REFERENCES "app_person"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "app_school_event_target_shape_check"
    CHECK (
      (
        "target_type" = 'PERSON'
        AND "person_id" IS NOT NULL
        AND "group_kind" IS NULL
        AND "group_code" IS NULL
      )
      OR
      (
        "target_type" = 'GROUP'
        AND "person_id" IS NULL
        AND "group_kind" IS NOT NULL
        AND "group_code" IS NOT NULL
      )
    )
);

CREATE INDEX "app_school_event_target_school_event_id_idx"
  ON "app_school_event_target"("school_event_id");
CREATE INDEX "app_school_event_target_person_id_idx"
  ON "app_school_event_target"("person_id");
CREATE INDEX "app_school_event_target_group_idx"
  ON "app_school_event_target"("group_kind", "group_code");

-- Mapping source records to actual Google event ids
CREATE TABLE "app_calendar_event_link" (
  "id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_key" TEXT NOT NULL,
  "source_revision" TEXT,
  "source_starts_at" TIMESTAMPTZ(3),
  "source_ends_at" TIMESTAMPTZ(3),
  "student_calendar_id" TEXT,
  "group_calendar_id" TEXT,
  "school_event_id" TEXT,
  "google_event_id" TEXT NOT NULL,
  "google_ical_uid" TEXT,
  "google_etag" TEXT,
  "payload_hash" TEXT,
  "status" "AppCalendarEventLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "canceled_at" TIMESTAMPTZ(3),
  "last_synced_at" TIMESTAMPTZ(3),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_calendar_event_link_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_calendar_event_link_student_calendar_fkey"
    FOREIGN KEY ("student_calendar_id")
    REFERENCES "app_student_calendar"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "app_calendar_event_link_group_calendar_fkey"
    FOREIGN KEY ("group_calendar_id")
    REFERENCES "app_group_calendar"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "app_calendar_event_link_school_event_fkey"
    FOREIGN KEY ("school_event_id")
    REFERENCES "app_school_event"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "app_calendar_event_link_target_check"
    CHECK (num_nonnulls("student_calendar_id", "group_calendar_id") = 1)
);

CREATE UNIQUE INDEX "app_calendar_event_link_student_source_key"
  ON "app_calendar_event_link"("student_calendar_id", "source_type", "source_key");
CREATE UNIQUE INDEX "app_calendar_event_link_group_source_key"
  ON "app_calendar_event_link"("group_calendar_id", "source_type", "source_key");
CREATE INDEX "app_calendar_event_link_source_idx"
  ON "app_calendar_event_link"("source_type", "source_key");
CREATE INDEX "app_calendar_event_link_google_event_id_idx"
  ON "app_calendar_event_link"("google_event_id");
CREATE INDEX "app_calendar_event_link_school_event_id_idx"
  ON "app_calendar_event_link"("school_event_id");

-- Sync cursor/checkpoints (e.g. Edookit change polling)
CREATE TABLE "app_calendar_sync_cursor" (
  "id" TEXT NOT NULL,
  "cursor_key" TEXT NOT NULL,
  "cursor_value" TEXT,
  "window_from" TIMESTAMPTZ(3),
  "window_to" TIMESTAMPTZ(3),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_calendar_sync_cursor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_calendar_sync_cursor_cursor_key_key"
  ON "app_calendar_sync_cursor"("cursor_key");

-- Worker queue for calendar jobs
CREATE TABLE "app_calendar_sync_job" (
  "id" TEXT NOT NULL,
  "provider_config_id" TEXT,
  "student_calendar_id" TEXT,
  "group_calendar_id" TEXT,
  "job_type" "AppCalendarSyncJobType" NOT NULL,
  "status" "AppCalendarSyncJobStatus" NOT NULL DEFAULT 'PENDING',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "run_after" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMPTZ(3),
  "finished_at" TIMESTAMPTZ(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 10,
  "lock_token" TEXT,
  "locked_by" TEXT,
  "payload" JSONB NOT NULL,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_calendar_sync_job_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_calendar_sync_job_provider_fkey"
    FOREIGN KEY ("provider_config_id")
    REFERENCES "app_calendar_provider_config"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "app_calendar_sync_job_student_calendar_fkey"
    FOREIGN KEY ("student_calendar_id")
    REFERENCES "app_student_calendar"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "app_calendar_sync_job_group_calendar_fkey"
    FOREIGN KEY ("group_calendar_id")
    REFERENCES "app_group_calendar"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "app_calendar_sync_job_status_run_after_idx"
  ON "app_calendar_sync_job"("status", "run_after");
CREATE INDEX "app_calendar_sync_job_job_type_idx"
  ON "app_calendar_sync_job"("job_type");
CREATE INDEX "app_calendar_sync_job_student_calendar_id_idx"
  ON "app_calendar_sync_job"("student_calendar_id");
CREATE INDEX "app_calendar_sync_job_group_calendar_id_idx"
  ON "app_calendar_sync_job"("group_calendar_id");
