import OsobniLodickyClient from "./osobni-lodicky-client";
import { auth } from "@/src/lib/auth";
import { isProductionApplicationUrl } from "@/src/lib/dev-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OsobniLodickyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const userRoles = session?.user?.roles ?? [];
  const adminToolsEnabled = userRoles.includes("admin") && !isProductionApplicationUrl();
  const normalizedRoles = new Set([...(session?.user?.roles ?? []), session?.user?.role ?? ""].map((role) =>
    String(role).toLowerCase().trim(),
  ));

  const rawSearchParams = await searchParams;
  const currentParams = new URLSearchParams();
  Object.entries(rawSearchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "string") currentParams.append(key, item);
      });
      return;
    }
    if (typeof value === "string") currentParams.set(key, value);
  });

  if (!adminToolsEnabled) {
    const nextParams = new URLSearchParams(currentParams);
    nextParams.delete("user");

    const hasParentView = normalizedRoles.has("rodic");
    const hasWorkView = normalizedRoles.has("garant") || normalizedRoles.has("pruvodce");
    const canToggleContext = hasParentView && hasWorkView;
    const requestedRole = nextParams.get("role");

    if (!canToggleContext) {
      nextParams.delete("role");
    } else if (requestedRole !== "rodic" && requestedRole !== "garant") {
      nextParams.set("role", hasWorkView ? "garant" : "rodic");
    }

    const currentQuery = currentParams.toString();
    const nextQuery = nextParams.toString();
    if (nextQuery !== currentQuery) {
      redirect(nextQuery ? `/portal/lodicky?${nextQuery}` : "/portal/lodicky");
    }
  }

  const userDisplayName =
    session?.user?.jmeno?.trim() || session?.user?.name?.trim() || session?.user?.email || "Neznámý uživatel";
  const userEmail = session?.user?.email ?? "";

  return (
    <OsobniLodickyClient
      adminToolsEnabled={adminToolsEnabled}
      sessionUser={{
        displayName: userDisplayName,
        email: userEmail,
        role: session?.user?.role ?? "rodic",
        roles: userRoles,
      }}
    />
  );
}
