-- A login identity may be approved for exactly one person.
-- Parent-child access must be represented by AppPersonRelation, not by approving
-- one e-mail against both a parent and a child.

WITH duplicated_identities AS (
  SELECT identity_id
  FROM "app_login_person_link"
  WHERE status = 'approved'
  GROUP BY identity_id
  HAVING COUNT(*) > 1
),
conflict_details AS (
  SELECT
    link.identity_id,
    identity.normalized_value,
    jsonb_agg(link.person_id ORDER BY link.person_id) AS person_ids
  FROM "app_login_person_link" link
  JOIN duplicated_identities duplicated ON duplicated.identity_id = link.identity_id
  JOIN "app_login_identity" identity ON identity.id = link.identity_id
  WHERE link.status IN ('approved', 'pending')
  GROUP BY link.identity_id, identity.normalized_value
)
INSERT INTO "app_identity_conflict" (
  "id",
  "identity_id",
  "normalized_value",
  "status",
  "reason",
  "details",
  "resolved_by",
  "resolved_at",
  "created_at",
  "updated_at"
)
SELECT
  'single-approved-login-owner-' || details.identity_id,
  details.identity_id,
  details.normalized_value,
  'open',
  'MULTI_PERSON_IDENTITY',
  jsonb_build_object(
    'personIds', details.person_ids,
    'policy', 'single_approved_login_owner',
    'migration', '20260507090000_single_approved_login_owner'
  ),
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM conflict_details details
WHERE NOT EXISTS (
  SELECT 1
  FROM "app_identity_conflict" conflict
  WHERE conflict.identity_id = details.identity_id
    AND conflict.status = 'open'
    AND conflict.reason = 'MULTI_PERSON_IDENTITY'
);

WITH duplicated_identities AS (
  SELECT identity_id
  FROM "app_login_person_link"
  WHERE status = 'approved'
  GROUP BY identity_id
  HAVING COUNT(*) > 1
)
UPDATE "app_login_person_link" link
SET
  status = 'pending',
  approved_by = NULL,
  approved_at = NULL,
  reason = 'policy_requires_single_approved_login_owner',
  updated_at = CURRENT_TIMESTAMP
FROM duplicated_identities duplicated
WHERE link.identity_id = duplicated.identity_id
  AND link.status = 'approved';

CREATE UNIQUE INDEX "app_login_person_link_single_approved_identity_idx"
  ON "app_login_person_link"("identity_id")
  WHERE status = 'approved';

COMMENT ON INDEX "app_login_person_link_single_approved_identity_idx"
  IS 'Ensures one login identity can be approved for only one AppPerson. Parent-child access belongs to AppPersonRelation.';
