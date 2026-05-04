import { NextRequest, NextResponse } from "next/server";

import { DEV_AUTH_COOKIE_NAME } from "@/src/lib/dev-auth";
import { isBypassAllowedForHost, normalizeHost } from "@/src/lib/environment-access";
import { prisma } from "@/src/lib/prisma";
import { resolvePersonName } from "@/src/lib/person-name";

export const runtime = "nodejs";

type DevKioskUser = {
  id: string;
  displayName: string;
  legalName: string;
};

function isDevKioskBypassEnabledForRequest(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const host = normalizeHost(req.headers.get("x-forwarded-host") || req.headers.get("host"));
  return isBypassAllowedForHost(host);
}

export async function GET(req: NextRequest) {
  if (!isDevKioskBypassEnabledForRequest(req)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const usersRaw = await prisma.appPerson.findMany({
    where: {
      isActive: true,
      roles: {
        some: {
          role: { equals: "zak", mode: "insensitive" },
          isActive: true,
          OR: [{ validFrom: null }, { validFrom: { lte: now } }],
          AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }],
        },
      },
    },
    select: {
      id: true,
      displayName: true,
      nickname: true,
    },
    orderBy: [{ nickname: "asc" }, { displayName: "asc" }],
  });

  const users: DevKioskUser[] = usersRaw.map((user) => ({
    id: user.id,
    displayName: resolvePersonName({
      nickname: user.nickname,
      displayName: user.displayName,
    }),
    legalName: user.displayName,
  }));

  const selectedFromCookie = req.cookies.get(DEV_AUTH_COOKIE_NAME)?.value ?? null;
  const selectedId = users.some((user) => user.id === selectedFromCookie)
    ? selectedFromCookie
    : (users[0]?.id ?? null);

  return NextResponse.json({
    users,
    selectedId,
  });
}
