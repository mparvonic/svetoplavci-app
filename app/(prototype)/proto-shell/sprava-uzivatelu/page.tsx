import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
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
  return (
    <UserManagementProtoClient
      sessionName={session.user.jmeno ?? session.user.email ?? "Uživatel"}
      sessionEmail={session.user.email ?? ""}
      sessionRoles={roles}
    />
  );
}
