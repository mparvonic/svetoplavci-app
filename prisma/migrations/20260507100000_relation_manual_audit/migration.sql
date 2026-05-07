ALTER TABLE "app_person_relation"
  ADD COLUMN "created_by" TEXT,
  ADD COLUMN "updated_by" TEXT,
  ADD COLUMN "change_reason" TEXT;

CREATE INDEX "app_person_relation_parent_person_id_idx"
  ON "app_person_relation"("parent_person_id");

CREATE INDEX "app_person_relation_source_idx"
  ON "app_person_relation"("source");

COMMENT ON COLUMN "app_person_relation"."created_by"
  IS 'Actor that manually created or reactivated the relation.';

COMMENT ON COLUMN "app_person_relation"."updated_by"
  IS 'Actor that last manually changed the relation.';

COMMENT ON COLUMN "app_person_relation"."change_reason"
  IS 'Short admin-entered reason for the latest manual relation change.';
