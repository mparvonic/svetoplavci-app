-- M03 action engine core

CREATE TYPE "AppSchoolEventVisibility" AS ENUM ('PRIVATE', 'INVITE_ONLY', 'PUBLIC');
CREATE TYPE "AppSchoolEventLifecycleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REGISTRATION_CLOSED', 'COMPLETED', 'CANCELED', 'ARCHIVED');
CREATE TYPE "AppSchoolEventAudienceRuleType" AS ENUM ('PERSON', 'GROUP', 'ROLE', 'EXPRESSION', 'PUBLIC');
CREATE TYPE "AppSchoolEventSnapshotReason" AS ENUM ('PUBLISHED', 'REGISTRATION_CLOSED', 'MANUAL');
CREATE TYPE "AppSchoolEventRegistrationWindowMode" AS ENUM ('ABSOLUTE', 'RELATIVE_TO_EVENT_START');
CREATE TYPE "AppSchoolEventRegistrationStatus" AS ENUM ('REGISTERED', 'UNREGISTERED', 'WAITLIST', 'CANCELED_BY_GUIDE');
CREATE TYPE "AppSchoolEventAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED', 'LATE', 'LEFT_EARLY');
CREATE TYPE "AppSchoolEventOfferSelectionMode" AS ENUM ('AT_MOST_ONE', 'EXACTLY_ONE');
CREATE TYPE "AppSchoolEventModuleLinkTargetType" AS ENUM ('EVENT', 'REGISTRATION', 'ATTENDANCE');

CREATE TABLE "app_school_event_template" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "event_type_id" TEXT,
  "default_title" TEXT,
  "default_description" TEXT,
  "default_location" TEXT,
  "default_all_day" BOOLEAN NOT NULL DEFAULT false,
  "default_duration_minutes" INTEGER,
  "default_visibility" "AppSchoolEventVisibility" NOT NULL DEFAULT 'INVITE_ONLY',
  "default_linked_to_schedule" BOOLEAN NOT NULL DEFAULT false,
  "default_metadata" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_template_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_school_event_template_event_type_id_fkey"
    FOREIGN KEY ("event_type_id") REFERENCES "app_school_event_type"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "app_school_event_template_code_key"
  ON "app_school_event_template"("code");
CREATE INDEX "app_school_event_template_event_type_id_idx"
  ON "app_school_event_template"("event_type_id");
CREATE INDEX "app_school_event_template_is_active_idx"
  ON "app_school_event_template"("is_active");

CREATE TABLE "app_school_event_series" (
  "id" TEXT NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "event_type_id" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Prague',
  "recurrence_rule" TEXT NOT NULL,
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "ends_at" TIMESTAMPTZ(3) NOT NULL,
  "recurrence_until_at" TIMESTAMPTZ(3),
  "recurrence_count" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_by_person_id" TEXT,
  "updated_by_person_id" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_series_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_school_event_series_event_type_id_fkey"
    FOREIGN KEY ("event_type_id") REFERENCES "app_school_event_type"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "app_school_event_series_time_order_check"
    CHECK ("ends_at" >= "starts_at")
);

CREATE UNIQUE INDEX "app_school_event_series_code_key"
  ON "app_school_event_series"("code");
CREATE INDEX "app_school_event_series_event_type_id_idx"
  ON "app_school_event_series"("event_type_id");
CREATE INDEX "app_school_event_series_is_active_idx"
  ON "app_school_event_series"("is_active");

CREATE TABLE "app_school_event_offer_group" (
  "id" TEXT NOT NULL,
  "school_year_id" TEXT,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "starts_at" TIMESTAMPTZ(3),
  "ends_at" TIMESTAMPTZ(3),
  "selection_mode" "AppSchoolEventOfferSelectionMode" NOT NULL DEFAULT 'AT_MOST_ONE',
  "max_selections_per_person" INTEGER NOT NULL DEFAULT 1,
  "allow_no_selection" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_offer_group_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_school_event_offer_group_max_sel_check" CHECK ("max_selections_per_person" > 0),
  CONSTRAINT "app_school_event_offer_group_time_order_check" CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" >= "starts_at")
);

