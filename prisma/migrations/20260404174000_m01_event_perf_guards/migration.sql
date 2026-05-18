-- M01 performance + data guards before history import

CREATE INDEX "app_m01_osobni_lodicka_event_latest_lookup_idx"
  ON "app_m01_osobni_lodicka_event"
  ("osobni_lodicka_id", "datum_stavu" DESC, "source_modified_at" DESC, "created_at" DESC, "id" DESC);

ALTER TABLE "app_m01_osobni_lodicka"
  ADD CONSTRAINT "app_m01_osobni_lodicka_current_stupen_ck"
  CHECK ("current_stupen" BETWEEN 0 AND 4);

ALTER TABLE "app_m01_osobni_lodicka_event"
  ADD CONSTRAINT "app_m01_osobni_lodicka_event_stupen_ck"
  CHECK ("stupen" BETWEEN 0 AND 4);
