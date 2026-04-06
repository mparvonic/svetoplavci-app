import { auth } from "@/src/lib/auth";
import { getPostLoginDefaultPath, isCustomPostLoginPath } from "@/src/lib/post-login-path";
import { redirect } from "next/navigation";
import { HomePageClient } from "./home-page-client";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/");
  }

  if (isCustomPostLoginPath()) {
    redirect(getPostLoginDefaultPath());
  }

  return <HomePageClient />;
}
