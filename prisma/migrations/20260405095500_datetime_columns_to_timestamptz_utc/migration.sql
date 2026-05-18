-- Standardize all public DateTime columns to timestamptz while preserving existing
-- values as UTC instants.
--
-- Important:
-- - This migration intentionally uses AT TIME ZONE 'UTC' for conversion.
-- - For business-local display/use (CET/CEST), convert on read/write in app/query layer.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop exclusion constraints that depend on tsrange(timestamp) before type conversion.
DO $$
BEGIN
  IF to_regclass('public.app_group_membership') IS NOT NULL THEN
    ALTER TABLE public.app_group_membership
      DROP CONSTRAINT IF EXISTS app_group_membership_singleton_kinds;
  END IF;

  IF to_regclass('public.app_student_state') IS NOT NULL THEN
    ALTER TABLE public.app_student_state
      DROP CONSTRAINT IF EXISTS app_student_state_no_overlap;
  END IF;
END
$$;

-- Convert all timestamp without time zone columns in public schema to timestamptz.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      c.table_name,
      c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.data_type = 'timestamp without time zone'
    ORDER BY c.table_name, c.ordinal_position
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE TIMESTAMPTZ(3) USING CASE WHEN %I IS NULL THEN NULL ELSE %I AT TIME ZONE ''UTC'' END',
      'public',
      r.table_name,
      r.column_name,
      r.column_name,
      r.column_name
    );
  END LOOP;
END
$$;

-- Recreate exclusion constraints using tstzrange.
DO $$
BEGIN
  IF to_regclass('public.app_group_membership') IS NOT NULL THEN
    ALTER TABLE public.app_group_membership
      ADD CONSTRAINT app_group_membership_singleton_kinds
      EXCLUDE USING gist (
        person_id WITH =,
        group_kind WITH =,
        tstzrange(valid_from, COALESCE(valid_to, 'infinity'::timestamptz), '[)') WITH &&
      )
      WHERE (
        group_kind = ANY (ARRAY[
          'rocnik'::"AppGroupKind",
          'smecka'::"AppGroupKind",
          'posadka'::"AppGroupKind"
        ])
      );
  END IF;

  IF to_regclass('public.app_student_state') IS NOT NULL THEN
    ALTER TABLE public.app_student_state
      ADD CONSTRAINT app_student_state_no_overlap
      EXCLUDE USING gist (
        person_id WITH =,
        tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
      );
  END IF;
END
$$;

