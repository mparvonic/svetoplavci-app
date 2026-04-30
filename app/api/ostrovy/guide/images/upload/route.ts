import { NextRequest, NextResponse } from "next/server";

import {
  getApiSessionContext,
  GUIDE_ROLE_CODES,
  hasAnySessionRole,
} from "@/src/lib/api/session";
import { normalizeImageMime, saveOstrovyImageBuffer } from "@/src/lib/ostrovy-images";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const context = await getApiSessionContext();
  if (!context) return unauthorized();
  if (!hasAnySessionRole(context.roles, GUIDE_ROLE_CODES)) return forbidden();

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing image file." }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: "Image file is empty or too large." }, { status: 400 });
  }

  const mime = normalizeImageMime(file.type);
  if (!mime) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  }

  const title = String(formData.get("title") ?? file.name ?? "ostrov");
  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = await saveOstrovyImageBuffer(buffer, mime, title);

  return NextResponse.json({
    url: saved.url,
    fileName: saved.fileName,
  });
}
