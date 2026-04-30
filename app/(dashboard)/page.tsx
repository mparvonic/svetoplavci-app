import { auth } from "@/src/lib/auth";
import { getPostLoginDefaultPath } from "@/src/lib/post-login-path";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/");
  }

  redirect(getPostLoginDefaultPath());
}
