import OsobniLodickyClient from "./osobni-lodicky-client";
import { auth } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OsobniLodickyPage() {
  const session = await auth();
  const userRoles = session?.user?.roles ?? [];
  const adminToolsEnabled = userRoles.includes("admin");

  return <OsobniLodickyClient adminToolsEnabled={adminToolsEnabled} />;
}
