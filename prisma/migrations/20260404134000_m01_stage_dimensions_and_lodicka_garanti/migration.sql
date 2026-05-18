-- M01: oddělení číselníků podle stupně + podpora více garantů lodičky

-- Stage dimension for predmet/podpredmet/oblast
ALTER TABLE "app_m01_predmet"
  ADD COLUMN "stupen" "M01Stupen" NOT NULL DEFAULT 'I_STUPEN';

ALTER TABLE "app_m01_podpredmet"
  ADD COLUMN "stupen" "M01Stupen" NOT NULL DEFAULT 'I_STUPEN';

ALTER TABLE "app_m01_oblast"
  ADD COLUMN "stupen" "M01Stupen" NOT NULL DEFAULT 'I_STUPEN';

-- Replace unique indexes to include stage
DROP INDEX IF EXISTS "app_m01_predmet_version_nazev_key";
DROP INDEX IF EXISTS "app_m01_predmet_version_kod_key";
DROP INDEX IF EXISTS "app_m01_podpredmet_version_kod_key";
DROP INDEX IF EXISTS "app_m01_oblast_version_kod_key";

CREATE UNIQUE INDEX "app_m01_predmet_version_nazev_stupen_key"
  ON "app_m01_predmet"("svp_version_id", "nazev", "stupen");

CREATE UNIQUE INDEX "app_m01_predmet_version_kod_stupen_key"
  ON "app_m01_predmet"("svp_version_id", "kod", "stupen");

CREATE UNIQUE INDEX "app_m01_podpredmet_version_kod_stupen_key"
  ON "app_m01_podpredmet"("svp_version_id", "kod", "stupen");

CREATE UNIQUE INDEX "app_m01_oblast_version_kod_stupen_key"
  ON "app_m01_oblast"("svp_version_id", "kod", "stupen");

-- NOTE: for podpredmet_id = NULL Postgres allows multiple rows; dedup is enforced in import logic.
CREATE UNIQUE INDEX "app_m01_oblast_version_predmet_podpredmet_nazev_key"
  ON "app_m01_oblast"("svp_version_id", "predmet_id", "podpredmet_id", "nazev");

-- M:N lodička-garant link
CREATE TABLE "app_m01_lodicka_garant" (
  "id" TEXT NOT NULL,
  "lodicka_id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "app_m01_lodicka_garant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_m01_lodicka_garant_lodicka_person_key"
  ON "app_m01_lodicka_garant"("lodicka_id", "person_id");

CREATE INDEX "app_m01_lodicka_garant_link_person_id_idx"
  ON "app_m01_lodicka_garant"("person_id");

ALTER TABLE "app_m01_lodicka_garant"
  ADD CONSTRAINT "app_m01_lodicka_garant_lodicka_id_fkey"
  FOREIGN KEY ("lodicka_id") REFERENCES "app_m01_lodicka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_m01_lodicka_garant"
  ADD CONSTRAINT "app_m01_lodicka_garant_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "app_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
