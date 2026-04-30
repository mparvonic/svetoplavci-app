import Link from "next/link";
import type { ComponentType } from "react";
import type { Session } from "next-auth";
import { CalendarDays, Sailboat, Shield, Sparkles } from "lucide-react";

import { auth } from "@/src/lib/auth";
import { getSelectedDevAuthUser, isDevAuthBypassEnabled } from "@/src/lib/dev-auth";

const CHILD_VIEW_ROLES = new Set(["admin", "tester", "rodic", "zak"]);
const GUIDE_ROLES = new Set(["admin", "tester", "ucitel", "zamestnanec", "pruvodce", "garant"]);
const LODICKY_ROLES = new Set([...CHILD_VIEW_ROLES, ...GUIDE_ROLES]);
const ADMIN_ROLES = new Set(["admin", "tester"]);

type DevNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  roles: ReadonlySet<string>;
};

const DEV_NAV_ITEMS: DevNavItem[] = [
  {
    href: "/portal/osobni-lodicky",
    label: "Lodičky",
    icon: Sailboat,
    roles: LODICKY_ROLES,
  },
  {
    href: "/ostrovy",
    label: "Ostrovy",
    icon: Sparkles,
    roles: CHILD_VIEW_ROLES,
  },
  {
    href: "/ostrovy/sprava",
    label: "Správa ostrovů",
    icon: CalendarDays,
    roles: GUIDE_ROLES,
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    roles: ADMIN_ROLES,
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

export async function DevAppMenu() {
  const isDevMenu = isDevAuthBypassEnabled();
  const selectedUser = isDevMenu ? await getSelectedDevAuthUser() : null;
  const session = selectedUser ? null : await auth();
  const userRoles = selectedUser?.roles ?? collectSessionRoles(session);
  const visibleItems = DEV_NAV_ITEMS.filter((item) => hasAllowedRole(userRoles, item.roles));

  if (visibleItems.length === 0) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-[#D6DFF0] bg-white/95 shadow-[var(--sv-shadow-paper)] backdrop-blur">
      <div className="app-page-container flex flex-wrap items-center gap-3 py-2">
        <div className="sv-eyebrow mr-1">
          {isDevMenu ? "Dev menu" : "Menu"}
        </div>
        <nav aria-label="Dev navigace" className="flex flex-wrap items-center gap-1.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[#0E2A5C] transition hover:bg-[#EEF2F7]"
              >
                <Icon className="size-4" aria-hidden={true} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
