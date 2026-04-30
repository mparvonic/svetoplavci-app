import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { HomePageClient } from "../home-page-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VysvedceniPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/vysvedceni");
  }

  return <HomePageClient />;
}
