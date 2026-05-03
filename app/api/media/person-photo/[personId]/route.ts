import {
  GUIDE_ROLE_CODES,
  getApiSessionContext,
  hasAnySessionRole,
} from "@/src/lib/api/session";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ personId: string }> }
) {
  const context = await getApiSessionContext(req);
  if (!context) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { personId } = await params;
  if (!personId) {
    return new Response("Missing personId", { status: 400 });
  }

  if (!(await canAccessPersonPhoto(context.personIds, context.roles, personId))) {
    return new Response("Forbidden", { status: 403 });
  }

  const photo = await prisma.appPersonPhoto.findUnique({
    where: { personId },
    select: {
      content: true,
      mimeType: true,
      sizeBytes: true,
      updatedAt: true,
    },
  });

  if (!photo) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(Buffer.from(photo.content), {
    status: 200,
    headers: {
      "Content-Type": photo.mimeType || "application/octet-stream",
      "Content-Length": String(photo.sizeBytes),
      "Cache-Control": "private, max-age=300",
      ETag: `\"${photo.updatedAt.getTime()}-${photo.sizeBytes}\"`,
    },
  });
}

async function canAccessPersonPhoto(personIds: string[], roles: string[], personId: string): Promise<boolean> {
  const normalizedRoles = roles.map((role) => role.toLowerCase());
  if (normalizedRoles.includes("admin") || normalizedRoles.includes("tester")) return true;
  if (hasAnySessionRole(normalizedRoles, GUIDE_ROLE_CODES)) return true;
  if (personIds.includes(personId)) return true;

  if (!normalizedRoles.includes("rodic") || personIds.length === 0) return false;
  const relation = await prisma.appPersonRelation.findFirst({
    where: {
      parentPersonId: { in: personIds },
      childPersonId: personId,
      relationType: "parent_of",
      isActive: true,
      childPerson: {
        is: {
          isActive: true,
          roles: { some: { role: "zak", isActive: true } },
        },
      },
    },
    select: { id: true },
  });
  return relation != null;
}