CREATE INDEX "app_school_event_offer_group_school_year_id_idx"
  ON "app_school_event_offer_group"("school_year_id");
CREATE INDEX "app_school_event_offer_group_is_active_idx"
  ON "app_school_event_offer_group"("is_active");

ALTER TABLE "app_school_event"
  ADD COLUMN "template_id" TEXT,
  ADD COLUMN "series_id" TEXT,
  ADD COLUMN "series_original_start_at" TIMESTAMPTZ(3),
  ADD COLUMN "offer_group_id" TEXT,
  ADD COLUMN "visibility" "AppSchoolEventVisibility" NOT NULL DEFAULT 'INVITE_ONLY',
  ADD COLUMN "lifecycle_status" "AppSchoolEventLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "last_lesson_refresh_at" TIMESTAMPTZ(3),
  ADD COLUMN "time_override_lock" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "title_override_lock" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "description_override_lock" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "location_override_lock" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "published_at" TIMESTAMPTZ(3),
  ADD COLUMN "registration_closed_at" TIMESTAMPTZ(3),
  ADD COLUMN "completed_at" TIMESTAMPTZ(3),
  ADD COLUMN "canceled_at" TIMESTAMPTZ(3);

ALTER TABLE "app_school_event"
  ADD CONSTRAINT "app_school_event_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "app_school_event_template"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "app_school_event_series_id_fkey"
    FOREIGN KEY ("series_id") REFERENCES "app_school_event_series"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "app_school_event_offer_group_id_fkey"
    FOREIGN KEY ("offer_group_id") REFERENCES "app_school_event_offer_group"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "app_school_event_template_id_idx"
  ON "app_school_event"("template_id");
CREATE INDEX "app_school_event_series_instance_idx"
  ON "app_school_event"("series_id", "series_original_start_at");
CREATE INDEX "app_school_event_offer_group_id_idx"
  ON "app_school_event"("offer_group_id");
CREATE INDEX "app_school_event_lifecycle_status_idx"
  ON "app_school_event"("lifecycle_status");

