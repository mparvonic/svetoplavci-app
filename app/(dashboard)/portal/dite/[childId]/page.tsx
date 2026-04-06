import { redirect } from "next/navigation";
import { getPostLoginDefaultPath, isCustomPostLoginPath } from "@/src/lib/post-login-path";

export default function PortalDitePage() {
  const target = getPostLoginDefaultPath();
  if (isCustomPostLoginPath()) {
    redirect(target);
  }
  redirect("/");
}
