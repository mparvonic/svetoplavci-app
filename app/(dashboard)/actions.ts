"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/src/lib/auth";
import { clearDevAuthSelection, isDevAuthBypassEnabled } from "@/src/lib/dev-auth";

export async function signOutAction() {
  if (isDevAuthBypassEnabled()) {
    await clearDevAuthSelection();
    redirect("/");
  }

  await signOut({ redirectTo: "/" });
}
