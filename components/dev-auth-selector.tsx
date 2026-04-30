import { cookies } from "next/headers";

import {
  DEV_AUTH_COOKIE_NAME,
  getDevAuthRoleLabel,
  getSelectedDevAuthUser,
  getDevAuthUsers,
  isDevAuthBypassEnabled,
} from "@/src/lib/dev-auth";

export async function DevAuthSelector() {
  if (!isDevAuthBypassEnabled()) return null;

  const [cookieStore, users, selectedDevUser] = await Promise.all([
    cookies(),
    getDevAuthUsers(),
    getSelectedDevAuthUser(),
  ]);
  if (users.length === 0) return null;

  const selectedPersonId =
    selectedDevUser?.personId ??
    cookieStore.get(DEV_AUTH_COOKIE_NAME)?.value ??
    users.find((user) => user.roles.includes("admin"))?.personId ??
    users[0]?.personId;
  const selectedUser = users.find((user) => user.personId === selectedPersonId) ?? users[0];

  return (
    <div className="fixed bottom-3 right-3 z-50 max-w-[calc(100vw-1.5rem)] rounded-[20px] border border-[#D6DFF0] bg-white/95 p-2 text-xs text-[#0E2A5C] shadow-[var(--sv-shadow-lift)] backdrop-blur">
      <form action="/api/dev-auth/select" method="post" className="flex flex-wrap items-center gap-2">
        <span className="sv-eyebrow text-[#0E2A5C]">Dev uživatel</span>
        <select
          name="personId"
          defaultValue={selectedUser.personId}
          className="h-8 max-w-[72vw] rounded-full border border-[#D6DFF0] bg-white px-3 text-xs"
        >
          {users.map((user) => (
            <option key={user.personId} value={user.personId}>
              {user.displayName} | {getDevAuthRoleLabel(user.role)} | {user.email}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-8 rounded-full bg-[#0E2A5C] px-3 text-xs font-semibold text-white hover:bg-[#07173A]"
        >
          Použít
        </button>
      </form>
    </div>
  );
}
