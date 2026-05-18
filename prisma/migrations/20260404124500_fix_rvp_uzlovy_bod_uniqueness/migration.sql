-- RVP uzlové body mají opakující se kódy (např. ZV3/ZV5/ZV9),
-- proto nelze vynucovat unikátnost jen podle (rvp_version_id, kod).
-- Zavádíme stabilní source_path a unikátnost podle (rvp_version_id, source_path).

ALTER TABLE "app_m01_rvp_uzlovy_bod"
  ADD COLUMN "source_path" TEXT;

UPDATE "app_m01_rvp_uzlovy_bod"
SET "source_path" = 'legacy:' || "id"
WHERE "source_path" IS NULL;

ALTER TABLE "app_m01_rvp_uzlovy_bod"
  ALTER COLUMN "source_path" SET NOT NULL;

DROP INDEX IF EXISTS "app_m01_rvp_uzlovy_bod_version_kod_key";

CREATE UNIQUE INDEX "app_m01_rvp_uzlovy_bod_version_path_key"
  ON "app_m01_rvp_uzlovy_bod"("rvp_version_id", "source_path");
