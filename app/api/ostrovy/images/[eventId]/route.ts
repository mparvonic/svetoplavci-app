import { AppSchoolEventLifecycleStatus, Prisma } from "@prisma/client";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import {
  ostrovyUploadExists,
  ostrovyUploadUrlToPath,
  saveRemoteOstrovyImage,
} from "@/src/lib/ostrovy-images";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function serveUpload(url: string): Promise<NextResponse> {
  const filePath = ostrovyUploadUrlToPath(url);
  if (!filePath) return new NextResponse(null, { status: 404 });

  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(filePath);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  if (!fileStat.isFile()) return new NextResponse(null, { status: 404 });

  const ext = path.extname(filePath).toLowerCase();
  const stream = createReadStream(filePath);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(fileStat.size),
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const event = await prisma.appSchoolEvent.findFirst({
    where: {
      id: eventId,
      isActive: true,
      eventType: { code: "OSTROVY" },
      lifecycleStatus: {
        in: [
          AppSchoolEventLifecycleStatus.PUBLISHED,
          AppSchoolEventLifecycleStatus.REGISTRATION_CLOSED,
        ],
      },
    },
    select: {
      id: true,
      title: true,
      metadata: true,
    },
  });

  if (!event) {
    return new NextResponse(null, { status: 404 });
  }

  const metadata = objectValue(event.metadata);
  const ostrovy = objectValue(metadata.ostrovy);
  const thumbnailUrl = stringValue(ostrovy.thumbnailUrl);
  if (!thumbnailUrl) {
    return new NextResponse(null, { status: 404 });
  }

  if (await ostrovyUploadExists(thumbnailUrl)) {
    return serveUpload(thumbnailUrl);
  }

  const sourceImageUrl = stringValue(ostrovy.thumbnailSourceImageUrl);
  if (!sourceImageUrl) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const saved = await saveRemoteOstrovyImage(sourceImageUrl, event.title);
    const nextMetadata = {
      ...metadata,
      ostrovy: {
        ...ostrovy,
        thumbnailUrl: saved.url,
      },
    };

    if (saved.url !== thumbnailUrl) {
      await prisma.appSchoolEvent.update({
        where: { id: event.id },
        data: {
          metadata: jsonValue(nextMetadata),
        },
      });
    }

    return serveUpload(saved.url);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
