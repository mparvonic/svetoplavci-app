import { NextResponse } from "next/server";

import {
  canViewLodickyManagement,
  getLodickyManagementRows,
  parseLodickyManagementFilters,
} from "@/app/(dashboard)/portal/lodicky/sprava/data";
import { getApiSessionContext, isLocalDevAuthBypass } from "@/src/lib/api/session";
import { DEV_AUTH_COOKIE_NAME, getSelectedDevAuthUser } from "@/src/lib/dev-auth";

function searchParamsToRecord(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export async function GET(req: Request) {
  const context = await getApiSessionContext(req);
  if (!context) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  try {
    const hasDevSelectionCookie = req.headers.get("cookie")?.includes(`${DEV_AUTH_COOKIE_NAME}=`) ?? false;
    const selectedDevUser = isLocalDevAuthBypass() && hasDevSelectionCookie ? await getSelectedDevAuthUser() : null;
    const roles = selectedDevUser?.roles ?? context.roles;
    const personIds =
      selectedDevUser?.personId && !selectedDevUser.personId.startsWith("local-dev-")
        ? [selectedDevUser.personId]
        : context.personIds;

    if (!canViewLodickyManagement(roles)) {
      return NextResponse.json({ error: "Přístup zamítnut." }, { status: 403 });
    }

    const url = new URL(req.url);
    const filters = parseLodickyManagementFilters(searchParamsToRecord(url.searchParams));
    const data = await getLodickyManagementRows({
      filters,
      access: {
        roles,
        personIds,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/m01/lodicky/sprava]", error);
    return NextResponse.json({ error: "Nepodařilo se načíst správu lodiček." }, { status: 500 });
  }
}
