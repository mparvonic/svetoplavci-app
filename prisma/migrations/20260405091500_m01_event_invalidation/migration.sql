ALTER TABLE "app_m01_osobni_lodicka_event"
  ADD COLUMN "is_invalidated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "invalidated_at" TIMESTAMP(3),
  ADD COLUMN "invalidated_reason" TEXT,
  ADD COLUMN "invalidated_by_event_id" TEXT;

CREATE INDEX "app_m01_osobni_lodicka_event_is_invalidated_idx"
  ON "app_m01_osobni_lodicka_event"("is_invalidated");

CREATE INDEX "app_m01_osobni_lodicka_event_invalidated_by_event_id_idx"
  ON "app_m01_osobni_lodicka_event"("invalidated_by_event_id");

CREATE INDEX "app_m01_osobni_lodicka_event_lodicka_invalidated_datum_idx"
  ON "app_m01_osobni_lodicka_event"("osobni_lodicka_id", "is_invalidated", "datum_stavu");

CREATE INDEX "app_m01_osobni_lodicka_event_active_latest_idx"
  ON "app_m01_osobni_lodicka_event"(
    "osobni_lodicka_id",
    "datum_stavu" DESC,
    "source_modified_at" DESC,
    "created_at" DESC,
    "id" DESC
  )
  WHERE "is_invalidated" = false;

ALTER TABLE "app_m01_osobni_lodicka_event"
  ADD CONSTRAINT "app_m01_osobni_lodicka_event_invalidated_by_event_id_fkey"
  FOREIGN KEY ("invalidated_by_event_id") REFERENCES "app_m01_osobni_lodicka_event"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
