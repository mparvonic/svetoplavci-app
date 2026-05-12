import { AppSchoolEventRegistrationStatus, Prisma, type PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const DAILY_STUDY_MODE_CODE = "11";
export const DAILY_STUDY_MODE_KEY = "denni";

export interface ActiveDailyStudentInfo {
  personId: string;
  currentGradeNum: number | null;
}

export function isActiveSchoolEventRegistrationStatus(status: AppSchoolEventRegistrationStatus | string): boolean {
  return (
    status === AppSchoolEventRegistrationStatus.REGISTERED ||
    status === AppSchoolEventRegistrationStatus.WAITLIST
  );
}

export async function getActiveDailyStudentInfoByIds(
  client: DbClient,
  personIds: string[],
  at: Date = new Date(),
): Promise<Map<string, ActiveDailyStudentInfo>> {
  const uniquePersonIds = [...new Set(personIds.map((id) => id.trim()).filter(Boolean))];
  if (uniquePersonIds.length === 0) return new Map();

  const rows = await client.$queryRaw<Array<{ personId: string; currentGradeNum: number | null }>>(Prisma.sql`
    WITH target_person(person_id) AS (
      VALUES ${Prisma.join(uniquePersonIds.map((personId) => Prisma.sql`(${personId})`))}
    )
    SELECT
      p.id AS "personId",
      ss.current_grade_num AS "currentGradeNum"
    FROM target_person target
    JOIN app_person p
      ON p.id = target.person_id
      AND p.is_active = TRUE
    JOIN app_role_assignment ra
      ON ra.person_id = p.id
      AND lower(ra.role) = 'zak'
      AND ra.is_active = TRUE
    JOIN LATERAL (
      SELECT
        s.current_grade_num,
        s.study_mode_code,
        s.study_mode_key
      FROM app_student_state s
      WHERE s.person_id = p.id
        AND (s.effective_to IS NULL OR s.effective_to::date >= (${at})::date)
      ORDER BY s.effective_from DESC, s.created_at DESC
      LIMIT 1
    ) ss ON TRUE
    WHERE (
      ss.study_mode_code = ${DAILY_STUDY_MODE_CODE}
      OR lower(ss.study_mode_key::text) = ${DAILY_STUDY_MODE_KEY}
    )
  `);

  return new Map(rows.map((row) => [row.personId, row]));
}

export async function getActiveDailyStudentInfo(
  client: DbClient,
  personId: string,
  at: Date = new Date(),
): Promise<ActiveDailyStudentInfo | null> {
  return (await getActiveDailyStudentInfoByIds(client, [personId], at)).get(personId) ?? null;
}

export async function assertActiveDailyStudent(
  client: DbClient,
  personId: string,
  at: Date = new Date(),
): Promise<ActiveDailyStudentInfo> {
  const info = await getActiveDailyStudentInfo(client, personId, at);
  if (!info) {
    throw new Error("Vybraná osoba není aktivní žák v denním studiu.");
  }
  return info;
}

export async function filterActiveDailyStudentRegistrations<
  T extends { personId: string; status: AppSchoolEventRegistrationStatus | string },
>(
  client: DbClient,
  registrations: T[],
  at: Date = new Date(),
): Promise<T[]> {
  const activePersonIds = registrations
    .filter((registration) => isActiveSchoolEventRegistrationStatus(registration.status))
    .map((registration) => registration.personId);
  const dailyStudents = await getActiveDailyStudentInfoByIds(client, activePersonIds, at);

  return registrations.filter((registration) => {
    if (!isActiveSchoolEventRegistrationStatus(registration.status)) return true;
    return dailyStudents.has(registration.personId);
  });
}
