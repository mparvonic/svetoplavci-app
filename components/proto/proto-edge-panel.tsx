"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Compass, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProtoActor, ProtoRoleOption } from "@/src/lib/mock/proto-lodicky-playground";

export type ProtoQuickNavItem = {
  id: string;
  label: string;
  href: string;
};

export function ProtoEdgePanel({
  roleOptions,
  activeRole,
  activeUserId,
  usersForRole,
  onRoleChange,
  onUserChange,
  navItems,
  query,
}: {
  roleOptions: ProtoRoleOption[];
  activeRole: string;
  activeUserId: string;
  usersForRole: ProtoActor[];
  onRoleChange: (value: string) => void;
  onUserChange: (value: string) => void;
  navItems: readonly ProtoQuickNavItem[];
  query: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  const navWithQuery = useMemo(
    () =>
      navItems.map((item) => {
        const params = new URLSearchParams(query);
        const serialized = params.toString();
        return {
          ...item,
          href: serialized ? `${item.href}?${serialized}` : item.href,
        };
      }),
    [navItems, query],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed left-0 top-36 z-50 inline-flex items-center gap-2 rounded-r-xl border border-l-0 border-[#BFD2EA] bg-white px-3 py-2 text-xs font-semibold text-[#0A4DA6] shadow-md"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
        Nástroje
      </button>

      {open && (
        <aside className="fixed left-0 top-24 z-40 w-80 max-w-[92vw] rounded-r-2xl border border-l-0 border-[#C7D8EE] bg-white p-4 shadow-2xl">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A4DA6]">Přepínače</p>
              <div className="mt-2 space-y-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Role
                  </span>
                  <select
                    value={activeRole}
                    onChange={(e) => onRoleChange(e.target.value)}
                    className="w-full rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700"
                  >
                    {roleOptions.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Uživatel
                  </span>
                  <select
                    value={activeUserId}
                    onChange={(e) => onUserChange(e.target.value)}
                    className="w-full rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700"
                  >
                    {usersForRole.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.jmeno}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A4DA6]">
                Pomocná navigace
              </p>
              <div className="mt-2 space-y-2">
                {navWithQuery.map((item) => (
                  <Button
                    key={item.id}
                    asChild
                    variant="outline"
                    className="w-full justify-start border-[#D9E4F2] bg-white text-[#05204A]"
                  >
                    <Link href={item.href}>
                      <Compass className="size-4 text-[#0A4DA6]" />
                      {item.label}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
