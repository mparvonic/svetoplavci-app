CREATE INDEX IF NOT EXISTS "app_m01_podpredmet_version_stupen_predmet_idx"
  ON "app_m01_podpredmet"("svp_version_id", "stupen", "predmet_id");

CREATE INDEX IF NOT EXISTS "app_m01_oblast_version_stupen_tree_idx"
  ON "app_m01_oblast"("svp_version_id", "stupen", "predmet_id", "podpredmet_id");

CREATE INDEX IF NOT EXISTS "app_m01_lodicka_version_oblast_idx"
  ON "app_m01_lodicka"("svp_version_id", "oblast_id");

CREATE OR REPLACE FUNCTION app_m01_validate_podpredmet_hierarchy()
RETURNS trigger AS $$
DECLARE
  predmet_record record;
BEGIN
  SELECT p.svp_version_id, p.stupen
    INTO predmet_record
  FROM app_m01_predmet p
  WHERE p.id = NEW.predmet_id;

  IF predmet_record IS NULL THEN
    RAISE EXCEPTION 'M01 podpredmet % references missing predmet %', NEW.id, NEW.predmet_id;
  END IF;

  IF predmet_record.svp_version_id <> NEW.svp_version_id OR predmet_record.stupen <> NEW.stupen THEN
    RAISE EXCEPTION 'M01 podpredmet % must stay in the same SVP version and stage as its predmet', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app_m01_validate_oblast_hierarchy()
RETURNS trigger AS $$
DECLARE
  predmet_record record;
  podpredmet_record record;
BEGIN
  SELECT p.svp_version_id, p.stupen
    INTO predmet_record
  FROM app_m01_predmet p
  WHERE p.id = NEW.predmet_id;

  IF predmet_record IS NULL THEN
    RAISE EXCEPTION 'M01 oblast % references missing predmet %', NEW.id, NEW.predmet_id;
  END IF;

  IF predmet_record.svp_version_id <> NEW.svp_version_id OR predmet_record.stupen <> NEW.stupen THEN
    RAISE EXCEPTION 'M01 oblast % must stay in the same SVP version and stage as its predmet', NEW.id;
  END IF;

  IF NEW.podpredmet_id IS NOT NULL THEN
    SELECT pp.svp_version_id, pp.predmet_id, pp.stupen
      INTO podpredmet_record
    FROM app_m01_podpredmet pp
    WHERE pp.id = NEW.podpredmet_id;

    IF podpredmet_record IS NULL THEN
      RAISE EXCEPTION 'M01 oblast % references missing podpredmet %', NEW.id, NEW.podpredmet_id;
    END IF;

    IF podpredmet_record.svp_version_id <> NEW.svp_version_id
       OR podpredmet_record.stupen <> NEW.stupen
       OR podpredmet_record.predmet_id <> NEW.predmet_id THEN
      RAISE EXCEPTION 'M01 oblast % podpredmet must belong to the same predmet, SVP version and stage', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app_m01_validate_lodicka_hierarchy()
RETURNS trigger AS $$
DECLARE
  oblast_record record;
BEGIN
  SELECT ob.svp_version_id, ob.predmet_id, ob.podpredmet_id, ob.stupen
    INTO oblast_record
  FROM app_m01_oblast ob
  WHERE ob.id = NEW.oblast_id;

  IF oblast_record IS NULL THEN
    RAISE EXCEPTION 'M01 lodicka % references missing oblast %', NEW.id, NEW.oblast_id;
  END IF;

  IF oblast_record.svp_version_id <> NEW.svp_version_id
     OR oblast_record.predmet_id <> NEW.predmet_id
     OR oblast_record.stupen <> NEW.stupen
     OR oblast_record.podpredmet_id IS DISTINCT FROM NEW.podpredmet_id THEN
    RAISE EXCEPTION 'M01 lodicka % must inherit predmet, podpredmet, SVP version and stage from its oblast', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_m01_validate_podpredmet_hierarchy ON app_m01_podpredmet;
CREATE TRIGGER trg_m01_validate_podpredmet_hierarchy
  BEFORE INSERT OR UPDATE OF svp_version_id, predmet_id, stupen
  ON app_m01_podpredmet
  FOR EACH ROW
  EXECUTE FUNCTION app_m01_validate_podpredmet_hierarchy();

DROP TRIGGER IF EXISTS trg_m01_validate_oblast_hierarchy ON app_m01_oblast;
CREATE TRIGGER trg_m01_validate_oblast_hierarchy
  BEFORE INSERT OR UPDATE OF svp_version_id, predmet_id, podpredmet_id, stupen
  ON app_m01_oblast
  FOR EACH ROW
  EXECUTE FUNCTION app_m01_validate_oblast_hierarchy();

DROP TRIGGER IF EXISTS trg_m01_validate_lodicka_hierarchy ON app_m01_lodicka;
CREATE TRIGGER trg_m01_validate_lodicka_hierarchy
  BEFORE INSERT OR UPDATE OF svp_version_id, predmet_id, podpredmet_id, oblast_id, stupen
  ON app_m01_lodicka
  FOR EACH ROW
  EXECUTE FUNCTION app_m01_validate_lodicka_hierarchy();
