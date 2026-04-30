import { redirect } from "next/navigation";
import { getPostLoginDefaultPath } from "@/src/lib/post-login-path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PortalPage() {
  redirect(getPostLoginDefaultPath());
}
