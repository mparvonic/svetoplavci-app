import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/src/lib/prisma";
import { resolvePersonName } from "@/src/lib/person-name";
import {
  listOstrovyForChild,
  registerOstrovStudent,
  unregisterOstrovStudent,
} from "@/src/lib/school-events/ostrovy";
import {
  CHILD_VIEW_ROLE_CODES,
  getApiSessionContext,
  hasAnySessionRole,
} from "@/src/lib/api/session";

export const runtime = "nodejs";
export const maxDuration = 60;

type RegistrationAction = "register" | "unregister";
type ChildSummary = { id: string; displayName: string; firstName?: string | null; nickname?: string | null };

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

async function resolveAccessibleChildren(personIds: string[], roles: string[]): Promise<ChildSummary[]> {
  const normalizedRoles = roles.map((role) => role.toLowerCase());
  const isParent = normalizedRoles.includes("rodic");
  const parentChildIds = new Set<string>();

  if (isParent && personIds.length > 0) {
    const links = await prisma.appPersonRelation.findMany({
      where: {
        parentPersonId: { in: personIds },
        relationType: "parent_of",
        isActive: true,
      },
      select: { childPersonId: true },
    });
    for (const link of links) parentChildIds.add(link.childPersonId);
  }

  const directStudents = normalizedRoles.includes("zak")
    ? await prisma.appPerson.findMany({
        where: {
          id: { in: personIds },
          isActive: true,
          roles: { some: { role: "zak", isActive: true } },
        },
        select: { id: true, displayName: true, firstName: true, nickname: true },
      })
    : [];

  const parentChildren = normalizedRoles.includes("rodic")
    ? await prisma.appPersonRelation.findMany({
        where: {
          parentPersonId: { in: personIds },
          relationType: "parent_of",
          isActive: true,
          childPerson: {
            is: {
              isActive: true,
              roles: { some: { role: "zak", isActive: true } },
            },
          },
        },
        select: {
          childPerson: {
            select: { id: true, displayName: true, firstName: true, nickname: true },
          },
        },
      })
    : [];

  const unique = new Map<string, ChildSummary>();
  for (const child of directStudents) unique.set(child.id, child);
  for (const link of parentChildren) unique.set(link.childPerson.id, link.childPerson);
  return [...unique.values()]
    .map((child) => ({
      ...child,
      displayName: resolvePersonName(
        {
          nickname: child.nickname,
          displayName: child.displayName,
          firstName: child.firstName,
        },
        { preferFirstName: parentChildIds.has(child.id) },
      ),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "cs"));
}

async function resolveAccessibleChild(
  personIds: string[],
  roles: string[],
  childId: string,
): Promise<ChildSummary | null> {
  const normalizedRoles = roles.map((role) => role.toLowerCase());

  if (normalizedRoles.includes("zak") && personIds.includes(childId)) {
    const child = await prisma.appPerson.findFirst({
      where: {
        id: childId,
        isActive: true,
        roles: { some: { role: "zak", isActive: true } },
      },
      select: { id: true, displayName: true, firstName: true, nickname: true },
    });
    return child
      ? {
          ...child,
          displayName: resolvePersonName({
            nickname: child.nickname,
            displayName: child.displayName,
            firstName: child.firstName,
          }),
        }
      : null;
  }

  if (normalizedRoles.includes("rodic")) {
    const link = await prisma.appPersonRelation.findFirst({
      where: {
        parentPersonId: { in: personIds },
        childPersonId: childId,
        relationType: "parent_of",
        isActive: true,
        childPerson: {
          is: {
            isActive: true,
            roles: { some: { role: "zak", isActive: true } },
          },
        },
      },
      select: {
        childPerson: {
          select: { id: true, displayName: true, firstName: true, nickname: true },
        },
      },
    });
    const child = link?.childPerson ?? null;
    return child
      ? {
          ...child,
          displayName: resolvePersonName(
            {
              nickname: child.nickname,
              displayName: child.displayName,
              firstName: child.firstName,
            },
            { preferFirstName: true },
          ),
        }
      : null;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const context = await getApiSessionContext(req);
  if (!context) return unauthorized();
  if (!hasAnySessionRole(context.roles, CHILD_VIEW_ROLE_CODES)) return forbidden();

  const requestedChildId = req.nextUrl.searchParams.get("childId");
  const includeChildren = req.nextUrl.searchParams.get("includeChildren") !== "0";
  const from = req.nextUrl.searchParams.get("from") ?? undefined;
  const to = req.nextUrl.searchParams.get("to") ?? undefined;

  const children = includeChildren || !requestedChildId
    ? await resolveAccessibleChildren(context.personIds, context.roles)
    : [];

  let selectedChildren: ChildSummary[];
  if (requestedChildId) {
    const selectedChild = includeChildren
      ? children.find((child) => child.id === requestedChildId) ?? null
      : await resolveAccessibleChild(context.personIds, context.roles, requestedChildId);
    if (!selectedChild) {
      return NextResponse.json({ error: "Child not found or not accessible." }, { status: 404 });
    }
    selectedChildren = [selectedChild];
  } else {
    selectedChildren = children.slice(0, 1);
  }

  const result = await Promise.all(
    selectedChildren.map(async (child) => ({
      child,
      events: await listOstrovyForChild(child.id, { from, to }),
    })),
  );

  return NextResponse.json({ children, result });
}

export async function POST(req: NextRequest) {
  const context = await getApiSessionContext(req);
  if (!context) return unauthorized();
  if (!hasAnySessionRole(context.roles, CHILD_VIEW_ROLE_CODES)) return forbidden();

  let payload: {
    childId?: string;
    eventId?: string;
    action?: RegistrationAction;
    allowTransfer?: boolean;
  } = {};
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const childId = payload.childId?.trim();
  const eventId = payload.eventId?.trim();
  if (!childId || !eventId) {
    return NextResponse.json({ error: "childId and eventId are required." }, { status: 400 });
  }

  const child = await resolveAccessibleChild(context.personIds, context.roles, childId);
  if (!child) {
    return NextResponse.json({ error: "Child not found or not accessible." }, { status: 404 });
  }

  const action = payload.action ?? "register";
  if (action !== "register" && action !== "unregister") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  try {
    const result = action === "register"
      ? await registerOstrovStudent({
          eventId,
          personId: childId,
          actorPersonId: context.actorPersonId,
          actorRoles: context.roles,
          allowTransfer: Boolean(payload.allowTransfer),
          allowGuideException: false,
          sourceRef: "api/ostrovy/my-children",
          enqueueCalendarSync: false,
          waitForCalendarSync: false,
        })
      : await unregisterOstrovStudent({
          eventId,
          personId: childId,
          actorPersonId: context.actorPersonId,
          actorRoles: context.roles,
          allowGuideException: false,
          sourceRef: "api/ostrovy/my-children",
          enqueueCalendarSync: false,
          waitForCalendarSync: false,
        });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
