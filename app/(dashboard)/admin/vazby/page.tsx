import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Link2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatDateTime, formatPersonDisplayName } from "../uzivatele/format";
import {
  ADMIN_RELATIONS_PAGE_SIZE,
  getAdminRelationsPage,
  parseAdminRelationsSearchParams,
} from "./data";
import {
  CreateRelationDialog,
  DeactivateRelationDialog,
} from "./relation-dialogs";

export const dynamic = "force-dynamic";

type AdminRelationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type RelationPerson = {
  id: string;
  displayName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  nickname: string | null;
  isActive: boolean;
  roles: { role: string }[];
  sourceRecords: { sourceType: string; primaryEmail: string | null }[];
  loginLinks: { identity: { normalizedValue: string } }[];
};

function buildRelationsHref(
  overrides: Record<string, string | number | null>,
  current: Record<string, string>,
): string {
  const params = new URLSearchParams(current);
  Object.entries(overrides).forEach(([key, value]) => {
    if (!value) params.delete(key);
    else params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `/admin/vazby?${query}` : "/admin/vazby";
}

function paginationRange(page: number, pageCount: number): number[] {
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  const pages: number[] = [];
  for (let value = start; value <= end; value += 1) pages.push(value);
  return pages;
}

function personEmail(person: RelationPerson): string {
  return (
    person.loginLinks[0]?.identity.normalizedValue ??
    person.sourceRecords.find((record) => record.primaryEmail)?.primaryEmail ??
    "-"
  );
}

function personRoles(person: RelationPerson): string {
  return person.roles.map((role) => role.role).join(", ") || "bez role";
}

function PersonCell({ person }: { person: RelationPerson }) {
  return (
    <div className="min-w-[14rem] space-y-1">
      <Link
        href={`/admin/uzivatele/${person.id}`}
        className="font-semibold text-[#0E2A5C] hover:text-[#C8372D]"
      >
        {formatPersonDisplayName(person)}
      </Link>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={person.isActive ? "secondary" : "outline"}>
          {person.isActive ? "aktivní" : "neaktivní"}
        </Badge>
        <span className="text-xs text-[#7F88A0]">{personRoles(person)}</span>
      </div>
      <div className="text-xs text-[#4A5A7C]">{personEmail(person)}</div>
    </div>
  );
}

function CompactPersonList({
  people,
  emptyLabel,
  action,
}: {
  people: RelationPerson[];
  emptyLabel: string;
  action?: (person: RelationPerson) => ReactNode;
}) {
  if (people.length === 0)
    return <div className="sv-placeholder">{emptyLabel}</div>;

  return (
    <div className="divide-y divide-[#D6DFF0] rounded-[12px] border border-[#D6DFF0] bg-white">
      {people.map((person) => (
        <div
          key={person.id}
          className="flex items-start justify-between gap-3 p-3"
        >
          <div className="min-w-0">
            <Link
              href={`/admin/uzivatele/${person.id}`}
              className="font-semibold text-[#0E2A5C] hover:text-[#C8372D]"
            >
              {formatPersonDisplayName(person)}
            </Link>
            <div className="text-xs text-[#7F88A0]">{personEmail(person)}</div>
          </div>
          <Badge variant="outline">{personRoles(person)}</Badge>
          {action?.(person)}
        </div>
      ))}
    </div>
  );
}

export default async function AdminRelationsPage({
  searchParams,
}: AdminRelationsPageProps) {
  const rawSearchParams = await searchParams;
  const filters = parseAdminRelationsSearchParams(rawSearchParams);
  const currentParams = {
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
  const {
    relations,
    totalCount,
    activeCount,
    inactiveCount,
    childrenWithoutParentsCount,
    parentsWithoutChildrenCount,
    childrenWithoutParents,
    parentsWithoutChildren,
    sourceOptions,
    parentOptions,
    childOptions,
    page,
    pageSize,
    pageCount,
  } = await getAdminRelationsPage(filters);
  const firstVisible = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastVisible = Math.min(totalCount, page * pageSize);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="sv-card p-6">
          <p className="sv-eyebrow text-[#C8372D]">Rodina</p>
          <h1 className="sv-display-sm mt-2 text-[#0E2A5C]">
            Vazby rodič-dítě
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Read-only přehled rodinných vazeb. Přístup rodiče k dítěti se řeší
            tady, ne druhým schváleným loginem stejného e-mailu.
          </p>
          <div className="mt-4">
            <CreateRelationDialog
              parentOptions={parentOptions}
              childOptions={childOptions}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="sv-card p-4">
            <p className="sv-eyebrow text-[#4A5A7C]">Aktivní vazby</p>
            <p className="mt-1 text-2xl font-semibold text-[#0E2A5C]">
              {activeCount}
            </p>
            <p className="text-xs text-[#7F88A0]">
              {inactiveCount} neaktivních
            </p>
          </div>
          <div className="sv-card p-4">
            <p className="sv-eyebrow text-[#4A5A7C]">Ke kontrole</p>
            <p className="mt-1 text-2xl font-semibold text-[#C8372D]">
              {childrenWithoutParentsCount + parentsWithoutChildrenCount}
            </p>
            <p className="text-xs text-[#7F88A0]">
              děti bez rodiče + rodiče bez dětí
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Všechny vazby</CardTitle>
            <CardDescription>
              Rodičovské vazby ve stavu aktivní i neaktivní.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#0E2A5C]">
              {activeCount + inactiveCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Děti bez rodiče</CardTitle>
            <CardDescription>
              Aktivní žáci bez aktivní vazby na rodiče.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#C8372D]">
              {childrenWithoutParentsCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rodiče bez dětí</CardTitle>
            <CardDescription>
              Aktivní rodiče bez aktivní vazby na dítě.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#C8372D]">
              {parentsWithoutChildrenCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Děti bez rodiče</CardTitle>
                <CardDescription>
                  Prvních několik položek pro kontrolu importu.
                </CardDescription>
              </div>
              <AlertTriangle
                className="size-5 text-[#C8372D]"
                aria-hidden={true}
              />
            </div>
          </CardHeader>
          <CardContent>
            <CompactPersonList
              people={childrenWithoutParents}
              emptyLabel="Všechny aktivní děti mají rodiče"
              action={(person) => (
                <CreateRelationDialog
                  parentOptions={parentOptions}
                  childOptions={childOptions}
                  initialChildIds={[person.id]}
                  triggerLabel="Připojit rodiče"
                  triggerVariant="outline"
                  triggerSize="xs"
                />
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Rodiče bez dětí</CardTitle>
                <CardDescription>
                  Typicky nevyřešené nebo chybně spárované CSV řádky.
                </CardDescription>
              </div>
              <AlertTriangle
                className="size-5 text-[#C8372D]"
                aria-hidden={true}
              />
            </div>
          </CardHeader>
          <CardContent>
            <CompactPersonList
              people={parentsWithoutChildren}
              emptyLabel="Všichni aktivní rodiče mají dítě"
              action={(person) => (
                <CreateRelationDialog
                  parentOptions={parentOptions}
                  childOptions={childOptions}
                  initialParentIds={[person.id]}
                  triggerLabel="Připojit dítě"
                  triggerVariant="outline"
                  triggerSize="xs"
                />
              )}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Vyhledávání</CardTitle>
              <CardDescription>
                Jméno rodiče, dítěte nebo e-mail.
              </CardDescription>
            </div>
            <Badge variant="outline">
              <Link2 className="size-3" aria-hidden={true} />
              {relations.length}/
              {Math.min(totalCount, ADMIN_RELATIONS_PAGE_SIZE)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto]"
            action="/admin/vazby"
          >
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">
                Hledat
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7F88A0]" />
                <Input
                  name="q"
                  defaultValue={filters.q}
                  placeholder="Rodič, dítě nebo e-mail..."
                  className="pl-9"
                />
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">
                Zdroj
              </span>
              <select
                name="source"
                defaultValue={filters.source}
                className="h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
              >
                <option value="">Všechny zdroje</option>
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">Stav</span>
              <select
                name="status"
                defaultValue={filters.status}
                className="h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
              >
                <option value="">Vše</option>
                <option value="active">Aktivní</option>
                <option value="inactive">Neaktivní</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit" className="w-full lg:w-auto">
                Filtrovat
              </Button>
              <Button asChild variant="outline" className="w-full lg:w-auto">
                <Link href="/admin/vazby">Vymazat</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Vazby</CardTitle>
              <CardDescription>
                Zobrazuji {firstVisible}-{lastVisible} z {totalCount}{" "}
                odpovídajících vazeb.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              >
                <Link
                  href={buildRelationsHref(
                    { page: page > 2 ? page - 1 : null },
                    currentParams,
                  )}
                >
                  Předchozí
                </Link>
              </Button>
              {paginationRange(page, pageCount).map((pageNumber) => (
                <Button
                  key={pageNumber}
                  asChild
                  variant={pageNumber === page ? "default" : "outline"}
                  size="sm"
                  className="min-w-8 px-3"
                >
                  <Link
                    href={buildRelationsHref(
                      { page: pageNumber === 1 ? null : pageNumber },
                      currentParams,
                    )}
                  >
                    {pageNumber}
                  </Link>
                </Button>
              ))}
              <Button
                asChild
                variant="outline"
                size="sm"
                className={
                  page >= pageCount ? "pointer-events-none opacity-50" : ""
                }
              >
                <Link
                  href={buildRelationsHref({ page: page + 1 }, currentParams)}
                >
                  Další
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {relations.length === 0 ? (
            <div className="sv-placeholder">
              Žádné vazby neodpovídají filtrům
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rodič</TableHead>
                  <TableHead>Dítě</TableHead>
                  <TableHead>Zdroj</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead>Audit</TableHead>
                  <TableHead>Upraveno</TableHead>
                  <TableHead>Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relations.map((relation) => (
                  <TableRow key={relation.id}>
                    <TableCell>
                      <PersonCell person={relation.parentPerson} />
                    </TableCell>
                    <TableCell>
                      <PersonCell person={relation.childPerson} />
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {relation.source}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={relation.isActive ? "secondary" : "outline"}
                      >
                        {relation.isActive ? "aktivní" : "neaktivní"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      <div>{relation.changeReason ?? "-"}</div>
                      <div className="text-xs text-[#7F88A0]">
                        {relation.updatedBy ?? relation.createdBy ?? ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {formatDateTime(relation.updatedAt)}
                    </TableCell>
                    <TableCell>
                      {relation.isActive ? (
                        <DeactivateRelationDialog
                          relationId={relation.id}
                          parentName={formatPersonDisplayName(
                            relation.parentPerson,
                          )}
                          childName={formatPersonDisplayName(
                            relation.childPerson,
                          )}
                        />
                      ) : (
                        <span className="text-sm text-[#7F88A0]">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
