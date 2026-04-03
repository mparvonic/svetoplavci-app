ALTER TABLE "app_person"
ADD COLUMN "nickname" TEXT;

CREATE UNIQUE INDEX "app_person_nickname_key" ON "app_person"("nickname");
