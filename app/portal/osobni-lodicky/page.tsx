import OsobniLodickyClient from "./osobni-lodicky-client";
import { auth } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OsobniLodickyPage() {
  const session = await auth();
  const userRoles = session?.user?.roles ?? [];
  const adminToolsEnabled = userRoles.includes("admin");
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
