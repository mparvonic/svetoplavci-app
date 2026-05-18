-- CreateEnum
CREATE TYPE "M01SvpZmenaType" AS ENUM ('MINOR', 'MAJOR');

-- CreateEnum
CREATE TYPE "M01SvpVersionStatus" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "M01LodickaTyp" AS ENUM ('INDIVIDUALNI', 'HROMADNA');

-- CreateEnum
CREATE TYPE "M01Stupen" AS ENUM ('I_STUPEN', 'II_STUPEN');

-- CreateEnum
CREATE TYPE "M01OsobniSadaStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "M01MigraceRuleTyp" AS ENUM ('AUTO_1_1', 'AUTO_N_1', 'AUTO_1_N', 'MANUAL', 'NOVA');

-- CreateEnum
CREATE TYPE "M01MigracePlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "M01MigraceRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AiKnowledgeDomain" AS ENUM ('M01_RVP_OVU', 'M01_LODICKA', 'M01_OSOBNI_LODICKA', 'M01_OSOBNI_LODICKA_EVENT');

-- CreateEnum
CREATE TYPE "AiEmbeddingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "app_m01_rvp_version" (
    "id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_format" TEXT NOT NULL DEFAULT 'full_mp',
    "dataset_version" TEXT NOT NULL,
    "source_hash" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imported_by" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_m01_rvp_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_rvp_uzlovy_bod" (
    "id" TEXT NOT NULL,
    "rvp_version_id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "grade_num" INTEGER,
    "stage_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_m01_rvp_uzlovy_bod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_rvp_ovu" (
    "id" TEXT NOT NULL,
    "rvp_version_id" TEXT NOT NULL,
    "uzlovy_bod_id" TEXT,
    "kod" TEXT NOT NULL,
    "zneni" TEXT NOT NULL,
    "popis_a_zduvodneni" TEXT,
    "hodnoty" JSONB,
    "predchazejici_kody" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "souvisejici_kody" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nasledujici_kody" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metodicka_podpora" JSONB,
    "source_branch" TEXT,
    "source_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_m01_rvp_ovu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_svp_version" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER NOT NULL,
    "zmena_type" "M01SvpZmenaType" NOT NULL,
    "status" "M01SvpVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "based_on_rvp_version_id" TEXT NOT NULL,
    "parent_svp_version_id" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by_person_id" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_m01_svp_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_predmet" (
    "id" TEXT NOT NULL,
    "svp_version_id" TEXT NOT NULL,
    "kod" TEXT,
    "nazev" TEXT NOT NULL,
    "garant_person_id" TEXT,
    "poradi" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_m01_predmet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_podpredmet" (
    "id" TEXT NOT NULL,
    "svp_version_id" TEXT NOT NULL,
    "predmet_id" TEXT NOT NULL,
    "kod" TEXT,
    "nazev" TEXT NOT NULL,
    "garant_person_id" TEXT,
    "poradi" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_m01_podpredmet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_oblast" (
    "id" TEXT NOT NULL,
    "svp_version_id" TEXT NOT NULL,
    "predmet_id" TEXT NOT NULL,
    "podpredmet_id" TEXT,
    "kod" TEXT,
    "nazev" TEXT NOT NULL,
    "poradi" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_m01_oblast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_lodicka" (
    "id" TEXT NOT NULL,
    "svp_version_id" TEXT NOT NULL,
    "predmet_id" TEXT NOT NULL,
    "podpredmet_id" TEXT,
    "oblast_id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "nazev" TEXT NOT NULL,
    "zkraceny_nazev" TEXT,
    "popis" TEXT,
    "typ" "M01LodickaTyp" NOT NULL,
    "rocnik_od" INTEGER NOT NULL,
    "rocnik_do" INTEGER NOT NULL,
    "stupen" "M01Stupen" NOT NULL,
    "garant_person_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "source_coda_row_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_m01_lodicka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_lodicka_ovu_link" (
    "id" TEXT NOT NULL,
    "lodicka_id" TEXT NOT NULL,
    "rvp_ovu_id" TEXT NOT NULL,
    "source_ovu_code" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_m01_lodicka_ovu_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_lodicka_prerequisite" (
    "id" TEXT NOT NULL,
    "lodicka_id" TEXT NOT NULL,
    "required_lodicka_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_m01_lodicka_prerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_osobni_sada_lodicek" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "svp_version_id" TEXT NOT NULL,
    "stupen" "M01Stupen" NOT NULL,
    "status" "M01OsobniSadaStatus" NOT NULL DEFAULT 'ACTIVE',
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'import',
    "source_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_m01_osobni_sada_lodicek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_osobni_lodicka" (
    "id" TEXT NOT NULL,
    "osobni_sada_id" TEXT NOT NULL,
    "lodicka_id" TEXT NOT NULL,
    "kod_osobni_lodicky" TEXT NOT NULL,
    "student_external_id" INTEGER,
    "current_stupen" INTEGER NOT NULL DEFAULT 0,
    "current_stav_label" TEXT,
    "current_hodnota" INTEGER,
    "datum_stavu" TIMESTAMP(3),
    "uspech" TEXT,
    "poznamka" TEXT,
    "source_coda_row_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_m01_osobni_lodicka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_osobni_lodicka_event" (
    "id" TEXT NOT NULL,
    "osobni_lodicka_id" TEXT NOT NULL,
    "stupen" INTEGER NOT NULL,
    "stav_label" TEXT,
    "hodnota" INTEGER,
    "datum_stavu" TIMESTAMP(3) NOT NULL,
    "poznamka" TEXT,
    "uspech" TEXT,
    "changed_by_person_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'import',
    "source_row_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_m01_osobni_lodicka_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_svp_migrace_plan" (
    "id" TEXT NOT NULL,
    "from_svp_version_id" TEXT NOT NULL,
    "to_svp_version_id" TEXT NOT NULL,
    "status" "M01MigracePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "approved_by_person_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_m01_svp_migrace_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_svp_migrace_rule" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "to_lodicka_id" TEXT NOT NULL,
    "rule_type" "M01MigraceRuleTyp" NOT NULL,
    "params" JSONB,
    "is_ready" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_m01_svp_migrace_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_svp_migrace_rule_source" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "from_lodicka_id" TEXT NOT NULL,
    "weight" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_m01_svp_migrace_rule_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_m01_svp_migrace_run" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "M01MigraceRunStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "affected_students" INTEGER NOT NULL DEFAULT 0,
    "affected_lodicky" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "report" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_m01_svp_migrace_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_ai_knowledge_item" (
    "id" TEXT NOT NULL,
    "domain" "AiKnowledgeDomain" NOT NULL,
    "source_table" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_code" TEXT,
    "source_version" TEXT,
    "language" TEXT NOT NULL DEFAULT 'cs',
    "title" TEXT,
    "body_text" TEXT NOT NULL,
    "structured_payload" JSONB,
    "metadata" JSONB,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "content_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_ai_knowledge_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_ai_knowledge_chunk" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "token_estimate" INTEGER,
    "metadata" JSONB,
    "content_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_ai_knowledge_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_ai_embedding" (
    "id" TEXT NOT NULL,
    "chunk_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "embedding_values" DOUBLE PRECISION[],
    "embedding_norm" DOUBLE PRECISION,
    "status" "AiEmbeddingStatus" NOT NULL DEFAULT 'PENDING',
    "external_vector_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_ai_embedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_m01_rvp_version_is_active_idx" ON "app_m01_rvp_version"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_rvp_version_dataset_format_key" ON "app_m01_rvp_version"("dataset_version", "source_format");

-- CreateIndex
CREATE INDEX "app_m01_rvp_uzlovy_bod_kod_idx" ON "app_m01_rvp_uzlovy_bod"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_rvp_uzlovy_bod_version_kod_key" ON "app_m01_rvp_uzlovy_bod"("rvp_version_id", "kod");

-- CreateIndex
CREATE INDEX "app_m01_rvp_ovu_kod_idx" ON "app_m01_rvp_ovu"("kod");

-- CreateIndex
CREATE INDEX "app_m01_rvp_ovu_uzlovy_bod_id_idx" ON "app_m01_rvp_ovu"("uzlovy_bod_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_rvp_ovu_version_kod_key" ON "app_m01_rvp_ovu"("rvp_version_id", "kod");

-- CreateIndex
CREATE INDEX "app_m01_svp_version_status_idx" ON "app_m01_svp_version"("status");

-- CreateIndex
CREATE INDEX "app_m01_svp_version_is_current_idx" ON "app_m01_svp_version"("is_current");

-- CreateIndex
CREATE INDEX "app_m01_svp_version_effective_from_idx" ON "app_m01_svp_version"("effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_svp_version_major_minor_key" ON "app_m01_svp_version"("major", "minor");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_svp_version_label_key" ON "app_m01_svp_version"("label");

-- CreateIndex
CREATE INDEX "app_m01_predmet_garant_person_id_idx" ON "app_m01_predmet"("garant_person_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_predmet_version_nazev_key" ON "app_m01_predmet"("svp_version_id", "nazev");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_predmet_version_kod_key" ON "app_m01_predmet"("svp_version_id", "kod");

-- CreateIndex
CREATE INDEX "app_m01_podpredmet_garant_person_id_idx" ON "app_m01_podpredmet"("garant_person_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_podpredmet_predmet_nazev_key" ON "app_m01_podpredmet"("predmet_id", "nazev");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_podpredmet_version_kod_key" ON "app_m01_podpredmet"("svp_version_id", "kod");

-- CreateIndex
CREATE INDEX "app_m01_oblast_predmet_id_idx" ON "app_m01_oblast"("predmet_id");

-- CreateIndex
CREATE INDEX "app_m01_oblast_podpredmet_id_idx" ON "app_m01_oblast"("podpredmet_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_oblast_version_kod_key" ON "app_m01_oblast"("svp_version_id", "kod");

-- CreateIndex
CREATE INDEX "app_m01_lodicka_stupen_idx" ON "app_m01_lodicka"("stupen");

-- CreateIndex
CREATE INDEX "app_m01_lodicka_rocnik_range_idx" ON "app_m01_lodicka"("rocnik_od", "rocnik_do");

-- CreateIndex
CREATE INDEX "app_m01_lodicka_garant_person_id_idx" ON "app_m01_lodicka"("garant_person_id");

-- CreateIndex
CREATE INDEX "app_m01_lodicka_source_coda_row_id_idx" ON "app_m01_lodicka"("source_coda_row_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_lodicka_version_kod_key" ON "app_m01_lodicka"("svp_version_id", "kod");

-- CreateIndex
CREATE INDEX "app_m01_lodicka_ovu_link_rvp_ovu_id_idx" ON "app_m01_lodicka_ovu_link"("rvp_ovu_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_lodicka_ovu_link_lodicka_ovu_key" ON "app_m01_lodicka_ovu_link"("lodicka_id", "rvp_ovu_id");

-- CreateIndex
CREATE INDEX "app_m01_lodicka_prereq_required_lodicka_id_idx" ON "app_m01_lodicka_prerequisite"("required_lodicka_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_lodicka_prereq_lodicka_required_key" ON "app_m01_lodicka_prerequisite"("lodicka_id", "required_lodicka_id");

-- CreateIndex
CREATE INDEX "app_m01_osobni_sada_person_status_idx" ON "app_m01_osobni_sada_lodicek"("person_id", "status");

-- CreateIndex
CREATE INDEX "app_m01_osobni_sada_version_stupen_idx" ON "app_m01_osobni_sada_lodicek"("svp_version_id", "stupen");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_osobni_sada_person_version_stupen_key" ON "app_m01_osobni_sada_lodicek"("person_id", "svp_version_id", "stupen");

-- CreateIndex
CREATE INDEX "app_m01_osobni_lodicka_student_external_id_idx" ON "app_m01_osobni_lodicka"("student_external_id");

-- CreateIndex
CREATE INDEX "app_m01_osobni_lodicka_source_coda_row_id_idx" ON "app_m01_osobni_lodicka"("source_coda_row_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_osobni_lodicka_kod_key" ON "app_m01_osobni_lodicka"("kod_osobni_lodicky");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_osobni_lodicka_sada_lodicka_key" ON "app_m01_osobni_lodicka"("osobni_sada_id", "lodicka_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_osobni_lodicka_event_source_row_id_key" ON "app_m01_osobni_lodicka_event"("source_row_id");

-- CreateIndex
CREATE INDEX "app_m01_osobni_lodicka_event_lodicka_datum_idx" ON "app_m01_osobni_lodicka_event"("osobni_lodicka_id", "datum_stavu");

-- CreateIndex
CREATE INDEX "app_m01_osobni_lodicka_event_changed_by_idx" ON "app_m01_osobni_lodicka_event"("changed_by_person_id");

-- CreateIndex
CREATE INDEX "app_m01_svp_migrace_plan_status_scheduled_idx" ON "app_m01_svp_migrace_plan"("status", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_svp_migrace_plan_from_to_key" ON "app_m01_svp_migrace_plan"("from_svp_version_id", "to_svp_version_id");

-- CreateIndex
CREATE INDEX "app_m01_svp_migrace_rule_type_idx" ON "app_m01_svp_migrace_rule"("rule_type");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_svp_migrace_rule_plan_to_lodicka_key" ON "app_m01_svp_migrace_rule"("plan_id", "to_lodicka_id");

-- CreateIndex
CREATE INDEX "app_m01_svp_migrace_rule_source_from_lodicka_idx" ON "app_m01_svp_migrace_rule_source"("from_lodicka_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_m01_svp_migrace_rule_source_rule_from_key" ON "app_m01_svp_migrace_rule_source"("rule_id", "from_lodicka_id");

-- CreateIndex
CREATE INDEX "app_m01_svp_migrace_run_status_idx" ON "app_m01_svp_migrace_run"("status");

-- CreateIndex
CREATE INDEX "app_m01_svp_migrace_run_plan_id_idx" ON "app_m01_svp_migrace_run"("plan_id");

-- CreateIndex
CREATE INDEX "app_ai_knowledge_item_domain_idx" ON "app_ai_knowledge_item"("domain");

-- CreateIndex
CREATE INDEX "app_ai_knowledge_item_is_active_idx" ON "app_ai_knowledge_item"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "app_ai_knowledge_item_source_table_source_id_key" ON "app_ai_knowledge_item"("source_table", "source_id");

-- CreateIndex
CREATE INDEX "app_ai_knowledge_chunk_item_id_idx" ON "app_ai_knowledge_chunk"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_ai_knowledge_chunk_item_chunk_index_key" ON "app_ai_knowledge_chunk"("item_id", "chunk_index");

-- CreateIndex
CREATE INDEX "app_ai_embedding_chunk_id_idx" ON "app_ai_embedding"("chunk_id");

-- CreateIndex
CREATE INDEX "app_ai_embedding_status_idx" ON "app_ai_embedding"("status");

-- CreateIndex
CREATE INDEX "app_ai_embedding_provider_model_idx" ON "app_ai_embedding"("provider", "model");

-- AddForeignKey
ALTER TABLE "app_m01_rvp_uzlovy_bod" ADD CONSTRAINT "app_m01_rvp_uzlovy_bod_rvp_version_id_fkey" FOREIGN KEY ("rvp_version_id") REFERENCES "app_m01_rvp_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_rvp_ovu" ADD CONSTRAINT "app_m01_rvp_ovu_rvp_version_id_fkey" FOREIGN KEY ("rvp_version_id") REFERENCES "app_m01_rvp_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_rvp_ovu" ADD CONSTRAINT "app_m01_rvp_ovu_uzlovy_bod_id_fkey" FOREIGN KEY ("uzlovy_bod_id") REFERENCES "app_m01_rvp_uzlovy_bod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_svp_version" ADD CONSTRAINT "app_m01_svp_version_based_on_rvp_version_id_fkey" FOREIGN KEY ("based_on_rvp_version_id") REFERENCES "app_m01_rvp_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_svp_version" ADD CONSTRAINT "app_m01_svp_version_parent_svp_version_id_fkey" FOREIGN KEY ("parent_svp_version_id") REFERENCES "app_m01_svp_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_svp_version" ADD CONSTRAINT "app_m01_svp_version_approved_by_person_id_fkey" FOREIGN KEY ("approved_by_person_id") REFERENCES "app_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_predmet" ADD CONSTRAINT "app_m01_predmet_svp_version_id_fkey" FOREIGN KEY ("svp_version_id") REFERENCES "app_m01_svp_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_predmet" ADD CONSTRAINT "app_m01_predmet_garant_person_id_fkey" FOREIGN KEY ("garant_person_id") REFERENCES "app_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_podpredmet" ADD CONSTRAINT "app_m01_podpredmet_svp_version_id_fkey" FOREIGN KEY ("svp_version_id") REFERENCES "app_m01_svp_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_podpredmet" ADD CONSTRAINT "app_m01_podpredmet_predmet_id_fkey" FOREIGN KEY ("predmet_id") REFERENCES "app_m01_predmet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_podpredmet" ADD CONSTRAINT "app_m01_podpredmet_garant_person_id_fkey" FOREIGN KEY ("garant_person_id") REFERENCES "app_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_oblast" ADD CONSTRAINT "app_m01_oblast_svp_version_id_fkey" FOREIGN KEY ("svp_version_id") REFERENCES "app_m01_svp_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_oblast" ADD CONSTRAINT "app_m01_oblast_predmet_id_fkey" FOREIGN KEY ("predmet_id") REFERENCES "app_m01_predmet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_oblast" ADD CONSTRAINT "app_m01_oblast_podpredmet_id_fkey" FOREIGN KEY ("podpredmet_id") REFERENCES "app_m01_podpredmet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_lodicka" ADD CONSTRAINT "app_m01_lodicka_svp_version_id_fkey" FOREIGN KEY ("svp_version_id") REFERENCES "app_m01_svp_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_lodicka" ADD CONSTRAINT "app_m01_lodicka_predmet_id_fkey" FOREIGN KEY ("predmet_id") REFERENCES "app_m01_predmet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_lodicka" ADD CONSTRAINT "app_m01_lodicka_podpredmet_id_fkey" FOREIGN KEY ("podpredmet_id") REFERENCES "app_m01_podpredmet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_lodicka" ADD CONSTRAINT "app_m01_lodicka_oblast_id_fkey" FOREIGN KEY ("oblast_id") REFERENCES "app_m01_oblast"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_lodicka" ADD CONSTRAINT "app_m01_lodicka_garant_person_id_fkey" FOREIGN KEY ("garant_person_id") REFERENCES "app_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_lodicka_ovu_link" ADD CONSTRAINT "app_m01_lodicka_ovu_link_lodicka_id_fkey" FOREIGN KEY ("lodicka_id") REFERENCES "app_m01_lodicka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_lodicka_ovu_link" ADD CONSTRAINT "app_m01_lodicka_ovu_link_rvp_ovu_id_fkey" FOREIGN KEY ("rvp_ovu_id") REFERENCES "app_m01_rvp_ovu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_lodicka_prerequisite" ADD CONSTRAINT "app_m01_lodicka_prerequisite_lodicka_id_fkey" FOREIGN KEY ("lodicka_id") REFERENCES "app_m01_lodicka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_lodicka_prerequisite" ADD CONSTRAINT "app_m01_lodicka_prerequisite_required_lodicka_id_fkey" FOREIGN KEY ("required_lodicka_id") REFERENCES "app_m01_lodicka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_osobni_sada_lodicek" ADD CONSTRAINT "app_m01_osobni_sada_lodicek_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "app_person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_osobni_sada_lodicek" ADD CONSTRAINT "app_m01_osobni_sada_lodicek_svp_version_id_fkey" FOREIGN KEY ("svp_version_id") REFERENCES "app_m01_svp_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_osobni_lodicka" ADD CONSTRAINT "app_m01_osobni_lodicka_osobni_sada_id_fkey" FOREIGN KEY ("osobni_sada_id") REFERENCES "app_m01_osobni_sada_lodicek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_osobni_lodicka" ADD CONSTRAINT "app_m01_osobni_lodicka_lodicka_id_fkey" FOREIGN KEY ("lodicka_id") REFERENCES "app_m01_lodicka"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_osobni_lodicka_event" ADD CONSTRAINT "app_m01_osobni_lodicka_event_osobni_lodicka_id_fkey" FOREIGN KEY ("osobni_lodicka_id") REFERENCES "app_m01_osobni_lodicka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_osobni_lodicka_event" ADD CONSTRAINT "app_m01_osobni_lodicka_event_changed_by_person_id_fkey" FOREIGN KEY ("changed_by_person_id") REFERENCES "app_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_svp_migrace_plan" ADD CONSTRAINT "app_m01_svp_migrace_plan_from_svp_version_id_fkey" FOREIGN KEY ("from_svp_version_id") REFERENCES "app_m01_svp_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_svp_migrace_plan" ADD CONSTRAINT "app_m01_svp_migrace_plan_to_svp_version_id_fkey" FOREIGN KEY ("to_svp_version_id") REFERENCES "app_m01_svp_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_svp_migrace_plan" ADD CONSTRAINT "app_m01_svp_migrace_plan_approved_by_person_id_fkey" FOREIGN KEY ("approved_by_person_id") REFERENCES "app_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_svp_migrace_rule" ADD CONSTRAINT "app_m01_svp_migrace_rule_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "app_m01_svp_migrace_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_svp_migrace_rule" ADD CONSTRAINT "app_m01_svp_migrace_rule_to_lodicka_id_fkey" FOREIGN KEY ("to_lodicka_id") REFERENCES "app_m01_lodicka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_svp_migrace_rule_source" ADD CONSTRAINT "app_m01_svp_migrace_rule_source_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "app_m01_svp_migrace_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_svp_migrace_rule_source" ADD CONSTRAINT "app_m01_svp_migrace_rule_source_from_lodicka_id_fkey" FOREIGN KEY ("from_lodicka_id") REFERENCES "app_m01_lodicka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_m01_svp_migrace_run" ADD CONSTRAINT "app_m01_svp_migrace_run_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "app_m01_svp_migrace_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_ai_knowledge_chunk" ADD CONSTRAINT "app_ai_knowledge_chunk_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "app_ai_knowledge_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_ai_embedding" ADD CONSTRAINT "app_ai_embedding_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "app_ai_knowledge_chunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
