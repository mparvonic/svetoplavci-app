#!/usr/bin/env node

import { createHash } from "node:crypto";
import pg from "pg";

const { Client } = pg;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeMimeType(contentType) {
  if (!contentType) return "";
  return String(contentType).split(";")[0].trim().toLowerCase();
}

function inferMimeType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buffer.length >= 6) {
    const sig = buffer.subarray(0, 6).toString("ascii");
    if (sig === "GIF87a" || sig === "GIF89a") {
      return "image/gif";
    }
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return "application/octet-stream";
}

function createDbClient() {
  const connectionString = process.env.POSTGRES_PRISMA_URL;
  if (!connectionString) {
    throw new Error("Missing POSTGRES_PRISMA_URL");
  }

  const shouldUseSsl = /sslmode=require/i.test(connectionString);
  return new Client({
    connectionString,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
  });
}

async function fetchPhoto(url) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.length) {
    throw new Error("Empty response body");
  }

  const headerMime = normalizeMimeType(response.headers.get("content-type"));
  const mimeType = headerMime || inferMimeType(buffer);

  return {
    buffer,
    mimeType,
    hash: sha256(buffer),
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const onlyCodahosted = !process.argv.includes("--all-http");
  const internalPrefix = (process.env.PERSON_PHOTO_INTERNAL_PREFIX || "/api/media/person-photo").replace(/\/+$/, "");

  const client = createDbClient();
  await client.connect();

  const photoWhere = onlyCodahosted
    ? "photo LIKE 'https://codahosted.io/%'"
    : "photo ~ '^https?://'";

  const query = onlyCodahosted
    ? `SELECT id, display_name, photo FROM app_person WHERE ${photoWhere} ORDER BY display_name ASC`
    : "SELECT id, display_name, photo FROM app_person WHERE photo ~ '^https?://' ORDER BY display_name ASC";

  const sourceRows = await client.query(query);

  const stats = {
    rowsTotal: sourceRows.rows.length,
    downloaded: 0,
    saved: 0,
    failed: 0,
    skipped: 0,
  };

  console.log(
    JSON.stringify(
      {
        dryRun,
        onlyCodahosted,
        rowsTotal: stats.rowsTotal,
      },
      null,
      2
    )
  );

  for (const row of sourceRows.rows) {
    const personId = row.id;
    const displayName = row.display_name;
    const sourceUrl = row.photo;

    try {
      const downloaded = await fetchPhoto(sourceUrl);
      stats.downloaded += 1;

      const internalUrl = `${internalPrefix}/${personId}`;
      if (dryRun) {
        console.log(`[DRY-RUN] ${displayName} (${personId}) -> ${downloaded.mimeType}, ${downloaded.buffer.length} B`);
        stats.skipped += 1;
        continue;
      }

      await client.query("BEGIN");
      await client.query(
        `INSERT INTO app_person_photo (person_id, mime_type, content, size_bytes, source_url, source_hash, fetched_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (person_id)
         DO UPDATE SET
           mime_type = EXCLUDED.mime_type,
           content = EXCLUDED.content,
           size_bytes = EXCLUDED.size_bytes,
           source_url = EXCLUDED.source_url,
           source_hash = EXCLUDED.source_hash,
           fetched_at = NOW(),
           updated_at = NOW()`,
        [personId, downloaded.mimeType, downloaded.buffer, downloaded.buffer.length, sourceUrl, downloaded.hash]
      );

      await client.query("UPDATE app_person SET photo = $2 WHERE id = $1", [personId, internalUrl]);
      await client.query("COMMIT");

      stats.saved += 1;
      console.log(`[OK] ${displayName} (${personId}) -> ${downloaded.mimeType}, ${downloaded.buffer.length} B`);
    } catch (error) {
      stats.failed += 1;
      await client.query("ROLLBACK").catch(() => {});
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ERR] ${displayName} (${personId}) -> ${message}`);
    }
  }

  const summary = await client.query(`
    SELECT
      count(*) FILTER (WHERE p.photo ~ '^https?://') AS external_photo_urls,
      count(*) FILTER (WHERE p.photo LIKE '/api/media/person-photo/%') AS internal_photo_urls,
      count(pp.person_id) AS blobs_total,
      coalesce(sum(pp.size_bytes), 0) AS blobs_total_bytes
    FROM app_person p
    LEFT JOIN app_person_photo pp ON pp.person_id = p.id
  `);

  console.log(
    JSON.stringify(
      {
        ...stats,
        summary: summary.rows[0],
      },
      null,
      2
    )
  );

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
