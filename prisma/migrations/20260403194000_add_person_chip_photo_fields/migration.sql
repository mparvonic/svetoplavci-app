ALTER TABLE "app_person"
  ADD COLUMN IF NOT EXISTS "chip_uid" TEXT,
  ADD COLUMN IF NOT EXISTS "chip_hid" TEXT,
  ADD COLUMN IF NOT EXISTS "photo" TEXT;

CREATE INDEX IF NOT EXISTS "app_person_chip_uid_idx" ON "app_person"("chip_uid");
CREATE INDEX IF NOT EXISTS "app_person_chip_hid_idx" ON "app_person"("chip_hid");
