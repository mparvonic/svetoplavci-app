"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

type SignOutButtonProps = {
  isDevMenu: boolean;
};

const buttonClassName =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border-[1.5px] border-[#C8372D] bg-white px-4 text-sm font-semibold text-[#C8372D] transition duration-200 ease-[var(--sv-ease)] hover:-translate-y-px hover:bg-[#FAEAE9] disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0";

function notifySignOutStart() {
  window.dispatchEvent(new Event("sv:signout-start"));
}

export function SignOutButton({ isDevMenu }: SignOutButtonProps) {
  const [pending, setPending] = useState(false);

  if (isDevMenu) {
    return (
      <form
        action="/api/dev-auth/select"
        method="post"
        onSubmit={() => {
          notifySignOutStart();
          setPending(true);
        }}
      >
        <button type="submit" disabled={pending} className={buttonClassName}>
          <LogOut className="size-4" aria-hidden={true} />
          <span>{pending ? "Odhlašuji..." : "Odhlásit"}</span>
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClassName}
      onClick={() => {
        notifySignOutStart();
        setPending(true);
        void signOut({ redirectTo: "/auth/signin" });
      }}
    >
      <LogOut className="size-4" aria-hidden={true} />
      <span>{pending ? "Odhlašuji..." : "Odhlásit"}</span>
    </button>
  );
}
