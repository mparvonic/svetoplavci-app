ALTER TYPE "M01SvpZmenaType" ADD VALUE IF NOT EXISTS 'PATCH';

ALTER TABLE app_m01_svp_version
  ADD COLUMN IF NOT EXISTS version_label text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS patch integer NOT NULL DEFAULT 0;

UPDATE app_m01_svp_version
SET version_label = CASE
  WHEN minor = 0 AND patch = 0 THEN major::text
  WHEN patch = 0 THEN major::text || '.' || lpad(minor::text, 2, '0')
  ELSE major::text || '.' || lpad(minor::text, 2, '0') || '.' || lpad(patch::text, 2, '0')
END
WHERE version_label = '1';

ALTER TABLE app_m01_svp_version
  DROP CONSTRAINT IF EXISTS app_m01_svp_version_major_minor_key;

DROP INDEX IF EXISTS app_m01_svp_version_major_minor_key;

CREATE UNIQUE INDEX IF NOT EXISTS app_m01_svp_version_major_minor_patch_key
  ON app_m01_svp_version (major, minor, patch);

CREATE TABLE IF NOT EXISTS app_m01_svp_version_change (
  id text PRIMARY KEY,
  svp_version_id text NOT NULL REFERENCES app_m01_svp_version(id) ON DELETE CASCADE,
  parent_svp_version_id text REFERENCES app_m01_svp_version(id) ON DELETE SET NULL,
  change_type "M01SvpZmenaType" NOT NULL,
  version_label text NOT NULL,
  effective_from timestamptz(3) NOT NULL,
  changed_by_person_id text REFERENCES app_person(id) ON DELETE SET NULL,
  summary jsonb,
  created_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_m01_svp_version_change_svp_idx
  ON app_m01_svp_version_change (svp_version_id);

CREATE INDEX IF NOT EXISTS app_m01_svp_version_change_parent_idx
  ON app_m01_svp_version_change (parent_svp_version_id);

CREATE INDEX IF NOT EXISTS app_m01_svp_version_change_created_at_idx
  ON app_m01_svp_version_change (created_at);