-- Keep policy validation deterministic with timestamptz semantics.
DO $$
BEGIN
  IF to_regprocedure('public.fn_validate_membership_policies_for_person(text,text,boolean)') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.fn_validate_membership_policies_for_person(
        p_person_id text,
        p_change_source text DEFAULT 'system'::text,
        p_force_strict boolean DEFAULT false
      )
      RETURNS void
      LANGUAGE plpgsql
      AS $body$
      DECLARE
        v_now TIMESTAMPTZ(3) := CURRENT_TIMESTAMP;
        v_mode TEXT;
        v_study_mode TEXT := 'unknown';
        v_actual_count INT;
        v_group_exists BOOLEAN;
        v_violation_id TEXT;
        v_key TEXT;
        v_processed_keys TEXT[] := ARRAY[]::TEXT[];
        v_has_strict_error BOOLEAN := false;
        v_error_messages TEXT := '';
        rec RECORD;
        stale RECORD;
      BEGIN
        IF p_person_id IS NULL OR p_person_id = '' THEN
          RETURN;
        END IF;

        v_mode := CASE
          WHEN p_force_strict THEN 'strict'
          WHEN lower(COALESCE(p_change_source, '')) LIKE 'edookit%' THEN 'monitor'
          WHEN lower(COALESCE(p_change_source, '')) IN ('auto', 'system', 'policy_change', 'migration', 'seed') THEN 'monitor'
          ELSE 'strict'
        END;

        SELECT COALESCE(ss."study_mode_key"::TEXT, 'unknown')
        INTO v_study_mode
        FROM "app_student_state" ss
        WHERE ss."person_id" = p_person_id
          AND ss."effective_from" <= v_now
          AND (ss."effective_to" IS NULL OR ss."effective_to" > v_now)
        ORDER BY ss."effective_from" DESC
        LIMIT 1;

        FOR rec IN
          WITH active_roles AS (
            SELECT DISTINCT ra."role"
            FROM "app_role_assignment" ra
            WHERE ra."person_id" = p_person_id
              AND ra."is_active" = true
              AND (ra."valid_from" IS NULL OR ra."valid_from" <= v_now)
              AND (ra."valid_to" IS NULL OR ra."valid_to" > v_now)
          ),
          applicable AS (
            SELECT
              pr."group_kind",
              pr."min_count",
              pr."max_count",
              pr."enforcement",
              p."scope"::TEXT AS "rule_scope",
              p."scope_value" AS "rule_scope_value",
              p."priority",
              CASE p."scope"
                WHEN 'role' THEN 1
                WHEN 'study_mode' THEN 2
                ELSE 3
              END AS "scope_order"
            FROM "app_membership_policy" p
            JOIN "app_membership_policy_rule" pr
              ON pr."policy_id" = p."id"
            WHERE p."is_active" = true
              AND p."valid_from" <= v_now
              AND (p."valid_to" IS NULL OR p."valid_to" > v_now)
              AND (
                p."scope" = 'global'
                OR (p."scope" = 'study_mode' AND p."scope_value" = v_study_mode)
                OR (
                  p."scope" = 'role'
                  AND EXISTS (
                    SELECT 1
                    FROM active_roles ar
                    WHERE ar."role" = p."scope_value"
                  )
                )
              )
          ),
          chosen AS (
            SELECT DISTINCT ON ("group_kind")
              "group_kind",
              "min_count",
              "max_count",
              "enforcement",
              "rule_scope",
              "rule_scope_value"
            FROM applicable
            ORDER BY "group_kind", "priority" ASC, "scope_order" ASC, "rule_scope_value" ASC NULLS FIRST
          )
          SELECT *
          FROM chosen
        LOOP
          v_key := rec."group_kind"::TEXT || '|' || rec."rule_scope" || '|' || COALESCE(rec."rule_scope_value", '');
          v_processed_keys := array_append(v_processed_keys, v_key);

          IF rec."enforcement" = 'if_group_exists' THEN
            SELECT EXISTS (
              SELECT 1
              FROM "app_group" g
              WHERE g."kind" = rec."group_kind"
                AND g."is_active" = true
                AND g."valid_from" <= v_now
                AND (g."valid_to" IS NULL OR g."valid_to" > v_now)
            )
            INTO v_group_exists;

            IF NOT v_group_exists THEN
              SELECT mv."id"
              INTO v_violation_id
              FROM "app_membership_violation" mv
              WHERE mv."person_id" = p_person_id
                AND mv."source" = 'policy_validator'
                AND mv."resolved_at" IS NULL
                AND mv."rule_scope" = rec."rule_scope"
                AND mv."group_kind" = rec."group_kind"
                AND (
                  (mv."rule_scope_value" IS NULL AND rec."rule_scope_value" IS NULL)
                  OR mv."rule_scope_value" = rec."rule_scope_value"
                )
              LIMIT 1;

              IF v_violation_id IS NOT NULL THEN
                UPDATE "app_membership_violation"
                SET
                  "resolved_at" = v_now,
                  "resolved_by" = 'system:policy-validator'
                WHERE "id" = v_violation_id;
              END IF;
              CONTINUE;
            END IF;
          END IF;

          SELECT COUNT(*)
          INTO v_actual_count
          FROM "app_group_membership" gm
          WHERE gm."person_id" = p_person_id
            AND gm."group_kind" = rec."group_kind"
            AND gm."valid_from" <= v_now
            AND (gm."valid_to" IS NULL OR gm."valid_to" > v_now);

          SELECT mv."id"
          INTO v_violation_id
          FROM "app_membership_violation" mv
          WHERE mv."person_id" = p_person_id
            AND mv."source" = 'policy_validator'
            AND mv."resolved_at" IS NULL
            AND mv."rule_scope" = rec."rule_scope"
            AND mv."group_kind" = rec."group_kind"
            AND (
              (mv."rule_scope_value" IS NULL AND rec."rule_scope_value" IS NULL)
              OR mv."rule_scope_value" = rec."rule_scope_value"
            )
          LIMIT 1;

          IF v_actual_count < rec."min_count" OR (rec."max_count" IS NOT NULL AND v_actual_count > rec."max_count") THEN
            IF v_violation_id IS NULL THEN
              INSERT INTO "app_membership_violation" (
                "id",
                "person_id",
                "occurred_at",
                "interval_from",
                "interval_to",
                "rule_scope",
                "rule_scope_value",
                "group_kind",
                "expected_min",
                "expected_max",
                "actual_count",
                "severity",
                "source",
                "context",
                "resolved_at",
                "resolved_by"
              )
              VALUES (
                CONCAT('vio_', md5(p_person_id || ':' || rec."group_kind"::TEXT || ':' || rec."rule_scope" || ':' || COALESCE(rec."rule_scope_value", '') || ':' || clock_timestamp()::TEXT)),
                p_person_id,
                v_now,
                v_now,
                NULL,
                rec."rule_scope",
                rec."rule_scope_value",
                rec."group_kind",
                rec."min_count",
                rec."max_count",
                v_actual_count,
                CASE WHEN rec."enforcement" = 'strict' THEN 'error' ELSE 'warning' END,
                'policy_validator',
                jsonb_build_object(
                  'enforcement', rec."enforcement",
                  'validatedAt', v_now,
                  'changeSource', COALESCE(p_change_source, 'unknown'),
                  'mode', v_mode
                ),
                NULL,
                NULL
              );
            ELSE
              UPDATE "app_membership_violation"
              SET
                "occurred_at" = v_now,
                "interval_from" = v_now,
                "interval_to" = NULL,
                "expected_min" = rec."min_count",
                "expected_max" = rec."max_count",
                "actual_count" = v_actual_count,
                "severity" = CASE WHEN rec."enforcement" = 'strict' THEN 'error' ELSE 'warning' END,
                "context" = jsonb_build_object(
                  'enforcement', rec."enforcement",
                  'validatedAt', v_now,
                  'changeSource', COALESCE(p_change_source, 'unknown'),
                  'mode', v_mode
                ),
                "resolved_at" = NULL,
                "resolved_by" = NULL
              WHERE "id" = v_violation_id;
            END IF;

            IF v_mode = 'strict' AND rec."enforcement" = 'strict' THEN
              v_has_strict_error := true;
              v_error_messages := v_error_messages
                || CASE WHEN v_error_messages = '' THEN '' ELSE '; ' END
                || rec."group_kind"::TEXT
                || ' expected '
                || rec."min_count"::TEXT
                || '..'
                || COALESCE(rec."max_count"::TEXT, '∞')
                || ', actual '
                || v_actual_count::TEXT;
            END IF;
          ELSE
            IF v_violation_id IS NOT NULL THEN
              UPDATE "app_membership_violation"
              SET
                "resolved_at" = v_now,
                "resolved_by" = 'system:policy-validator'
              WHERE "id" = v_violation_id;
            END IF;
          END IF;
        END LOOP;

        FOR stale IN
          SELECT
            mv."id",
            mv."group_kind"::TEXT AS "group_kind",
            mv."rule_scope",
            COALESCE(mv."rule_scope_value", '') AS "rule_scope_value"
          FROM "app_membership_violation" mv
          WHERE mv."person_id" = p_person_id
            AND mv."source" = 'policy_validator'
            AND mv."resolved_at" IS NULL
        LOOP
          v_key := stale."group_kind" || '|' || stale."rule_scope" || '|' || stale."rule_scope_value";
          IF NOT (v_key = ANY(v_processed_keys)) THEN
            UPDATE "app_membership_violation"
            SET
              "resolved_at" = v_now,
              "resolved_by" = 'system:policy-validator'
            WHERE "id" = stale."id";
          END IF;
        END LOOP;

        IF v_has_strict_error THEN
          RAISE EXCEPTION 'Membership policy violation for person %: %', p_person_id, v_error_messages
            USING ERRCODE = '23514';
        END IF;
      END;
      $body$;
    $fn$;
  END IF;
END
$$;
