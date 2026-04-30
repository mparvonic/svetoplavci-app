import { redirect } from "next/navigation";

import { auth } from "@/src/lib/auth";
import {
  CHILD_VIEW_ROLE_CODES,
  LOCAL_DEV_ROLES,
  collectSessionRoles,
  hasAnySessionRole,
  isLocalDevAuthBypass,
} from "@/src/lib/api/session";

import OstrovyClient from "./ostrovy-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OstrovyPage() {
  const session = await auth();
  if (!session?.user?.email) {
    if (isLocalDevAuthBypass()) {
      return <OstrovyClient />;
    }
    redirect("/auth/signin?callbackUrl=/ostrovy");
  }

  const roles = session ? collectSessionRoles(session) : LOCAL_DEV_ROLES;
  if (!hasAnySessionRole(roles, CHILD_VIEW_ROLE_CODES)) {
    redirect("/");
  }

  return <OstrovyClient />;
}
