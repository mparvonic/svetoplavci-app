import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/src/lib/auth";
import { UI_CLASSES } from "@/src/lib/design-pack/ui";
import UserManagementProtoClient from "./user-management-proto-client";

type SessionLike = {
  user?: {
    role?: unknown;
    roles?: unknown;
    jmeno?: string | null;
    email?: string | null;
  };
} | null;

function collectRoles(session: SessionLike): string[] {
  if (!session?.user) return [];
  if (Array.isArray(session.user.roles) && session.user.roles.length > 0) {
    return session.user.roles.map((value) => String(value));
  }
  if (typeof session.user.role === "string" && session.user.role) {
    return [session.user.role];
  }
  return [];
}

export default async function ProtoUserManagementPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/signin?callbackUrl=/proto-shell/sprava-uzivatelu");
  }

  const roles = collectRoles(session);
  const isAdmin = roles.map((role) => role.toLowerCase()).includes("admin");

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 py-8">
        <section className={`${UI_CLASSES.pageContainer} space-y-6`}>
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">
              Proto shell
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#05204A]">
              Správa uživatelů
            </h1>
          </header>

          <Card className="border-[#F2CACA] bg-[#FFF7F7]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#8A1C1B]">
                <ShieldAlert className="size-5" />
                Přístup jen pro roli admin
              </CardTitle>
              <CardDescription className="text-[#8A1C1B]">
                V prototypu je správce uživatelů vždy uživatel s rolí <strong>admin</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-[#7A2A2A]">
                Aktuální role: {roles.length > 0 ? roles.join(", ") : "bez role"}
              </p>
              <Button asChild className={UI_CLASSES.primaryButton}>
                <Link href="/proto-shell">Zpět na proto shell</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <UserManagementProtoClient
      adminName={session.user.jmeno ?? session.user.email ?? "Admin"}
    />
  );
}
