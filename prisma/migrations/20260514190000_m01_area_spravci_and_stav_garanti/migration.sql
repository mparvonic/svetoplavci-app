CREATE TABLE IF NOT EXISTS "app_m01_oblast_spravce" (
  "id" TEXT NOT NULL,
  "oblast_id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_m01_oblast_spravce_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "app_m01_lodicka_stav_garant" (
  "id" TEXT NOT NULL,
  "lodicka_id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_m01_lodicka_stav_garant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_m01_oblast_spravce_oblast_person_key"
  ON "app_m01_oblast_spravce"("oblast_id", "person_id");
CREATE INDEX IF NOT EXISTS "app_m01_oblast_spravce_person_id_idx"
  ON "app_m01_oblast_spravce"("person_id");
CREATE INDEX IF NOT EXISTS "app_m01_oblast_spravce_oblast_id_idx"
  ON "app_m01_oblast_spravce"("oblast_id");

CREATE UNIQUE INDEX IF NOT EXISTS "app_m01_lodicka_stav_garant_lodicka_person_key"
  ON "app_m01_lodicka_stav_garant"("lodicka_id", "person_id");
CREATE INDEX IF NOT EXISTS "app_m01_lodicka_stav_garant_person_id_idx"
  ON "app_m01_lodicka_stav_garant"("person_id");
CREATE INDEX IF NOT EXISTS "app_m01_lodicka_stav_garant_lodicka_id_idx"
  ON "app_m01_lodicka_stav_garant"("lodicka_id");

INSERT INTO "app_m01_oblast_spravce" ("id", "oblast_id", "person_id", "is_primary", "created_at")
SELECT
  'm01-oblast-spravce-' || md5(l."oblast_id" || ':' || lg."person_id"),
  l."oblast_id",
  lg."person_id",
  bool_or(lg."is_primary"),
  now()
FROM "app_m01_lodicka_garant" lg
JOIN "app_m01_lodicka" l ON l."id" = lg."lodicka_id" AND l."is_deleted" = false
GROUP BY l."oblast_id", lg."person_id"
ON CONFLICT ("oblast_id", "person_id") DO UPDATE
SET "is_primary" = "app_m01_oblast_spravce"."is_primary" OR EXCLUDED."is_primary";

INSERT INTO "app_m01_lodicka_stav_garant" ("id", "lodicka_id", "person_id", "is_primary", "created_at")
SELECT
  'm01-lodicka-stav-garant-' || md5(l."id" || ':' || l."garant_person_id"),
  l."id",
  l."garant_person_id",
  true,
  now()
FROM "app_m01_lodicka" l
WHERE l."garant_person_id" IS NOT NULL
  AND l."is_deleted" = false
ON CONFLICT ("lodicka_id", "person_id") DO UPDATE
SET "is_primary" = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_m01_oblast_spravce_oblast_id_fkey'
  ) THEN
    ALTER TABLE "app_m01_oblast_spravce"
      ADD CONSTRAINT "app_m01_oblast_spravce_oblast_id_fkey"
      FOREIGN KEY ("oblast_id") REFERENCES "app_m01_oblast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_m01_oblast_spravce_person_id_fkey'
  ) THEN
    ALTER TABLE "app_m01_oblast_spravce"
      ADD CONSTRAINT "app_m01_oblast_spravce_person_id_fkey"
      FOREIGN KEY ("person_id") REFERENCES "app_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_m01_lodicka_stav_garant_lodicka_id_fkey'
  ) THEN
    ALTER TABLE "app_m01_lodicka_stav_garant"
      ADD CONSTRAINT "app_m01_lodicka_stav_garant_lodicka_id_fkey"
      FOREIGN KEY ("lodicka_id") REFERENCES "app_m01_lodicka"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_m01_lodicka_stav_garant_person_id_fkey'
  ) THEN
    ALTER TABLE "app_m01_lodicka_stav_garant"
      ADD CONSTRAINT "app_m01_lodicka_stav_garant_person_id_fkey"
      FOREIGN KEY ("person_id") REFERENCES "app_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
