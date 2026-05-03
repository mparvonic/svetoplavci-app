-- Anonymization script for DEV refresh.
-- Run only on a non-production copy.
-- Deterministic pseudonymization using record IDs.

BEGIN;

-- Optional salt: set before run with e.g.
--   SET app.anonymize_salt = 'your-secret-salt';
-- Fallback value is used only if not set.
DO $$
BEGIN
  IF current_setting('app.anonymize_salt', true) IS NULL THEN
    PERFORM set_config('app.anonymize_salt', 'dev-default-salt', false);
  END IF;
END
$$;

-- 1) Core person profile (PII)
UPDATE app_person p
SET
  first_name = CASE WHEN p.first_name IS NULL THEN NULL ELSE 'Jmeno_' || substr(md5(current_setting('app.anonymize_salt') || p.id || ':fn'), 1, 8) END,
  middle_name = NULL,
  last_name = CASE WHEN p.last_name IS NULL THEN NULL ELSE 'Prijmeni_' || substr(md5(current_setting('app.anonymize_salt') || p.id || ':ln'), 1, 8) END,
  display_name = coalesce(
    CASE WHEN p.first_name IS NULL THEN NULL ELSE 'Jmeno_' || substr(md5(current_setting('app.anonymize_salt') || p.id || ':fn'), 1, 8) END,
    'Uzivatel'
  ) || ' ' || coalesce(
    CASE WHEN p.last_name IS NULL THEN NULL ELSE 'Prijmeni_' || substr(md5(current_setting('app.anonymize_salt') || p.id || ':ln'), 1, 8) END,
    substr(md5(current_setting('app.anonymize_salt') || p.id), 1, 6)
  ),
  nickname = 'nick_' || substr(md5(current_setting('app.anonymize_salt') || p.id || ':nick'), 1, 8),
  identifier = CASE WHEN p.identifier IS NULL THEN NULL ELSE 'id_' || substr(md5(current_setting('app.anonymize_salt') || p.identifier), 1, 12) END,
  plus4u_id = CASE WHEN p.plus4u_id IS NULL THEN NULL ELSE 'p4u_' || substr(md5(current_setting('app.anonymize_salt') || p.plus4u_id), 1, 12) END,
  chip_uid = NULL,
  chip_hid = NULL,
  photo = NULL,
  updated_at = now();

-- 2) Login identities (emails)
UPDATE app_login_identity li
SET
  identity_value = CASE
    WHEN li.identity_type = 'email'
      THEN 'user+' || substr(md5(current_setting('app.anonymize_salt') || li.id), 1, 12) || '@example.test'
    ELSE li.identity_value
  END,
  normalized_value = CASE
    WHEN li.identity_type = 'email'
      THEN 'user+' || substr(md5(current_setting('app.anonymize_salt') || li.id), 1, 12) || '@example.test'
    ELSE li.normalized_value
  END,
  updated_at = now();

-- 3) Source records and payloads from external systems
UPDATE app_person_source_record sr
SET
  source_person_id = CASE WHEN sr.source_person_id IS NULL THEN NULL ELSE 'src_' || substr(md5(current_setting('app.anonymize_salt') || sr.id || ':spid'), 1, 10) END,
  source_record_id = CASE WHEN sr.source_record_id IS NULL THEN NULL ELSE 'rec_' || substr(md5(current_setting('app.anonymize_salt') || sr.id || ':rid'), 1, 10) END,
  primary_email = CASE WHEN sr.primary_email IS NULL THEN NULL ELSE 'source+' || substr(md5(current_setting('app.anonymize_salt') || sr.id), 1, 12) || '@example.test' END,
  payload = (
    coalesce(sr.payload::jsonb, '{}'::jsonb)
      - 'Firstname' - 'Middlename' - 'Lastname'
      - 'PrimaryEmail' - 'Identifier' - 'Plus4UId'
      - 'Name' - 'DisplayName' - 'Phone' - 'Address'
  ) || jsonb_build_object(
    'anonymized', true,
    'anonymizedAt', now(),
    'payloadFingerprint', substr(md5(current_setting('app.anonymize_salt') || sr.id), 1, 16)
  ),
  updated_at = now();

-- 4) Remove binary photos
DELETE FROM app_person_photo;

-- 5) Mask selected free-text fields in school events
UPDATE app_school_event
SET
  title = 'Udalost #' || substr(md5(current_setting('app.anonymize_salt') || id), 1, 8),
  description = CASE WHEN description IS NULL THEN NULL ELSE '[ANONYMIZED]' END,
  location = CASE WHEN location IS NULL THEN NULL ELSE '[ANONYMIZED]' END,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('anonymized', true),
  updated_at = now();

UPDATE app_school_event_registration
SET
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('anonymized', true),
  updated_at = now();

UPDATE app_school_event_attendance
SET
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('anonymized', true),
  updated_at = now();

COMMIT;
