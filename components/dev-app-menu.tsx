import Link from "next/link";
import type { ComponentType } from "react";
import type { Session } from "next-auth";
import { FileText, LogOut, Sailboat, Sparkles, UserRound } from "lucide-react";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/src/lib/auth";
import {
  clearDevAuthSelection,
  getDevAuthRoleLabel,
  getDevAuthUsers,
  getSelectedDevAuthUser,
  isDevAuthBypassEnabled,
} from "@/src/lib/dev-auth";

const CHILD_VIEW_ROLES = new Set(["admin", "tester", "rodic", "zak"]);
const REPORT_ROLES = new Set(["admin", "tester", "rodic"]);
const GUIDE_ROLES = new Set(["admin", "tester", "ucitel", "zamestnanec", "pruvodce", "garant"]);
const LODICKY_ROLES = new Set([...CHILD_VIEW_ROLES, ...GUIDE_ROLES]);
const ISLAND_ROLES = new Set([...CHILD_VIEW_ROLES, ...GUIDE_ROLES]);

type DevNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  roles: ReadonlySet<string>;
  kind?: "ostrovy";
};

const DEV_NAV_ITEMS: DevNavItem[] = [
  {
    href: "/portal/osobni-lodicky",
    label: "Lodičky",
    icon: Sailboat,
    roles: LODICKY_ROLES,
  },
  {
    href: "/vysvedceni",
    label: "Vysvědčení",
    icon: FileText,
    roles: REPORT_ROLES,
  },
  {
    href: "/ostrovy",
    label: "Ostrovy",
    icon: Sparkles,
    roles: ISLAND_ROLES,
    kind: "ostrovy",
  },
] satisfies DevNavItem[];

function hasAllowedRole(userRoles: string[], allowedRoles: ReadonlySet<string>): boolean {
  return userRoles.some((role) => allowedRoles.has(role.toLowerCase()));
}

function collectSessionRoles(session: Session | null): string[] {
  const roles = new Set<string>();
  if (!session?.user) return [];
  if (Array.isArray(session.user.roles)) {
    for (const role of session.user.roles) roles.add(String(role).toLowerCase());
  }
  if (session.user.role) roles.add(String(session.user.role).toLowerCase());
  return [...roles];
}

function resolveNavHref(item: DevNavItem, userRoles: string[]): string {
  if (item.kind === "ostrovy" && hasAllowedRole(userRoles, GUIDE_ROLES)) {
    return "/ostrovy/sprava";
  }
  return item.href;
}

function formatHeaderName(rawName: string, email: string): string {
  const fallback = email.trim();
  if (!rawName.trim()) return fallback;

  const compact = rawName.trim().replace(/\s+/g, " ");
  const descriptorPattern = /\bRodič s žákem v evidenci\b.*$/i;
  const hadDirectoryDescriptor = descriptorPattern.test(rawName) || /\s{2,}/.test(rawName);
  const withoutDescriptor = rawName
    .split(/\s{2,}/)[0]
    .replace(descriptorPattern, "")
    .trim()
    .replace(/\s+/g, " ");
  const name = withoutDescriptor || compact;
  const parts = name.split(" ").filter(Boolean);

  if (hadDirectoryDescriptor && parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }

  return name;
}

async function menuSignOutAction() {
  "use server";

  if (isDevAuthBypassEnabled()) {
    await clearDevAuthSelection();
    redirect("/");
  }

  await signOut({ redirectTo: "/auth/signin" });
}

export async function DevAppMenu() {
  const isDevMenu = isDevAuthBypassEnabled();
  const [selectedUser, devUsers] = isDevMenu
    ? await Promise.all([getSelectedDevAuthUser(), getDevAuthUsers()])
    : [null, []];
  const session = selectedUser ? null : await auth();
  const userRoles = selectedUser?.roles ?? collectSessionRoles(session);
  const visibleItems = DEV_NAV_ITEMS
    .filter((item) => hasAllowedRole(userRoles, item.roles))
    .map((item) => ({ ...item, href: resolveNavHref(item, userRoles) }));
  const rawUserName =
    selectedUser?.displayName ??
    session?.user?.jmeno?.trim() ??
    session?.user?.name?.trim() ??
    session?.user?.email ??
    "";
  const userEmail = selectedUser?.email ?? session?.user?.email ?? "";
  const userName = formatHeaderName(rawUserName, userEmail);
  const homeHref = visibleItems[0]?.href ?? "/";

  if (visibleItems.length === 0 && !userName && !isDevMenu) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-[#D6DFF0] bg-white/95 shadow-[var(--sv-shadow-paper)] backdrop-blur">
      <div className="app-page-container py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
            <Link href={homeHref} className="group flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[20px] border border-[#D6DFF0] bg-white text-[1.4rem] font-semibold leading-none text-[#C8372D] shadow-[var(--sv-shadow-paper)] transition group-hover:-translate-y-px">
                S
              </span>
              <span className="min-w-0">
                <span className="sv-eyebrow block text-[#4A5A7C]">{isDevMenu ? "Testovací přístup" : "Školní aplikace"}</span>
                <span className="sv-display block truncate text-2xl leading-none text-[#0E2A5C]">Světoplavci</span>
              </span>
            </Link>

            {visibleItems.length > 0 && (
              <nav aria-label="Hlavní navigace" className="flex flex-wrap items-center gap-1.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-transparent px-3.5 text-sm font-semibold text-[#0E2A5C] transition duration-200 ease-[var(--sv-ease)] hover:border-[#D6DFF0] hover:bg-[#EEF2F7]"
                    >
                      <Icon className="size-4" aria-hidden={true} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
            {isDevMenu && devUsers.length > 0 && (
              <form
                action="/api/dev-auth/select"
                method="post"
                className="flex min-w-0 flex-wrap items-center gap-2 rounded-full border border-[#D6DFF0] bg-[#EEF2F7] p-1.5"
              >
                <label className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[#0E2A5C]">
                    <UserRound className="size-4" aria-hidden={true} />
                  </span>
                  <span className="sr-only">Dočasný uživatel</span>
                  <select
                    name="personId"
                    defaultValue={selectedUser?.personId ?? devUsers[0]?.personId}
                    className="h-8 max-w-[calc(100vw-7rem)] rounded-full border border-[#D6DFF0] bg-white px-3 text-xs font-medium text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20 sm:max-w-[20rem]"
                  >
                    {devUsers.map((user) => (
                      <option key={user.personId} value={user.personId}>
                        {user.displayName} | {getDevAuthRoleLabel(user.role)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="h-8 rounded-full border-[1.5px] border-[#0E2A5C] bg-[#0E2A5C] px-3 text-xs font-semibold text-white transition duration-200 ease-[var(--sv-ease)] hover:-translate-y-px hover:bg-[#07173A]"
                >
                  Přepnout
                </button>
              </form>
            )}

            {userName && (
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-[#D6DFF0] bg-white px-3 py-2 text-xs text-[#4A5A7C]">
                <UserRound className="size-4 shrink-0 text-[#C8372D]" aria-hidden={true} />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#0E2A5C]">{userName}</div>
                  {userEmail && <div className="truncate">{userEmail}</div>}
                </div>
              </div>
            )}

            <form action={menuSignOutAction}>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border-[1.5px] border-[#C8372D] bg-white px-4 text-sm font-semibold text-[#C8372D] transition duration-200 ease-[var(--sv-ease)] hover:-translate-y-px hover:bg-[#FAEAE9]"
              >
                <LogOut className="size-4" aria-hidden={true} />
                <span>Odhlásit</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
