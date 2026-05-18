"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { APP_ROLES, type AppRole } from "@/src/lib/user-directory";

const MANUAL_ROLE_SOURCE = "manual_admin";

function collectRoles(
  session: { user?: { role?: unknown; roles?: unknown } } | null,
): string[] {
  if (!session?.user) return [];
  if (Array.isArray(session.user.roles)) {
    return session.user.roles.map((value) => String(value));
  }
  if (typeof session.user.role === "string" && session.user.role) {
    return [session.user.role];
  }
  return [];
}

async function requireAdminEmail(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email || !collectRoles(session).includes("admin")) {
    throw new Error("Nemáte oprávnění upravovat role.");
  }
  return session.user.email;
}

function normalizeRole(value: FormDataEntryValue): AppRole | null {
  const role = String(value).trim();
  return (APP_ROLES as readonly string[]).includes(role)
    ? (role as AppRole)
    : null;
}

function redirectWithMessage(
  personId: string,
  key: string,
  message?: string,
  edit = false,
): never {
  const params = new URLSearchParams({ roleUpdate: key });
  if (edit) params.set("roleEdit", "1");
  if (message) params.set("message", message);
  redirect(`/admin/uzivatele/${personId}?${params.toString()}`);
}

export async function updateAdminUserRolesAction(formData: FormData) {
  const personId = String(formData.get("personId") ?? "").trim();
  if (!personId) redirect("/admin/uzivatele?roleUpdate=error");

  const selectedRoles = Array.from(
    new Set(formData.getAll("role").map(normalizeRole).filter(Boolean)),
  ) as AppRole[];
  const selectedRoleSet = new Set<string>(selectedRoles);

  try {
    await requireAdminEmail();
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const person = await tx.appPerson.findUnique({
        where: { id: personId },
        select: { id: true },
      });
      if (!person) throw new Error("Uživatel nebyl nalezen.");

      const existingRoles = await tx.appRoleAssignment.findMany({
        where: { personId },
        select: {
          id: true,
          role: true,
          source: true,
          isActive: true,
        },
      });
      const activeRoleSet = new Set(
        existingRoles
          .filter((role) => role.isActive)
          .map((role) => role.role),
      );

      if (activeRoleSet.has("admin") && !selectedRoleSet.has("admin")) {
        const otherAdmin = await tx.appRoleAssignment.findFirst({
          where: {
            role: "admin",
            isActive: true,
            personId: { not: personId },
          },
          select: { id: true },
        });
        if (!otherAdmin) {
          throw new Error("Nelze odebrat poslední aktivní roli admin.");
        }
      }

      for (const role of APP_ROLES) {
        const shouldBeActive = selectedRoleSet.has(role);
        const isActive = activeRoleSet.has(role);

        if (shouldBeActive && !isActive) {
          const manualRole = existingRoles.find(
            (item) => item.role === role && item.source === MANUAL_ROLE_SOURCE,
          );
          if (manualRole) {
            await tx.appRoleAssignment.update({
              where: { id: manualRole.id },
              data: {
                isActive: true,
                validFrom: now,
                validTo: null,
              },
            });
          } else {
            await tx.appRoleAssignment.create({
              data: {
                personId,
                role,
                source: MANUAL_ROLE_SOURCE,
                isActive: true,
                validFrom: now,
              },
            });
          }
          continue;
        }

        if (!shouldBeActive && isActive) {
          await tx.appRoleAssignment.updateMany({
            where: {
              personId,
              role,
              isActive: true,
            },
            data: {
              isActive: false,
              validTo: now,
            },
          });
        }
      }
    });

  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Role se nepodařilo uložit.";
    redirectWithMessage(personId, "error", message, true);
  }

  revalidatePath(`/admin/uzivatele/${personId}`);
  revalidatePath("/admin/uzivatele");
  redirectWithMessage(personId, "saved");
}
