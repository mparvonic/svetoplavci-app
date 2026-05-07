ALTER TABLE "app_person" ADD COLUMN "merged_into_person_id" TEXT,
ADD COLUMN "merged_at" TIMESTAMP(3),
ADD COLUMN "merged_by" TEXT,
ADD COLUMN "merge_reason" TEXT;

ALTER TABLE "app_person" ADD CONSTRAINT "app_person_merged_into_person_id_fkey" FOREIGN KEY ("merged_into_person_id") REFERENCES "app_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "app_person_merged_into_person_id_idx" ON "app_person"("merged_into_person_id");
