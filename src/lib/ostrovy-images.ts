import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { access, mkdir, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";

const OSTROVY_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "ostrovy");
const MAX_DOWNLOADED_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const IMAGE_DOWNLOAD_TIMEOUT_MS = Number(process.env.OSTROVY_IMAGE_DOWNLOAD_TIMEOUT_MS ?? 8_000);

const IMAGE_EXTENSIONS = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const OSTROVY_UPLOAD_URL_PREFIX = "/uploads/ostrovy/";

export function normalizeImageMime(value: string | null | undefined): string | null {
  const mime = value?.split(";")[0]?.trim().toLowerCase();
  return mime && IMAGE_EXTENSIONS.has(mime) ? mime : null;
}

export function imageExtensionForMime(mime: string): string | null {
  return IMAGE_EXTENSIONS.get(mime) ?? null;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "ostrov";
}

export async function saveOstrovyImageBuffer(
  buffer: Buffer,
  mime: string,
  baseName: string,
): Promise<{ url: string; fileName: string }> {
  const extension = imageExtensionForMime(mime);
  if (!extension) throw new Error("Unsupported image type.");

  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const fileName = `${slugify(baseName)}-${hash}.${extension}`;
  await mkdir(OSTROVY_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(OSTROVY_UPLOAD_DIR, fileName), buffer);

  return {
    fileName,
    url: `${OSTROVY_UPLOAD_URL_PREFIX}${fileName}`,
  };
}

export function ostrovyUploadUrlToPath(value: string): string | null {
  if (!value.startsWith(OSTROVY_UPLOAD_URL_PREFIX)) return null;

  const fileName = value.slice(OSTROVY_UPLOAD_URL_PREFIX.length);
  if (!fileName || fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) return null;

  return path.join(OSTROVY_UPLOAD_DIR, fileName);
}

export async function ostrovyUploadExists(value: string): Promise<boolean> {
  const filePath = ostrovyUploadUrlToPath(value);
  if (!filePath) return false;

  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }
  const first = normalized.split(":")[0];
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    first.startsWith("fc") ||
    first.startsWith("fd")
  );
}

function isPrivateIpAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertPublicHttpImageUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only public HTTP(S) image URLs are supported.");
  }

  const hostname = normalizeHostname(url.hostname);
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Local image URLs are not allowed.");
  }

  const directIpVersion = isIP(hostname);
  const addresses = directIpVersion
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });

  if (addresses.length === 0 || addresses.some((item) => isPrivateIpAddress(item.address))) {
    throw new Error("Image URL resolves to a non-public address.");
  }

  return url;
}

async function fetchPublicUrl(value: string, redirects = 0): Promise<Response> {
  const url = await assertPublicHttpImageUrl(value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "svetoplavci-app/0.1 ostrovy-image-download",
      },
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Image download timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || redirects >= MAX_REDIRECTS) {
      throw new Error("Image download redirect could not be followed safely.");
    }
    return fetchPublicUrl(new URL(location, url).toString(), redirects + 1);
  }

  return response;
}

function detectImageMime(buffer: Buffer): string | null {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export async function downloadPublicOstrovyImage(url: string): Promise<{ buffer: Buffer; mime: string }> {
  const response = await fetchPublicUrl(url);
  if (!response.ok) {
    throw new Error(`Image download failed (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength <= 0 || arrayBuffer.byteLength > MAX_DOWNLOADED_IMAGE_BYTES) {
    throw new Error("Downloaded image is empty or too large.");
  }

  const buffer = Buffer.from(arrayBuffer);
  const contentType = normalizeImageMime(response.headers.get("content-type")) ?? detectImageMime(buffer);
  if (!contentType) {
    throw new Error("Downloaded file is not a supported image.");
  }

  return {
    buffer,
    mime: contentType,
  };
}

export async function saveRemoteOstrovyImage(
  imageUrl: string,
  baseName: string,
  fallbackImageUrls: string[] = [],
): Promise<{ url: string; fileName: string }> {
  const urls = [imageUrl, ...fallbackImageUrls]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);

  const downloaded = await Promise.any(urls.map((url) => downloadPublicOstrovyImage(url)))
    .catch(() => {
      throw new Error("Image could not be downloaded.");
    });
  return saveOstrovyImageBuffer(downloaded.buffer, downloaded.mime, baseName);
}
