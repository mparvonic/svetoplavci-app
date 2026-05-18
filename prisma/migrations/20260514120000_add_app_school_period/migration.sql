CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS "app_school_period" (
  "id" TEXT NOT NULL,
  "school_year_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'plavba',
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "period_order" INTEGER NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "app_school_period_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_school_period_school_year_code_key"
  ON "app_school_period"("school_year_id", "code");

CREATE UNIQUE INDEX IF NOT EXISTS "app_school_period_school_year_order_key"
  ON "app_school_period"("school_year_id", "period_order");

CREATE INDEX IF NOT EXISTS "app_school_period_school_year_kind_idx"
  ON "app_school_period"("school_year_id", "kind");

CREATE INDEX IF NOT EXISTS "app_school_period_school_year_range_idx"
  ON "app_school_period"("school_year_id", "start_date", "end_date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_school_period_school_year_id_fkey'
      AND conrelid = 'app_school_period'::regclass
  ) THEN
    ALTER TABLE "app_school_period"
      ADD CONSTRAINT "app_school_period_school_year_id_fkey"
      FOREIGN KEY ("school_year_id") REFERENCES "app_school_year"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_school_period_date_check'
      AND conrelid = 'app_school_period'::regclass
  ) THEN
    ALTER TABLE "app_school_period"
      ADD CONSTRAINT "app_school_period_date_check"
      CHECK ("start_date" <= "end_date");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_school_period_order_check'
      AND conrelid = 'app_school_period'::regclass
  ) THEN
    ALTER TABLE "app_school_period"
      ADD CONSTRAINT "app_school_period_order_check"
      CHECK ("period_order" > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_school_period_no_overlap'
      AND conrelid = 'app_school_period'::regclass
  ) THEN
    ALTER TABLE "app_school_period"
      ADD CONSTRAINT "app_school_period_no_overlap"
      EXCLUDE USING gist (
        "school_year_id" WITH =,
        daterange("start_date", "end_date" + 1, '[)') WITH &&
      );
  END IF;
END $$;
