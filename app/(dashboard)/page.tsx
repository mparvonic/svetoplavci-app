import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { HomePageClient } from "./home-page-client";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/");
  }

  return <HomePageClient />;
}
