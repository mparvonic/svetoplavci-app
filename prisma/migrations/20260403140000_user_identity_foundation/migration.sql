-- User identity foundation (Edookit + CSV + manual)

CREATE TABLE "app_person" (
  "id" TEXT NOT NULL,
  "dedup_key" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "first_name" TEXT,
  "middle_name" TEXT,
  "last_name" TEXT,
  "identifier" TEXT,
  "plus4u_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_person_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_person_dedup_key_key" ON "app_person"("dedup_key");
CREATE INDEX "app_person_identifier_idx" ON "app_person"("identifier");
CREATE INDEX "app_person_plus4u_id_idx" ON "app_person"("plus4u_id");

CREATE TABLE "app_person_source_record" (
  "id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_key" TEXT NOT NULL,
  "source_person_id" TEXT,
  "source_record_id" TEXT,
  "organization_ident" TEXT,
  "primary_email" TEXT,
  "active_source" BOOLEAN NOT NULL DEFAULT true,
  "derived_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "payload" JSONB NOT NULL,
  "source_hash" TEXT,
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_person_source_record_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_person_source_record_source_key_key" ON "app_person_source_record"("source_key");
CREATE INDEX "app_person_source_record_person_id_idx" ON "app_person_source_record"("person_id");
CREATE INDEX "app_person_source_record_source_type_idx" ON "app_person_source_record"("source_type");
CREATE INDEX "app_person_source_record_source_person_id_idx" ON "app_person_source_record"("source_person_id");

ALTER TABLE "app_person_source_record"
  ADD CONSTRAINT "app_person_source_record_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "app_person"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "app_login_identity" (
  "id" TEXT NOT NULL,
  "identity_type" TEXT NOT NULL DEFAULT 'email',
  "identity_value" TEXT NOT NULL,
  "normalized_value" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_login_identity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_login_identity_type_normalized_value_key" ON "app_login_identity"("identity_type", "normalized_value");
CREATE INDEX "app_login_identity_normalized_value_idx" ON "app_login_identity"("normalized_value");

CREATE TABLE "app_login_person_link" (
  "id" TEXT NOT NULL,
  "identity_id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_login_person_link_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_login_person_link_identity_id_person_id_key" ON "app_login_person_link"("identity_id", "person_id");
CREATE INDEX "app_login_person_link_person_id_idx" ON "app_login_person_link"("person_id");
CREATE INDEX "app_login_person_link_status_idx" ON "app_login_person_link"("status");

ALTER TABLE "app_login_person_link"
  ADD CONSTRAINT "app_login_person_link_identity_id_fkey"
  FOREIGN KEY ("identity_id") REFERENCES "app_login_identity"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_login_person_link"
  ADD CONSTRAINT "app_login_person_link_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "app_person"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "app_role_assignment" (
  "id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'auto',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "valid_from" TIMESTAMP(3),
  "valid_to" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_role_assignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_role_assignment_person_id_role_source_key" ON "app_role_assignment"("person_id", "role", "source");
CREATE INDEX "app_role_assignment_role_idx" ON "app_role_assignment"("role");
CREATE INDEX "app_role_assignment_source_idx" ON "app_role_assignment"("source");

ALTER TABLE "app_role_assignment"
  ADD CONSTRAINT "app_role_assignment_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "app_person"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "app_person_relation" (
  "id" TEXT NOT NULL,
  "parent_person_id" TEXT NOT NULL,
  "child_person_id" TEXT NOT NULL,
  "relation_type" TEXT NOT NULL DEFAULT 'parent_of',
  "source" TEXT NOT NULL DEFAULT 'auto',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_person_relation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_person_relation_parent_child_relation_source_key" ON "app_person_relation"("parent_person_id", "child_person_id", "relation_type", "source");
CREATE INDEX "app_person_relation_child_person_id_idx" ON "app_person_relation"("child_person_id");

ALTER TABLE "app_person_relation"
  ADD CONSTRAINT "app_person_relation_parent_person_id_fkey"
  FOREIGN KEY ("parent_person_id") REFERENCES "app_person"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_person_relation"
  ADD CONSTRAINT "app_person_relation_child_person_id_fkey"
  FOREIGN KEY ("child_person_id") REFERENCES "app_person"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "app_identity_conflict" (
  "id" TEXT NOT NULL,
  "identity_id" TEXT,
  "normalized_value" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "reason" TEXT NOT NULL,
  "details" JSONB,
  "resolved_by" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_identity_conflict_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_identity_conflict_status_idx" ON "app_identity_conflict"("status");
CREATE INDEX "app_identity_conflict_normalized_value_idx" ON "app_identity_conflict"("normalized_value");

ALTER TABLE "app_identity_conflict"
  ADD CONSTRAINT "app_identity_conflict_identity_id_fkey"
  FOREIGN KEY ("identity_id") REFERENCES "app_login_identity"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "app_user_sync_run" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "run_type" TEXT NOT NULL,
  "requested_date" TEXT,
  "include_inactive_since" TEXT,
  "status" TEXT NOT NULL DEFAULT 'running',
  "students_count" INTEGER NOT NULL DEFAULT 0,
  "employees_count" INTEGER NOT NULL DEFAULT 0,
  "csv_count" INTEGER NOT NULL DEFAULT 0,
  "persons_touched" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),

  CONSTRAINT "app_user_sync_run_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_user_sync_run_source_idx" ON "app_user_sync_run"("source");
CREATE INDEX "app_user_sync_run_status_idx" ON "app_user_sync_run"("status");
