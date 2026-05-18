-- M01 lodičky: introduce catalog-management roles without removing existing guarantor access.
--
-- Existing active "garant" role assignments keep their current meaning and are
-- additionally copied to "spravce_lodicek" so current guarantors can manage
-- assigned catalog lodičky during the transition.

INSERT INTO "app_role_assignment" (
  "id",
  "person_id",
  "role",
  "source",
  "is_active",
  "valid_from",
  "valid_to",
  "created_at",
  "updated_at"
)
SELECT
  'role-spravce-lodicek-from-garant-' || source_role."person_id",
  source_role."person_id",
  'spravce_lodicek',
  'm01_role_migration_20260514',
  true,
  now(),
  NULL,
  now(),
  now()
FROM (
  SELECT DISTINCT "person_id"
  FROM "app_role_assignment"
  WHERE "role" = 'garant'
    AND "is_active" = true
) source_role
WHERE NOT EXISTS (
  SELECT 1
  FROM "app_role_assignment" existing_role
  WHERE existing_role."person_id" = source_role."person_id"
    AND existing_role."role" = 'spravce_lodicek'
    AND existing_role."is_active" = true
)
ON CONFLICT ("person_id", "role", "source") DO UPDATE
SET
  "is_active" = true,
  "valid_to" = NULL,
  "updated_at" = now();
