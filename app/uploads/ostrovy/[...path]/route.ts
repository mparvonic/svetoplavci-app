import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPLOAD_BASE = path.join(process.cwd(), "public", "uploads", "ostrovy");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;
  const joined = segments.join("/");

  // Prevent path traversal
  const fullPath = path.resolve(UPLOAD_BASE, joined);
  if (!fullPath.startsWith(UPLOAD_BASE + path.sep) && fullPath !== UPLOAD_BASE) {
    return new NextResponse(null, { status: 403 });
  }

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(fullPath);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  if (!stat.isFile()) return new NextResponse(null, { status: 404 });

  const ext = path.extname(joined).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";
  const stream = createReadStream(fullPath);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
