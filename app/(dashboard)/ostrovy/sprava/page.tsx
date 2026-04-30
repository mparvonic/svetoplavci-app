import { redirect } from "next/navigation";

import { auth } from "@/src/lib/auth";
import {
  GUIDE_ROLE_CODES,
  LOCAL_DEV_ROLES,
  collectSessionRoles,
  hasAnySessionRole,
  isLocalDevAuthBypass,
} from "@/src/lib/api/session";

import OstrovyGuideClient from "./ostrovy-guide-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OstrovySpravaPage() {
  const session = await auth();
  if (!session?.user?.email) {
    if (isLocalDevAuthBypass()) {
      return <OstrovyGuideClient />;
    }
    redirect("/auth/signin?callbackUrl=/ostrovy/sprava");
  }

  const roles = session ? collectSessionRoles(session) : LOCAL_DEV_ROLES;
  if (!hasAnySessionRole(roles, GUIDE_ROLE_CODES)) {
    redirect("/ostrovy");
  }

  return <OstrovyGuideClient />;
}
