import { Prisma } from "@prisma/client";

export async function copySvpVersionContent(
  tx: Prisma.TransactionClient,
  input: { fromSvpVersionId: string; toSvpVersionId: string },
) {
  await tx.$executeRaw(Prisma.sql`DROP TABLE IF EXISTS tmp_m01_predmet_copy_map`);
  await tx.$executeRaw(Prisma.sql`DROP TABLE IF EXISTS tmp_m01_podpredmet_copy_map`);
  await tx.$executeRaw(Prisma.sql`DROP TABLE IF EXISTS tmp_m01_oblast_copy_map`);
  await tx.$executeRaw(Prisma.sql`DROP TABLE IF EXISTS tmp_m01_lodicka_copy_map`);

  await tx.$executeRaw(Prisma.sql`
    CREATE TEMP TABLE tmp_m01_predmet_copy_map ON COMMIT DROP AS
    SELECT id AS old_id, CONCAT('m01-predmet-', gen_random_uuid()::text) AS new_id
    FROM app_m01_predmet
    WHERE svp_version_id = ${input.fromSvpVersionId}
  `);

  await tx.$executeRaw(Prisma.sql`
    CREATE TEMP TABLE tmp_m01_podpredmet_copy_map ON COMMIT DROP AS
    SELECT id AS old_id, CONCAT('m01-podpredmet-', gen_random_uuid()::text) AS new_id
    FROM app_m01_podpredmet
    WHERE svp_version_id = ${input.fromSvpVersionId}
  `);

  await tx.$executeRaw(Prisma.sql`
    CREATE TEMP TABLE tmp_m01_oblast_copy_map ON COMMIT DROP AS
    SELECT id AS old_id, CONCAT('m01-oblast-', gen_random_uuid()::text) AS new_id
    FROM app_m01_oblast
    WHERE svp_version_id = ${input.fromSvpVersionId}
  `);

  await tx.$executeRaw(Prisma.sql`
    CREATE TEMP TABLE tmp_m01_lodicka_copy_map ON COMMIT DROP AS
    SELECT id AS old_id, CONCAT('m01-lodicka-', gen_random_uuid()::text) AS new_id
    FROM app_m01_lodicka
    WHERE svp_version_id = ${input.fromSvpVersionId}
  `);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO app_m01_predmet (
      id, svp_version_id, kod, nazev, stupen, garant_person_id, poradi, is_active, created_at, updated_at
    )
    SELECT
      map.new_id,
      ${input.toSvpVersionId},
      predmet.kod,
      predmet.nazev,
      predmet.stupen,
      NULL,
      predmet.poradi,
      predmet.is_active,
      now(),
      now()
    FROM app_m01_predmet predmet
    JOIN tmp_m01_predmet_copy_map map ON map.old_id = predmet.id
  `);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO app_m01_podpredmet (
      id, svp_version_id, predmet_id, kod, nazev, stupen, garant_person_id, poradi, is_active, created_at, updated_at
    )
    SELECT
      map.new_id,
      ${input.toSvpVersionId},
      predmet_map.new_id,
      podpredmet.kod,
      podpredmet.nazev,
      podpredmet.stupen,
      NULL,
      podpredmet.poradi,
      podpredmet.is_active,
      now(),
      now()
    FROM app_m01_podpredmet podpredmet
    JOIN tmp_m01_podpredmet_copy_map map ON map.old_id = podpredmet.id
    JOIN tmp_m01_predmet_copy_map predmet_map ON predmet_map.old_id = podpredmet.predmet_id
  `);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO app_m01_oblast (
      id, svp_version_id, predmet_id, podpredmet_id, kod, nazev, stupen, poradi, is_active, created_at, updated_at
    )
    SELECT
      map.new_id,
      ${input.toSvpVersionId},
      predmet_map.new_id,
      podpredmet_map.new_id,
      oblast.kod,
      oblast.nazev,
      oblast.stupen,
      oblast.poradi,
      oblast.is_active,
      now(),
      now()
    FROM app_m01_oblast oblast
    JOIN tmp_m01_oblast_copy_map map ON map.old_id = oblast.id
    JOIN tmp_m01_predmet_copy_map predmet_map ON predmet_map.old_id = oblast.predmet_id
    LEFT JOIN tmp_m01_podpredmet_copy_map podpredmet_map ON podpredmet_map.old_id = oblast.podpredmet_id
  `);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO app_m01_oblast_spravce (id, oblast_id, person_id, is_primary, created_at)
    SELECT
      CONCAT('m01-oblast-spravce-', gen_random_uuid()::text),
      oblast_map.new_id,
      spravce.person_id,
      false,
      now()
    FROM app_m01_oblast_spravce spravce
    JOIN tmp_m01_oblast_copy_map oblast_map ON oblast_map.old_id = spravce.oblast_id
    ON CONFLICT (oblast_id, person_id) DO NOTHING
  `);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO app_m01_lodicka (
      id,
      svp_version_id,
      predmet_id,
      podpredmet_id,
      oblast_id,
      kod,
      nazev,
      popis,
      typ,
      rocnik_od,
      rocnik_do,
      stupen,
      garant_person_id,
      ovu_not_applicable,
      je_v_mape,
      is_deleted,
      source_coda_row_id,
      created_at,
      updated_at
    )
    SELECT
      map.new_id,
      ${input.toSvpVersionId},
      predmet_map.new_id,
      podpredmet_map.new_id,
      oblast_map.new_id,
      lodicka.kod,
      lodicka.nazev,
      lodicka.popis,
      lodicka.typ,
      lodicka.rocnik_od,
      lodicka.rocnik_do,
      lodicka.stupen,
      NULL,
      lodicka.ovu_not_applicable,
      lodicka.je_v_mape,
      lodicka.is_deleted,
      lodicka.source_coda_row_id,
      now(),
      now()
    FROM app_m01_lodicka lodicka
    JOIN tmp_m01_lodicka_copy_map map ON map.old_id = lodicka.id
    JOIN tmp_m01_predmet_copy_map predmet_map ON predmet_map.old_id = lodicka.predmet_id
    JOIN tmp_m01_oblast_copy_map oblast_map ON oblast_map.old_id = lodicka.oblast_id
    LEFT JOIN tmp_m01_podpredmet_copy_map podpredmet_map ON podpredmet_map.old_id = lodicka.podpredmet_id
  `);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO app_m01_lodicka_ovu_link (id, lodicka_id, rvp_ovu_id, source_ovu_code, is_primary, created_at)
    SELECT
      CONCAT('m01-lodicka-ovu-', gen_random_uuid()::text),
      lodicka_map.new_id,
      link.rvp_ovu_id,
      link.source_ovu_code,
      link.is_primary,
      now()
    FROM app_m01_lodicka_ovu_link link
    JOIN tmp_m01_lodicka_copy_map lodicka_map ON lodicka_map.old_id = link.lodicka_id
    ON CONFLICT (lodicka_id, rvp_ovu_id) DO NOTHING
  `);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO app_m01_lodicka_stav_garant (id, lodicka_id, person_id, is_primary, created_at)
    SELECT
      CONCAT('m01-lodicka-stav-garant-', gen_random_uuid()::text),
      lodicka_map.new_id,
      garant.person_id,
      false,
      now()
    FROM app_m01_lodicka_stav_garant garant
    JOIN tmp_m01_lodicka_copy_map lodicka_map ON lodicka_map.old_id = garant.lodicka_id
    ON CONFLICT (lodicka_id, person_id) DO NOTHING
  `);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO app_m01_lodicka_garant (id, lodicka_id, person_id, is_primary, created_at)
    SELECT
      CONCAT('m01-lodicka-garant-', gen_random_uuid()::text),
      lodicka_map.new_id,
      spravce.person_id,
      false,
      now()
    FROM app_m01_lodicka_garant spravce
    JOIN tmp_m01_lodicka_copy_map lodicka_map ON lodicka_map.old_id = spravce.lodicka_id
    ON CONFLICT (lodicka_id, person_id) DO NOTHING
  `);
}
