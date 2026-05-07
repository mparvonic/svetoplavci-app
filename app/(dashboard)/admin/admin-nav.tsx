"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { adminSections } from "./admin-sections";

const navItems = [
  { href: "/admin", label: "Přehled" },
  ...adminSections.map((section) => ({
    href: section.href,
    label: section.shortLabel,
  })),
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigace" className="overflow-x-auto">
      <div className="flex min-w-max items-center gap-2 border-b border-[#D6DFF0] pb-3">
        {navItems.map((item) => {
          const isActive = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold transition duration-200 ease-[var(--sv-ease)]",
                isActive
                  ? "border-[#0E2A5C] bg-[#0E2A5C] text-white"
                  : "border-[#D6DFF0] bg-white text-[#0E2A5C] hover:border-[#0E2A5C] hover:bg-[#EEF2F7]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
