import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ personId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { personId } = await params;
  if (!personId) {
    return new Response("Missing personId", { status: 400 });
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
