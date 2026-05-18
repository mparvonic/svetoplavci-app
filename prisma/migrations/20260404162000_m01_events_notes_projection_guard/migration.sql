-- M01: projection guard for osobni lodičky + universal note system

-- 1) Projection guard: last event pointer on personal lodicka
ALTER TABLE "app_m01_osobni_lodicka"
  ADD COLUMN "last_event_id" TEXT;

CREATE UNIQUE INDEX "app_m01_osobni_lodicka_last_event_id_key"
  ON "app_m01_osobni_lodicka"("last_event_id");

ALTER TABLE "app_m01_osobni_lodicka"
  ADD CONSTRAINT "app_m01_osobni_lodicka_last_event_id_fkey"
  FOREIGN KEY ("last_event_id") REFERENCES "app_m01_osobni_lodicka_event"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 2) Event source metadata (from Coda export)
ALTER TABLE "app_m01_osobni_lodicka_event"
  ADD COLUMN "changed_by_label" TEXT,
  ADD COLUMN "source_created_by_person_id" TEXT,
  ADD COLUMN "source_created_by_label" TEXT,
  ADD COLUMN "source_created_at" TIMESTAMP(3),
  ADD COLUMN "source_modified_by_person_id" TEXT,
  ADD COLUMN "source_modified_by_label" TEXT,
  ADD COLUMN "source_modified_at" TIMESTAMP(3);

CREATE INDEX "app_m01_osobni_lodicka_event_source_created_by_idx"
  ON "app_m01_osobni_lodicka_event"("source_created_by_person_id");

CREATE INDEX "app_m01_osobni_lodicka_event_source_modified_by_idx"
  ON "app_m01_osobni_lodicka_event"("source_modified_by_person_id");

CREATE INDEX "app_m01_osobni_lodicka_event_source_modified_at_idx"
  ON "app_m01_osobni_lodicka_event"("source_modified_at");

ALTER TABLE "app_m01_osobni_lodicka_event"
  ADD CONSTRAINT "app_m01_osobni_lodicka_event_source_created_by_person_id_fkey"
  FOREIGN KEY ("source_created_by_person_id") REFERENCES "app_person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_m01_osobni_lodicka_event"
  ADD CONSTRAINT "app_m01_osobni_lodicka_event_source_modified_by_person_id_fkey"
  FOREIGN KEY ("source_modified_by_person_id") REFERENCES "app_person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Universal notes with GUI-configurable policy
CREATE TYPE "AppNoteTargetType" AS ENUM ('M01_LODICKA', 'M01_OSOBNI_LODICKA', 'M01_OSOBNI_LODICKA_EVENT');
CREATE TYPE "AppNoteType" AS ENUM ('INTERNI_POZNAMKA', 'KOMENTAR_GARANTU', 'ZPRAVA_DITETI');
CREATE TYPE "AppNoteVisibility" AS ENUM ('INTERNAL', 'GUIDE_TEAM', 'PARENT_CHILD');

CREATE TABLE "app_note_policy" (
  "id" TEXT NOT NULL,
  "target_type" "AppNoteTargetType" NOT NULL,
  "note_type" "AppNoteType" NOT NULL,
  "visibility" "AppNoteVisibility" NOT NULL DEFAULT 'INTERNAL',
  "read_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "write_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_note_policy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_note_policy_target_type_note_type_key"
  ON "app_note_policy"("target_type", "note_type");

CREATE INDEX "app_note_policy_is_enabled_idx"
  ON "app_note_policy"("is_enabled");

CREATE TABLE "app_note" (
  "id" TEXT NOT NULL,
  "target_type" "AppNoteTargetType" NOT NULL,
  "target_id" TEXT NOT NULL,
  "note_type" "AppNoteType" NOT NULL,
  "visibility" "AppNoteVisibility" NOT NULL DEFAULT 'INTERNAL',
  "body" TEXT NOT NULL,
  "author_person_id" TEXT,
  "m01_lodicka_id" TEXT,
  "m01_osobni_lodicka_id" TEXT,
  "m01_osobni_lodicka_event_id" TEXT,
  "source" TEXT NOT NULL DEFAULT 'app',
  "source_ref" TEXT,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_note_target_idx"
  ON "app_note"("target_type", "target_id");

CREATE INDEX "app_note_note_type_idx"
  ON "app_note"("note_type");

CREATE INDEX "app_note_author_person_id_idx"
  ON "app_note"("author_person_id");

CREATE INDEX "app_note_m01_lodicka_id_idx"
  ON "app_note"("m01_lodicka_id");

CREATE INDEX "app_note_m01_osobni_lodicka_id_idx"
  ON "app_note"("m01_osobni_lodicka_id");

CREATE INDEX "app_note_m01_osobni_lodicka_event_id_idx"
  ON "app_note"("m01_osobni_lodicka_event_id");

ALTER TABLE "app_note"
  ADD CONSTRAINT "app_note_author_person_id_fkey"
  FOREIGN KEY ("author_person_id") REFERENCES "app_person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_note"
  ADD CONSTRAINT "app_note_m01_lodicka_id_fkey"
  FOREIGN KEY ("m01_lodicka_id") REFERENCES "app_m01_lodicka"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_note"
  ADD CONSTRAINT "app_note_m01_osobni_lodicka_id_fkey"
  FOREIGN KEY ("m01_osobni_lodicka_id") REFERENCES "app_m01_osobni_lodicka"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_note"
  ADD CONSTRAINT "app_note_m01_osobni_lodicka_event_id_fkey"
  FOREIGN KEY ("m01_osobni_lodicka_event_id") REFERENCES "app_m01_osobni_lodicka_event"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
