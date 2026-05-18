WITH ordered_versions AS (
  SELECT
    id,
    row_number() OVER (ORDER BY effective_from ASC, created_at ASC, id ASC)::int AS version_number
  FROM app_m01_svp_version
  WHERE major >= 1000
)
UPDATE app_m01_svp_version svp
SET
  major = ordered_versions.version_number,
  minor = 0,
  patch = 0,
  version_label = ordered_versions.version_number::text,
  updated_at = now()
FROM ordered_versions
WHERE svp.id = ordered_versions.id;
