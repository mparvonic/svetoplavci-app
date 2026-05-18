DO $$
BEGIN
  IF to_regclass('public.app_m01_osobni_lodicka') IS NOT NULL THEN
    ALTER TABLE "app_m01_osobni_lodicka"
      ALTER COLUMN "datum_stavu" TYPE TIMESTAMPTZ(3) USING
        CASE
          WHEN "datum_stavu" IS NULL THEN NULL
          ELSE "datum_stavu" AT TIME ZONE 'UTC'
        END,
      ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
      ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.app_m01_osobni_lodicka_event') IS NOT NULL THEN
    ALTER TABLE "app_m01_osobni_lodicka_event"
      ALTER COLUMN "datum_stavu" TYPE TIMESTAMPTZ(3) USING "datum_stavu" AT TIME ZONE 'UTC',
      ALTER COLUMN "source_created_at" TYPE TIMESTAMPTZ(3) USING
        CASE
          WHEN "source_created_at" IS NULL THEN NULL
          ELSE "source_created_at" AT TIME ZONE 'UTC'
        END,
      ALTER COLUMN "source_modified_at" TYPE TIMESTAMPTZ(3) USING
        CASE
          WHEN "source_modified_at" IS NULL THEN NULL
          ELSE "source_modified_at" AT TIME ZONE 'UTC'
        END,
      ALTER COLUMN "invalidated_at" TYPE TIMESTAMPTZ(3) USING
        CASE
          WHEN "invalidated_at" IS NULL THEN NULL
          ELSE "invalidated_at" AT TIME ZONE 'UTC'
        END,
      ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
  END IF;
END
$$;
