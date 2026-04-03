CREATE TABLE IF NOT EXISTS "app_person_photo" (
  "person_id" TEXT PRIMARY KEY,
  "mime_type" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "source_url" TEXT,
  "source_hash" TEXT,
  "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_person_photo_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "app_person"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "app_person_photo_source_hash_idx"
  ON "app_person_photo"("source_hash");
