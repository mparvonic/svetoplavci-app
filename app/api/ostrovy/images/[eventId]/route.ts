import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  ostrovyUploadExists,
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

function redirectToUpload(req: NextRequest, url: string): NextResponse {
  return NextResponse.redirect(new URL(url, req.url), {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const event = await prisma.appSchoolEvent.findUnique({
    where: { id: eventId },
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
    return redirectToUpload(req, thumbnailUrl);
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

    return redirectToUpload(req, saved.url);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
