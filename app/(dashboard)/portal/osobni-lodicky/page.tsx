import OsobniLodickyClient from "./osobni-lodicky-client";
import { getPostLoginDefaultPath } from "@/src/lib/post-login-path";

const TEST_ENTRY_PATH = "/portal/osobni-lodicky";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isDebugEnabledForPortal(): boolean {
  if (process.env.PORTAL_DEBUG_PANEL === "1") return true;
  return getPostLoginDefaultPath() === TEST_ENTRY_PATH;
}

export default function OsobniLodickyPage() {
  return <OsobniLodickyClient debugEnabled={isDebugEnabledForPortal()} />;
}
