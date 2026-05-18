-- M01 lodičky: distinguish missing OVU mapping from an explicit "no OVU applies" decision.

ALTER TABLE "app_m01_lodicka"
  ADD COLUMN IF NOT EXISTS "ovu_not_applicable" BOOLEAN NOT NULL DEFAULT false;

UPDATE "app_m01_lodicka" l
SET "ovu_not_applicable" = false
WHERE "ovu_not_applicable" IS NULL;
