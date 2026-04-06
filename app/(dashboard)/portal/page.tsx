import { redirect } from "next/navigation";
import { getPostLoginDefaultPath, isCustomPostLoginPath } from "@/src/lib/post-login-path";

export default function PortalPage() {
  const target = getPostLoginDefaultPath();
  if (isCustomPostLoginPath() && target !== "/portal") {
    redirect(target);
  }
  redirect("/");
}
