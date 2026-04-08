import { prisma } from "@/src/lib/prisma";
import { getApprovedLoginProfileByEmail } from "@/src/lib/user-directory";

export interface PortalParent {
  id: string;
  name: string;
}

export interface PortalChild {
  id: string;
  name: string;
}

export interface PortalLodickaRow {
  id: string;
  predmet: string;
  podpredmet: string;
  oblast: string;
  nazevLodicky: string;
  stav: string;
  uspech: string;
  poznamka: string;
  datumStavu: string | null;
}

type ParentCandidate = {
  id: string;
  displayName: string;
  hasRodicRole: boolean;
  children: PortalChild[];
};

const GLOBAL_CHILD_ACCESS_ROLES = new Set(["garant"]);

function dedupeChildren(children: PortalChild[]): PortalChild[] {
  const unique = new Map<string, PortalChild>();
  for (const child of children) {
    if (!unique.has(child.id)) unique.set(child.id, child);
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "cs"));
}

function pickParentCandidate(candidates: ParentCandidate[]): ParentCandidate | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    if (a.hasRodicRole !== b.hasRodicRole) return a.hasRodicRole ? -1 : 1;
    if (a.children.length !== b.children.length) return b.children.length - a.children.length;
    return a.displayName.localeCompare(b.displayName, "cs");
  });
  return sorted[0] ?? null;
}

async function getAllActiveChildren(): Promise<PortalChild[]> {
  const students = await prisma.appPerson.findMany({
    where: {
      isActive: true,
      roles: {
        some: {
          role: "zak",
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      displayName: true,
    },
    orderBy: {
      displayName: "asc",
    },
  });

  return students.map((student) => ({
    id: student.id,
    name: student.displayName,
  }));
}

export async function getPortalParentAndChildrenByEmail(email: string): Promise<{
  parent: PortalParent;
  children: PortalChild[];
} | null> {
  const profile = await getApprovedLoginProfileByEmail(email);
  if (!profile) return null;
  if (profile.personIds.length === 0) return null;

  const people = await prisma.appPerson.findMany({
    where: {
      id: { in: profile.personIds },
      isActive: true,
    },
    include: {
      roles: {
        where: { isActive: true },
        select: { role: true },
      },
      parentLinks: {
        where: {
          isActive: true,
          relationType: "parent_of",
          childPerson: { is: { isActive: true } },
        },
        include: {
          childPerson: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  const parentCandidates: ParentCandidate[] = people.map((person) => ({
    id: person.id,
    displayName: person.displayName,
    hasRodicRole: person.roles.some((role) => role.role === "rodic"),
    children: dedupeChildren(
      person.parentLinks.map((link) => ({
        id: link.childPerson.id,
        name: link.childPerson.displayName,
      }))
    ),
  }));

  const parentCandidate = pickParentCandidate(parentCandidates);
  if (!parentCandidate) return null;

  const hasGlobalChildAccess = people.some((person) =>
    person.roles.some((role) => GLOBAL_CHILD_ACCESS_ROLES.has(role.role))
  );

  const children = hasGlobalChildAccess
    ? await getAllActiveChildren()
    : parentCandidate.children;

  return {
    parent: {
      id: parentCandidate.id,
      name: parentCandidate.displayName,
    },
    children,
  };
}

export async function getPortalChildLodickyByEmail(email: string, childId: string): Promise<{
  parent: PortalParent;
  child: PortalChild;
  lodicky: PortalLodickaRow[];
} | null> {
  const context = await getPortalParentAndChildrenByEmail(email);
  if (!context) return null;

  const child = context.children.find((item) => item.id === childId);
  if (!child) return null;

  const osobniLodicky = await prisma.m01OsobniLodicka.findMany({
    where: {
      isDeleted: false,
      osobniSada: {
        is: {
          personId: child.id,
          status: "ACTIVE",
        },
      },
    },
    include: {
      lodicka: {
        include: {
          predmet: { select: { nazev: true } },
          podpredmet: { select: { nazev: true } },
          oblast: { select: { nazev: true } },
        },
      },
    },
  });

  const lodicky: PortalLodickaRow[] = osobniLodicky
    .map((item) => ({
      id: item.id,
      predmet: item.lodicka.predmet.nazev,
      podpredmet: item.lodicka.podpredmet?.nazev ?? "—",
      oblast: item.lodicka.oblast.nazev,
      nazevLodicky: item.lodicka.nazev,
      stav: item.currentStavLabel?.trim() || "Nezahájeno",
      uspech: item.uspech?.trim() || "—",
      poznamka: item.poznamka?.trim() || "—",
      datumStavu: item.datumStavu?.toISOString() ?? null,
    }))
    .sort((a, b) => {
      const predmet = a.predmet.localeCompare(b.predmet, "cs");
      if (predmet !== 0) return predmet;
      const podpredmet = a.podpredmet.localeCompare(b.podpredmet, "cs");
      if (podpredmet !== 0) return podpredmet;
      const oblast = a.oblast.localeCompare(b.oblast, "cs");
      if (oblast !== 0) return oblast;
      return a.nazevLodicky.localeCompare(b.nazevLodicky, "cs");
    });

  return {
    parent: context.parent,
    child,
    lodicky,
  };
}
