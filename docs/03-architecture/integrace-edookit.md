# Integrace Edookit

## Účel

Přenos dat o uživatelích, rozvrhu a hodinách do aplikace Světoplavci.

## Směr integrace

- Primárně import do interního datového modelu.
- Externí identifikátory se mapují na interní identity.

## Implementované API zdroje (uživatelé)

- `GET /api/student-data/v1/list/{date}?include-inactive-since={date}`
- `GET /api/employee-data/v1/list/{date}?include-inactive-since={date}`
- Base URL: `https://svetoplavci.edookit.net`
- Auth: HTTP Basic přes HTTPS.

## Synchronizační pravidla v aplikaci

- Prvotní sync:
  - `date=2021-09-01`,
  - `include-inactive-since=2021-09-01`.
- Běžný denní sync:
  - `date=today`,
  - `include-inactive-since=2021-09-01`.
- Děti z API dostávají automaticky roli `zak`.
- Zaměstnanci z API dostávají automaticky roli `zamestnanec`.
- Rodiče se importují z CSV (mapování hlaviček je tolerantní, klíčové sloupce jsou povinné).

## API zdroje pro rozvrh a kalendáře (M11)

- Rozvrh (v2):
  - `GET /api/lesson/v2/version`
  - `GET /api/lesson/v2/list-lessons`
  - `GET /api/lesson/v2/lists/rooms`
  - `GET /api/lesson/v2/lists/types/course`
  - `GET /api/lesson/v2/lists/types/work`
- Změnový rozvrh (legacy):
  - host: `https://<skola>-login.edookit.net`
  - `GET /api/scheduler/v1/change?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Kurzy:
  - `GET /api/course-data/v1/version`
  - `GET /api/course-data/v1/courses?person_id=&evalterm_id=`

## Provozní pravidla pro rozvrh sync

- `lesson/v2/list-lessons` je finální source-of-truth pro payload událostí.
- `scheduler/v1/change` se používá jako delta trigger, nikoliv jako finální payload.
- Při detekci změny se vždy dělá cílený refresh přes `list-lessons`.
- `course-data/v1/courses` se používá pro mapování student↔kurz a enrichment.
- Kontrola změn běží 3x denně (ne každých 10-15 minut).

## Poznámka k filtrům API

- `list-lessons` podporuje filtry (`student_person_id`, `teacher_person_id`, `course_id`, `course_type_id`, `room_id`).
- `scheduler/v1/change` je prakticky globální feed změn (neznámé filtry jsou ignorovány), proto je nutné filtrovat na aplikační vrstvě.

## Konflikty identity (shared email)

- Strategie: varianta C (manuální schválení).
- Pokud je k jednomu emailu více osob a existují pending linky, vzniká konflikt `MULTI_PERSON_IDENTITY`.
- Konflikt řeší admin přes API:
  - `GET /api/admin/users/conflicts`
  - `POST /api/admin/users/conflicts` s `identityId` + `approvedPersonIds[]`.
- Pokud má identity jen jeden link, systém ho automaticky schválí (auto-single-link).

## Konfigurace prostředí

- `EDOOKIT_BASE_URL`
- `EDOOKIT_API_USERNAME`
- `EDOOKIT_API_PASSWORD`
- `USER_SYNC_SECRET` (autorizace pro `POST /api/sync/users`)
