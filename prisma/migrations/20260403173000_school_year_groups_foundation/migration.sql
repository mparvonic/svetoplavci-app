CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "AppGroupKind" AS ENUM ('stupen', 'rocnik', 'smecka', 'posadka', 'studijni_skupina');
CREATE TYPE "AppStudyModeKey" AS ENUM ('denni', 'individualni', 'zahranici', 'unknown');
CREATE TYPE "AppPolicyScope" AS ENUM ('global', 'study_mode', 'role');

CREATE TABLE "app_study_mode_map" (
  "code" TEXT NOT NULL,
  "mode_key" "AppStudyModeKey" NOT NULL,
  "label" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_study_mode_map_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "app_study_mode_map_mode_key_idx" ON "app_study_mode_map"("mode_key");

CREATE TABLE "app_school_year" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "teaching_start_date" DATE NOT NULL,
  "teaching_end_date" DATE NOT NULL,
  "term1_end_date" DATE NOT NULL,
  "term2_start_date" DATE NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_school_year_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_school_year_code_key" ON "app_school_year"("code");

ALTER TABLE "app_school_year"
  ADD CONSTRAINT "app_school_year_dates_check"
  CHECK (
    "start_date" < "end_date"
    AND "teaching_start_date" >= "start_date"
    AND "teaching_end_date" <= "end_date"
    AND "term2_start_date" = ("term1_end_date" + INTERVAL '1 day')::date
  );

CREATE TABLE "app_group" (
  "id" TEXT NOT NULL,
  "kind" "AppGroupKind" NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "school_year_id" TEXT,
  "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_to" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_by" TEXT,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_group_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_group_kind_code_school_year_id_key" ON "app_group"("kind", "code", "school_year_id");
CREATE INDEX "app_group_kind_idx" ON "app_group"("kind");
CREATE INDEX "app_group_school_year_id_idx" ON "app_group"("school_year_id");

ALTER TABLE "app_group"
  ADD CONSTRAINT "app_group_school_year_id_fkey"
  FOREIGN KEY ("school_year_id") REFERENCES "app_school_year"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_group"
  ADD CONSTRAINT "app_group_valid_range_check"
  CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from");

CREATE TABLE "app_group_link" (
  "id" TEXT NOT NULL,
  "parent_group_id" TEXT NOT NULL,
  "child_group_id" TEXT NOT NULL,
  "relation_type" TEXT NOT NULL,
  "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_to" TIMESTAMP(3),
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "app_group_link_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_group_link_parent_child_relation_valid_from_key" ON "app_group_link"("parent_group_id", "child_group_id", "relation_type", "valid_from");
CREATE INDEX "app_group_link_child_group_id_idx" ON "app_group_link"("child_group_id");

ALTER TABLE "app_group_link"
  ADD CONSTRAINT "app_group_link_parent_group_id_fkey"
  FOREIGN KEY ("parent_group_id") REFERENCES "app_group"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_group_link"
  ADD CONSTRAINT "app_group_link_child_group_id_fkey"
  FOREIGN KEY ("child_group_id") REFERENCES "app_group"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_group_link"
  ADD CONSTRAINT "app_group_link_valid_range_check"
  CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from");

ALTER TABLE "app_group_link"
  ADD CONSTRAINT "app_group_link_no_self_reference_check"
  CHECK ("parent_group_id" <> "child_group_id");

CREATE TABLE "app_student_state" (
  "id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL DEFAULT 'edookit',
  "source_key" TEXT NOT NULL,
  "effective_from" TIMESTAMP(3) NOT NULL,
  "effective_to" TIMESTAMP(3),
  "school_year_id" TEXT,
  "current_grade_num" INTEGER,
  "initial_grade_num" INTEGER,
  "study_mode_code" TEXT,
  "study_mode_key" "AppStudyModeKey" NOT NULL DEFAULT 'unknown',
  "changed_by_sync_run_id" TEXT,
  "raw_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_student_state_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_student_state_person_id_idx" ON "app_student_state"("person_id");
CREATE INDEX "app_student_state_effective_from_idx" ON "app_student_state"("effective_from");
CREATE INDEX "app_student_state_study_mode_key_idx" ON "app_student_state"("study_mode_key");

ALTER TABLE "app_student_state"
  ADD CONSTRAINT "app_student_state_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "app_person"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_student_state"
  ADD CONSTRAINT "app_student_state_school_year_id_fkey"
  FOREIGN KEY ("school_year_id") REFERENCES "app_school_year"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_student_state"
  ADD CONSTRAINT "app_student_state_changed_by_sync_run_id_fkey"
  FOREIGN KEY ("changed_by_sync_run_id") REFERENCES "app_user_sync_run"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_student_state"
  ADD CONSTRAINT "app_student_state_grade_range_check"
  CHECK (
    ("current_grade_num" IS NULL OR ("current_grade_num" BETWEEN 1 AND 9))
    AND ("initial_grade_num" IS NULL OR ("initial_grade_num" BETWEEN 1 AND 9))
  );

ALTER TABLE "app_student_state"
  ADD CONSTRAINT "app_student_state_valid_range_check"
  CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");

ALTER TABLE "app_student_state"
  ADD CONSTRAINT "app_student_state_no_overlap"
  EXCLUDE USING gist (
    "person_id" WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  );

CREATE TABLE "app_membership_policy" (
  "id" TEXT NOT NULL,
  "scope" "AppPolicyScope" NOT NULL,
  "scope_value" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_to" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_membership_policy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_membership_policy_scope_scope_value_idx" ON "app_membership_policy"("scope", "scope_value");
CREATE INDEX "app_membership_policy_is_active_idx" ON "app_membership_policy"("is_active");

ALTER TABLE "app_membership_policy"
  ADD CONSTRAINT "app_membership_policy_valid_range_check"
  CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from");

CREATE TABLE "app_membership_policy_rule" (
  "id" TEXT NOT NULL,
  "policy_id" TEXT NOT NULL,
  "group_kind" "AppGroupKind" NOT NULL,
  "min_count" INTEGER NOT NULL DEFAULT 0,
  "max_count" INTEGER,
  "enforcement" TEXT NOT NULL DEFAULT 'strict',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_membership_policy_rule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_membership_policy_rule_policy_id_group_kind_key" ON "app_membership_policy_rule"("policy_id", "group_kind");
CREATE INDEX "app_membership_policy_rule_group_kind_idx" ON "app_membership_policy_rule"("group_kind");

ALTER TABLE "app_membership_policy_rule"
  ADD CONSTRAINT "app_membership_policy_rule_policy_id_fkey"
  FOREIGN KEY ("policy_id") REFERENCES "app_membership_policy"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_membership_policy_rule"
  ADD CONSTRAINT "app_membership_policy_rule_counts_check"
  CHECK (
    "min_count" >= 0
    AND ("max_count" IS NULL OR "max_count" >= "min_count")
    AND "enforcement" IN ('strict', 'if_group_exists')
  );

CREATE TABLE "app_group_membership" (
  "id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "group_kind" "AppGroupKind" NOT NULL DEFAULT 'studijni_skupina',
  "membership_role" TEXT,
  "valid_from" TIMESTAMP(3) NOT NULL,
  "valid_to" TIMESTAMP(3),
  "source" TEXT NOT NULL,
  "reason" TEXT,
  "created_by" TEXT,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_group_membership_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_group_membership_person_id_idx" ON "app_group_membership"("person_id");
CREATE INDEX "app_group_membership_group_id_idx" ON "app_group_membership"("group_id");
CREATE INDEX "app_group_membership_group_kind_idx" ON "app_group_membership"("group_kind");

ALTER TABLE "app_group_membership"
  ADD CONSTRAINT "app_group_membership_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "app_person"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_group_membership"
  ADD CONSTRAINT "app_group_membership_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "app_group"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_group_membership"
  ADD CONSTRAINT "app_group_membership_valid_range_check"
  CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from");

ALTER TABLE "app_group_membership"
  ADD CONSTRAINT "app_group_membership_singleton_kinds"
  EXCLUDE USING gist (
    "person_id" WITH =,
    "group_kind" WITH =,
    tsrange("valid_from", COALESCE("valid_to", 'infinity'::timestamp), '[)') WITH &&
  )
  WHERE ("group_kind" IN ('rocnik', 'smecka', 'posadka'));

CREATE TABLE "app_group_membership_event" (
  "id" TEXT NOT NULL,
  "membership_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changed_by" TEXT,
  "source" TEXT NOT NULL,
  "old_data" JSONB,
  "new_data" JSONB,

  CONSTRAINT "app_group_membership_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_group_membership_event_membership_id_idx" ON "app_group_membership_event"("membership_id");

ALTER TABLE "app_group_membership_event"
  ADD CONSTRAINT "app_group_membership_event_membership_id_fkey"
  FOREIGN KEY ("membership_id") REFERENCES "app_group_membership"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "app_membership_violation" (
  "id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "interval_from" TIMESTAMP(3) NOT NULL,
  "interval_to" TIMESTAMP(3),
  "rule_scope" TEXT NOT NULL,
  "rule_scope_value" TEXT,
  "group_kind" "AppGroupKind" NOT NULL,
  "expected_min" INTEGER NOT NULL,
  "expected_max" INTEGER,
  "actual_count" INTEGER NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'error',
  "source" TEXT NOT NULL,
  "context" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "resolved_at" TIMESTAMP(3),
  "resolved_by" TEXT,

  CONSTRAINT "app_membership_violation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_membership_violation_person_id_idx" ON "app_membership_violation"("person_id");
CREATE INDEX "app_membership_violation_resolved_at_idx" ON "app_membership_violation"("resolved_at");

ALTER TABLE "app_membership_violation"
  ADD CONSTRAINT "app_membership_violation_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "app_person"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "fn_fill_group_kind"()
RETURNS trigger AS $$
DECLARE
  resolved_kind "AppGroupKind";
BEGIN
  SELECT "kind" INTO resolved_kind
  FROM "app_group"
  WHERE "id" = NEW."group_id";

  IF resolved_kind IS NULL THEN
    RAISE EXCEPTION 'Group % not found for membership', NEW."group_id";
  END IF;

  NEW."group_kind" := resolved_kind;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_fill_group_kind"
BEFORE INSERT OR UPDATE OF "group_id"
ON "app_group_membership"
FOR EACH ROW
EXECUTE FUNCTION "fn_fill_group_kind"();

INSERT INTO "app_study_mode_map" ("code", "mode_key", "label", "is_active", "created_at", "updated_at")
VALUES
  ('11', 'denni', 'Denní studium', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('21', 'unknown', 'Neznámý režim (kód 21)', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('30', 'unknown', 'Neznámý režim (kód 30)', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET
  "mode_key" = EXCLUDED."mode_key",
  "label" = EXCLUDED."label",
  "is_active" = EXCLUDED."is_active",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "app_membership_policy" ("id", "scope", "scope_value", "priority", "is_active", "valid_from", "created_at", "updated_at")
VALUES
  ('policy-study-denni-v1', 'study_mode', 'denni', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('policy-study-individualni-v1', 'study_mode', 'individualni', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('policy-study-zahranici-v1', 'study_mode', 'zahranici', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('policy-study-unknown-v1', 'study_mode', 'unknown', 200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('policy-role-host-v1', 'role', 'host', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET
  "scope" = EXCLUDED."scope",
  "scope_value" = EXCLUDED."scope_value",
  "priority" = EXCLUDED."priority",
  "is_active" = EXCLUDED."is_active",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "app_membership_policy_rule" ("id", "policy_id", "group_kind", "min_count", "max_count", "enforcement", "created_at", "updated_at")
VALUES
  ('rule-denni-rocnik', 'policy-study-denni-v1', 'rocnik', 1, 1, 'strict', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rule-denni-smecka', 'policy-study-denni-v1', 'smecka', 1, 1, 'strict', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rule-denni-posadka', 'policy-study-denni-v1', 'posadka', 0, 1, 'strict', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rule-individualni-rocnik', 'policy-study-individualni-v1', 'rocnik', 1, 1, 'strict', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rule-individualni-smecka', 'policy-study-individualni-v1', 'smecka', 0, 1, 'strict', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rule-zahranici-rocnik', 'policy-study-zahranici-v1', 'rocnik', 1, 1, 'strict', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rule-zahranici-smecka', 'policy-study-zahranici-v1', 'smecka', 0, 1, 'strict', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rule-unknown-rocnik', 'policy-study-unknown-v1', 'rocnik', 0, 1, 'strict', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rule-unknown-smecka', 'policy-study-unknown-v1', 'smecka', 0, 1, 'strict', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rule-host-smecka', 'policy-role-host-v1', 'smecka', 0, 1, 'strict', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("policy_id", "group_kind") DO UPDATE
SET
  "min_count" = EXCLUDED."min_count",
  "max_count" = EXCLUDED."max_count",
  "enforcement" = EXCLUDED."enforcement",
  "updated_at" = CURRENT_TIMESTAMP;
