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
-- Use realistic deterministic mock names instead of hash-like display names.
WITH mock_names AS (
  SELECT
    p.id,
    split_part(full_name, ' ', 1) AS mock_first_name,
    substring(full_name from position(' ' in full_name) + 1) AS mock_last_name,
    nicknames[1 + (('x' || substr(md5(current_setting('app.anonymize_salt') || p.id || ':nick'), 1, 8))::bit(32)::bigint % array_length(nicknames, 1))] AS mock_nickname
  FROM app_person p
  CROSS JOIN LATERAL (
    SELECT full_names[1 + (('x' || substr(md5(current_setting('app.anonymize_salt') || p.id || ':name'), 1, 8))::bit(32)::bigint % array_length(full_names, 1))] AS full_name
    FROM (
      SELECT ARRAY[
        'Adam Bartoš', 'Adam Černý', 'Adam Dvořák', 'Adam Fiala',
        'Adéla Benešová', 'Adéla Černá', 'Adéla Hájková', 'Adéla Králová',
        'Albert Horák', 'Albert Kadlec', 'Albert Kučera', 'Albert Svoboda',
        'Alena Doležalová', 'Alena Jelínková', 'Alena Nováková', 'Alena Veselá',
        'Amálie Marková', 'Amálie Pokorná', 'Amálie Procházková', 'Amálie Zemanová',
        'Anna Dvořáková', 'Anna Horáková', 'Anna Růžičková', 'Anna Šimková',
        'Barbora Fialová', 'Barbora Králová', 'Barbora Sedláčková', 'Barbora Vlčková',
        'Berenika Malá', 'Berenika Navrátilová', 'Berenika Svobodová', 'Berenika Veselá',
        'Daniel Bartoš', 'Daniel Jelínek', 'Daniel Novák', 'Daniel Zeman',
        'David Černý', 'David Horák', 'David Procházka', 'David Šimek',
        'Eliška Benešová', 'Eliška Dvořáková', 'Eliška Kadlecová', 'Eliška Růžičková',
        'Ema Černá', 'Ema Fialová', 'Ema Pokorná', 'Ema Svobodová',
        'Filip Doležal', 'Filip Král', 'Filip Sedláček', 'Filip Vlček',
        'František Fiala', 'František Kadlec', 'František Marek', 'František Veselý',
        'Hana Hájková', 'Hana Marková', 'Hana Procházková', 'Hana Zemanová',
        'Jakub Beneš', 'Jakub Kučera', 'Jakub Navrátil', 'Jakub Svoboda',
        'Jan Bartoš', 'Jan Dvořák', 'Jan Pokorný', 'Jan Růžička',
        'Jana Horáková', 'Jana Jelínková', 'Jana Nováková', 'Jana Šimková',
        'Jitka Černá', 'Jitka Doležalová', 'Jitka Králová', 'Jitka Veselá',
        'Josef Kadlec', 'Josef Malý', 'Josef Procházka', 'Josef Zeman',
        'Karolína Benešová', 'Karolína Fialová', 'Karolína Sedláčková', 'Karolína Vlčková',
        'Klára Hájková', 'Klára Marková', 'Klára Pokorná', 'Klára Svobodová',
        'Kristýna Dvořáková', 'Kristýna Králová', 'Kristýna Růžičková', 'Kristýna Zemanová',
        'Lucie Černá', 'Lucie Jelínková', 'Lucie Nováková', 'Lucie Veselá',
        'Marek Horák', 'Marek Kučera', 'Marek Sedláček', 'Marek Šimek',
        'Marie Benešová', 'Marie Doležalová', 'Marie Procházková', 'Marie Šimková',
        'Martin Bartoš', 'Martin Dvořák', 'Martin Navrátil', 'Martin Svoboda',
        'Matěj Černý', 'Matěj Fiala', 'Matěj Pokorný', 'Matěj Růžička',
        'Michaela Hájková', 'Michaela Kadlecová', 'Michaela Marková', 'Michaela Vlčková',
        'Mikuláš Jelínek', 'Mikuláš Král', 'Mikuláš Malý', 'Mikuláš Veselý',
        'Natálie Dvořáková', 'Natálie Králová', 'Natálie Sedláčková', 'Natálie Zemanová',
        'Nela Benešová', 'Nela Fialová', 'Nela Pokorná', 'Nela Svobodová',
        'Ondřej Horák', 'Ondřej Kadlec', 'Ondřej Novák', 'Ondřej Procházka',
        'Patrik Bartoš', 'Patrik Černý', 'Patrik Kučera', 'Patrik Vlček',
        'Pavel Doležal', 'Pavel Marek', 'Pavel Růžička', 'Pavel Šimek',
        'Petra Hájková', 'Petra Marková', 'Petra Nováková', 'Petra Veselá',
        'Prokop Fiala', 'Prokop Kadlec', 'Prokop Sedláček', 'Prokop Zeman',
        'Radek Dvořák', 'Radek Král', 'Radek Navrátil', 'Radek Svoboda',
        'Sabina Černá', 'Sabina Jelínková', 'Sabina Procházková', 'Sabina Šimková',
        'Samuel Beneš', 'Samuel Horák', 'Samuel Pokorný', 'Samuel Veselý',
        'Simona Doležalová', 'Simona Králová', 'Simona Růžičková', 'Simona Vlčková',
        'Sofie Fialová', 'Sofie Kadlecová', 'Sofie Svobodová', 'Sofie Zemanová',
        'Šimon Bartoš', 'Šimon Černý', 'Šimon Marek', 'Šimon Procházka',
        'Tereza Benešová', 'Tereza Dvořáková', 'Tereza Nováková', 'Tereza Veselá',
        'Tomáš Horák', 'Tomáš Kučera', 'Tomáš Sedláček', 'Tomáš Šimek',
        'Václav Fiala', 'Václav Jelínek', 'Václav Růžička', 'Václav Zeman',
        'Veronika Hájková', 'Veronika Králová', 'Veronika Marková', 'Veronika Pokorná',
        'Viktor Bartoš', 'Viktor Kadlec', 'Viktor Navrátil', 'Viktor Svoboda'
      ]::text[] AS full_names
    ) full_name_pool
  ) selected_name
  CROSS JOIN (
    SELECT
      ARRAY[
        'modra-plachta', 'tichy-pristav', 'slunecni-kompas', 'rychla-kotva',
        'morska-hvezda', 'severni-vitr', 'zlata-vlna', 'jasny-majak',
        'dobra-posadka', 'klidna-zatoka', 'ranni-proud', 'vesely-kapitán'
      ]::text[] AS nicknames
  ) names
)
UPDATE app_person p
SET
  first_name = mock.mock_first_name,
  middle_name = NULL,
  last_name = mock.mock_last_name,
  display_name = mock.mock_first_name || ' ' || mock.mock_last_name,
  nickname = mock.mock_nickname || '-' || substr(md5(current_setting('app.anonymize_salt') || p.id || ':nick'), 1, 4),
  identifier = CASE WHEN p.identifier IS NULL THEN NULL ELSE 'id_' || substr(md5(current_setting('app.anonymize_salt') || p.id || ':identifier'), 1, 12) END,
  plus4u_id = CASE WHEN p.plus4u_id IS NULL THEN NULL ELSE 'p4u_' || substr(md5(current_setting('app.anonymize_salt') || p.id || ':plus4u'), 1, 12) END,
  chip_uid = NULL,
  chip_hid = NULL,
  photo = NULL,
  updated_at = now()
FROM mock_names mock
WHERE mock.id = p.id;

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
