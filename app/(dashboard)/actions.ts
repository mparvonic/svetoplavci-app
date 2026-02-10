"use server";

import { signOut } from "@/src/lib/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
