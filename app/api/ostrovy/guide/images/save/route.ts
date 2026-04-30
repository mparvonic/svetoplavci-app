import { NextRequest, NextResponse } from "next/server";

import {
  getApiSessionContext,
  GUIDE_ROLE_CODES,
  hasAnySessionRole,
} from "@/src/lib/api/session";
import { saveRemoteOstrovyImage } from "@/src/lib/ostrovy-images";

export const runtime = "nodejs";
export const maxDuration = 60;

type SaveImagePayload = {
  imageUrl?: string;
  previewUrl?: string | null;
  title?: string;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  license?: string | null;
  author?: string | null;
  provider?: string | null;
  reason?: string | null;
};

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function trimOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export async function POST(req: NextRequest) {
  const context = await getApiSessionContext();
  if (!context) return unauthorized();
  if (!hasAnySessionRole(context.roles, GUIDE_ROLE_CODES)) return forbidden();

  let payload: SaveImagePayload;
  try {
    payload = (await req.json()) as SaveImagePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const imageUrl = trimOptional(payload.imageUrl);
  if (!imageUrl) {
    return NextResponse.json({ error: "Missing image URL." }, { status: 400 });
  }

  try {
    const saved = await saveRemoteOstrovyImage(
      imageUrl,
      trimOptional(payload.title) ?? trimOptional(payload.sourceTitle) ?? "ostrov",
      [trimOptional(payload.previewUrl)].filter((value): value is string => Boolean(value)),
    );
    return NextResponse.json({
      url: saved.url,
      fileName: saved.fileName,
      sourceImageUrl: imageUrl,
      sourceTitle: trimOptional(payload.sourceTitle),
      sourceUrl: trimOptional(payload.sourceUrl),
      license: trimOptional(payload.license),
      author: trimOptional(payload.author),
      provider: trimOptional(payload.provider),
      reason: trimOptional(payload.reason),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image could not be saved." },
      { status: 400 },
    );
  }
}
