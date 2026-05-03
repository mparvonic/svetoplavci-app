-- Post-anonymization validation checks for DEV.

-- Basic row counts
SELECT 'app_person' AS table_name, count(*) AS rows FROM app_person
UNION ALL
SELECT 'app_login_identity', count(*) FROM app_login_identity
UNION ALL
SELECT 'app_person_source_record', count(*) FROM app_person_source_record
UNION ALL
SELECT 'app_person_photo', count(*) FROM app_person_photo;

-- Should be zero after anonymization
SELECT count(*) AS non_null_chip_uid FROM app_person WHERE chip_uid IS NOT NULL;
SELECT count(*) AS non_null_chip_hid FROM app_person WHERE chip_hid IS NOT NULL;

-- Quick email sanity: all email identities should end with @example.test
SELECT count(*) AS bad_email_identities
FROM app_login_identity
WHERE identity_type = 'email'
  AND normalized_value !~ '@example\.test$';

-- Optional spot-check
SELECT id, display_name, nickname, first_name, last_name, identifier, plus4u_id
FROM app_person
ORDER BY created_at DESC
LIMIT 20;
