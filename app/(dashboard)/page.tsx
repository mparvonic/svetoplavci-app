import { auth } from "@/src/lib/auth";
import { findParentByEmail, getChildrenOfParent } from "@/src/lib/coda";
import { redirect } from "next/navigation";
import { HomeContent } from "./home-content";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/");
  }

  let parentName = "";
  let children: { rowId: string; name: string; nickname: string; rocnik: string; currentYear: string; group: string }[] = [];
  let error: string | null = null;

  try {
    const parent = await findParentByEmail(session.user.email);
    if (!parent) {
      error = "Přístup zamítnut. Váš email nebyl nalezen v systému.";
    } else {
      parentName = parent.name;
      children = await getChildrenOfParent(parent.rowId);
    }
  } catch (e) {
    console.error("[home]", e);
    error = "Nepodařilo se načíst data. Zkuste to později.";
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return <HomeContent parentName={parentName} children={children} />;
}