CREATE TABLE "app_school_event_audience_rule" (
  "id" TEXT NOT NULL,
  "school_event_id" TEXT NOT NULL,
  "rule_type" "AppSchoolEventAudienceRuleType" NOT NULL,
  "person_id" TEXT,
  "group_kind" TEXT,
  "group_code" TEXT,
  "role_code" TEXT,
  "expression" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_audience_rule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_school_event_audience_rule_school_event_id_fkey"
    FOREIGN KEY ("school_event_id") REFERENCES "app_school_event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "app_school_event_audience_rule_school_event_id_idx"
  ON "app_school_event_audience_rule"("school_event_id");
CREATE INDEX "app_school_event_audience_rule_rule_type_idx"
  ON "app_school_event_audience_rule"("rule_type");
CREATE INDEX "app_school_event_audience_rule_person_id_idx"
  ON "app_school_event_audience_rule"("person_id");
CREATE INDEX "app_school_event_audience_rule_group_idx"
  ON "app_school_event_audience_rule"("group_kind", "group_code");
CREATE INDEX "app_school_event_audience_rule_role_code_idx"
  ON "app_school_event_audience_rule"("role_code");

CREATE TABLE "app_school_event_audience_snapshot_batch" (
  "id" TEXT NOT NULL,
  "school_event_id" TEXT NOT NULL,
  "reason" "AppSchoolEventSnapshotReason" NOT NULL,
  "snapshot_at" TIMESTAMPTZ(3) NOT NULL,
  "source_ref" TEXT,
  "created_by_person_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_audience_snapshot_batch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_school_event_audience_snapshot_batch_school_event_id_fkey"
    FOREIGN KEY ("school_event_id") REFERENCES "app_school_event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "app_school_event_snapshot_batch_event_snapshot_idx"
  ON "app_school_event_audience_snapshot_batch"("school_event_id", "snapshot_at");

CREATE TABLE "app_school_event_audience_snapshot_item" (
  "id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "source_rule_id" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_audience_snapshot_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_school_event_snapshot_item_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "app_school_event_audience_snapshot_batch"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "app_school_event_snapshot_item_source_rule_id_fkey"
    FOREIGN KEY ("source_rule_id") REFERENCES "app_school_event_audience_rule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "app_school_event_snapshot_item_batch_person_key"
  ON "app_school_event_audience_snapshot_item"("batch_id", "person_id");
CREATE INDEX "app_school_event_snapshot_item_person_id_idx"
  ON "app_school_event_audience_snapshot_item"("person_id");
CREATE INDEX "app_school_event_snapshot_item_source_rule_id_idx"
  ON "app_school_event_audience_snapshot_item"("source_rule_id");

CREATE TABLE "app_school_event_registration_policy" (
  "id" TEXT NOT NULL,
  "school_event_id" TEXT NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT false,
  "window_mode" "AppSchoolEventRegistrationWindowMode" NOT NULL DEFAULT 'ABSOLUTE',
  "opens_at" TIMESTAMPTZ(3),
  "closes_at" TIMESTAMPTZ(3),
  "unregister_closes_at" TIMESTAMPTZ(3),
  "opens_offset_minutes" INTEGER,
  "closes_offset_minutes" INTEGER,
  "unregister_offset_minutes" INTEGER,
  "capacity" INTEGER,
  "waitlist_capacity" INTEGER,
  "allow_waitlist" BOOLEAN NOT NULL DEFAULT false,
  "allow_guide_exception" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_registration_policy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_school_event_registration_policy_school_event_id_fkey"
    FOREIGN KEY ("school_event_id") REFERENCES "app_school_event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "app_school_event_registration_policy_school_event_id_key"
  ON "app_school_event_registration_policy"("school_event_id");

CREATE TABLE "app_school_event_registration" (
  "id" TEXT NOT NULL,
  "school_event_id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "status" "AppSchoolEventRegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
  "is_exception" BOOLEAN NOT NULL DEFAULT false,
  "exception_reason" TEXT,
  "note" TEXT,
  "changed_by_person_id" TEXT,
  "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_registration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_school_event_registration_school_event_id_fkey"
    FOREIGN KEY ("school_event_id") REFERENCES "app_school_event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "app_school_event_registration_event_person_key"
  ON "app_school_event_registration"("school_event_id", "person_id");
CREATE INDEX "app_school_event_registration_person_id_idx"
  ON "app_school_event_registration"("person_id");
CREATE INDEX "app_school_event_registration_status_idx"
  ON "app_school_event_registration"("status");

CREATE TABLE "app_school_event_attendance" (
  "id" TEXT NOT NULL,
  "school_event_id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "status" "AppSchoolEventAttendanceStatus" NOT NULL,
  "note" TEXT,
  "recorded_by_person_id" TEXT,
  "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_attendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_school_event_attendance_school_event_id_fkey"
    FOREIGN KEY ("school_event_id") REFERENCES "app_school_event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "app_school_event_attendance_event_person_key"
  ON "app_school_event_attendance"("school_event_id", "person_id");
CREATE INDEX "app_school_event_attendance_person_id_idx"
  ON "app_school_event_attendance"("person_id");
CREATE INDEX "app_school_event_attendance_status_idx"
  ON "app_school_event_attendance"("status");

CREATE TABLE "app_school_event_module_link" (
  "id" TEXT NOT NULL,
  "school_event_id" TEXT NOT NULL,
  "module_code" TEXT NOT NULL,
  "target_type" "AppSchoolEventModuleLinkTargetType" NOT NULL DEFAULT 'EVENT',
  "target_ref" TEXT,
  "link_config" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_school_event_module_link_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_school_event_module_link_school_event_id_fkey"
    FOREIGN KEY ("school_event_id") REFERENCES "app_school_event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "app_school_event_module_link_unique"
  ON "app_school_event_module_link"("school_event_id", "module_code", "target_type", "target_ref");
CREATE INDEX "app_school_event_module_link_module_code_idx"
  ON "app_school_event_module_link"("module_code");
CREATE INDEX "app_school_event_module_link_is_active_idx"
  ON "app_school_event_module_link"("is_active");
