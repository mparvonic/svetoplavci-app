import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  ADMIN_USERS_PAGE_SIZE,
  getAdminUsersPage,
  parseAdminUsersSearchParams,
} from "./data";
import { formatDateTime, formatPersonDisplayName, uniqueText } from "./format";

type AdminUsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildUsersHref(
  overrides: Record<string, string | number | null>,
  current: Record<string, string | string[]>,
): string {
  const params = new URLSearchParams();
  Object.entries(current).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else {
      params.set(key, value);
    }
  });
  Object.entries(overrides).forEach(([key, value]) => {
    if (!value) params.delete(key);
    else params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `/admin/uzivatele?${query}` : "/admin/uzivatele";
}

function relationSummary(person: {
  roles: Array<{ role: string }>;
  parentLinks: unknown[];
  childLinks: unknown[];
}): string {
  const roles = person.roles.map((item) => item.role.toLowerCase());
  if (roles.includes("rodic")) return `${person.parentLinks.length} dětí`;
  if (roles.includes("zak")) return `${person.childLinks.length} rodičů`;
  return "-";
}

function authSummary(
  emails: string[],
  authByEmail: Awaited<ReturnType<typeof getAdminUsersPage>>["authByEmail"],
): string {
  const auth = emails.map((email) => authByEmail.get(email.toLowerCase())).find(Boolean);
  if (!auth) return "-";
  if (auth.activeSessionExpires) return `session do ${formatDateTime(auth.activeSessionExpires)}`;
  if (auth.emailVerified) return `ověřeno ${formatDateTime(auth.emailVerified)}`;
  if (auth.providers.length > 0) return auth.providers.join(", ");
  return "auth účet";
}

function paginationRange(page: number, pageCount: number): number[] {
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  const pages: number[] = [];
  for (let value = start; value <= end; value += 1) pages.push(value);
  return pages;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const rawSearchParams = await searchParams;
  const filters = parseAdminUsersSearchParams(rawSearchParams);
  const currentParams = {
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.roles.length > 0 ? { role: filters.roles } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.sort !== "lastName" ? { sort: filters.sort } : {}),
  };
  const {
    people,
    totalCount,
    activeCount,
    inactiveCount,
    page,
    pageSize,
    pageCount,
    roleOptions,
    sourceOptions,
    authByEmail,
  } =
    await getAdminUsersPage(filters);
  const firstVisible = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastVisible = Math.min(totalCount, page * pageSize);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="sv-card p-6">
          <p className="sv-eyebrow text-[#C8372D]">Osoby</p>
          <h1 className="sv-display-sm mt-2 text-[#0E2A5C]">Správa uživatelů</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Read-only přehled osob v adresáři. Osoba je oddělená od login identity, rodinných vazeb i
            členství ve školních skupinách.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div className="sv-card p-4">
            <p className="sv-eyebrow text-[#4A5A7C]">Celkem</p>
            <p className="mt-1 text-2xl font-semibold text-[#0E2A5C]">{totalCount}</p>
          </div>
          <div className="sv-card p-4">
            <p className="sv-eyebrow text-[#4A5A7C]">Aktivní</p>
            <p className="mt-1 text-2xl font-semibold text-[#0E2A5C]">{activeCount}</p>
          </div>
          <div className="sv-card p-4">
            <p className="sv-eyebrow text-[#4A5A7C]">Neaktivní</p>
            <p className="mt-1 text-2xl font-semibold text-[#0E2A5C]">{inactiveCount}</p>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Vyhledávání a filtry</CardTitle>
              <CardDescription>Jméno, e-mail, identifikátor, role, zdroj dat a stav osoby.</CardDescription>
            </div>
            <Badge variant="outline">
              <SlidersHorizontal className="size-3" aria-hidden={true} />
              {people.length}/{Math.min(totalCount, ADMIN_USERS_PAGE_SIZE)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" action="/admin/uzivatele">
            <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_14rem_10rem_12rem_auto]">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Hledat</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7F88A0]" />
                  <Input name="q" defaultValue={filters.q} placeholder="Jméno, e-mail, ID..." className="pl-9" />
                </div>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Zdroj dat</span>
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
                  <option value="">Všichni</option>
                  <option value="active">Aktivní</option>
                  <option value="inactive">Neaktivní</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Řazení</span>
                <select
                  name="sort"
                  defaultValue={filters.sort}
                  className="h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
                >
                  <option value="lastName">Podle příjmení</option>
                  <option value="firstName">Podle jména</option>
                </select>
              </label>

              <div className="flex items-end gap-2">
                <Button type="submit" className="w-full lg:w-auto">
                  Filtrovat
                </Button>
                <Button asChild variant="outline" className="w-full lg:w-auto">
                  <Link href="/admin/uzivatele">Vymazat</Link>
                </Button>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-[#4A5A7C]">Role</legend>
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((role) => {
                  const checked = filters.roles.includes(role);
                  return (
                    <label
                      key={role}
                      className={[
                        "inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-semibold transition",
                        checked
                          ? "border-[#0E2A5C] bg-[#0E2A5C] text-white"
                          : "border-[#D6DFF0] bg-white text-[#0E2A5C] hover:bg-[#EEF2F7]",
                      ].join(" ")}
                    >
                      <input name="role" value={role} type="checkbox" defaultChecked={checked} className="sr-only" />
                      {role}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Osoby</CardTitle>
              <CardDescription>
                Zobrazuji prvních {Math.min(totalCount, ADMIN_USERS_PAGE_SIZE)} z {totalCount} odpovídajících osob.
              </CardDescription>
            </div>
            {filters.status && (
              <Button asChild variant="outline" size="sm">
                <Link href={buildUsersHref({ status: null, page: null }, currentParams)}>Zrušit filtr stavu</Link>
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <CardDescription>
              Zobrazuji {firstVisible}-{lastVisible} z {totalCount} odpovídajících osob.
            </CardDescription>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                <Link href={buildUsersHref({ page: page > 2 ? page - 1 : null }, currentParams)}>Předchozí</Link>
              </Button>
              {paginationRange(page, pageCount).map((pageNumber) => (
                <Button
                  key={pageNumber}
                  asChild
                  variant={pageNumber === page ? "default" : "outline"}
                  size="sm"
                  className="min-w-8 px-3"
                >
                  <Link href={buildUsersHref({ page: pageNumber === 1 ? null : pageNumber }, currentParams)}>
                    {pageNumber}
                  </Link>
                </Button>
              ))}
              <Button
                asChild
                variant="outline"
                size="sm"
                className={page >= pageCount ? "pointer-events-none opacity-50" : ""}
              >
                <Link href={buildUsersHref({ page: page + 1 }, currentParams)}>Další</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <div className="sv-placeholder">Žádné osoby neodpovídají filtrům</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Osoba</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>E-maily</TableHead>
                  <TableHead>Vazby</TableHead>
                  <TableHead>Skupiny</TableHead>
                  <TableHead>Přihlášení</TableHead>
                  <TableHead className="text-right">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => {
                  const sourceEmails = person.sourceRecords.map((record) => record.primaryEmail);
                  const loginEmails = person.loginLinks.map((link) => link.identity.normalizedValue);
                  const emails = uniqueText([...sourceEmails, ...loginEmails]);
                  const memberships = person.memberships.slice(0, 2);
                  const displayName = formatPersonDisplayName(person);

                  return (
                    <TableRow key={person.id}>
                      <TableCell>
                        <div className="min-w-[13rem] space-y-1">
                          <Link
                            href={`/admin/uzivatele/${person.id}`}
                            className="font-semibold text-[#0E2A5C] hover:text-[#C8372D]"
                          >
                            {displayName}
                          </Link>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#7F88A0]">
                            <Badge variant={person.isActive ? "secondary" : "outline"}>
                              {person.isActive ? "aktivní" : "neaktivní"}
                            </Badge>
                            {person.nickname && <span>{person.nickname}</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-[16rem] flex-wrap gap-1.5">
                          {person.roles.length === 0 ? (
                            <Badge variant="outline">bez role</Badge>
                          ) : (
                            person.roles.map((role) => (
                              <Badge key={`${role.role}:${role.source}`} variant="outline">
                                {role.role}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[18rem] space-y-1 text-xs text-[#4A5A7C]">
                          {emails.length === 0 ? (
                            <span>-</span>
                          ) : (
                            emails.slice(0, 2).map((email) => <div key={email}>{email}</div>)
                          )}
                          {emails.length > 2 && <div>+{emails.length - 2} další</div>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-[#4A5A7C]">{relationSummary(person)}</TableCell>
                      <TableCell>
                        <div className="max-w-[14rem] space-y-1 text-xs text-[#4A5A7C]">
                          {memberships.length === 0 ? (
                            <span>-</span>
                          ) : (
                            memberships.map((membership) => (
                              <div key={`${membership.groupKind}:${membership.group.code}`}>
                                {membership.group.name}
                              </div>
                            ))
                          )}
                          {person.memberships.length > memberships.length && (
                            <div>+{person.memberships.length - memberships.length} další</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-[#4A5A7C]">
                          <div>{authSummary(emails, authByEmail)}</div>
                          <div>osoba upd. {formatDateTime(person.updatedAt)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/uzivatele/${person.id}`}>Otevřít</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {totalCount > ADMIN_USERS_PAGE_SIZE && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#D6DFF0] pt-4">
              <p className="text-xs text-[#7F88A0]">
                Strana {page} z {pageCount}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                  <Link href={buildUsersHref({ page: page > 2 ? page - 1 : null }, currentParams)}>Předchozí</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={page >= pageCount ? "pointer-events-none opacity-50" : ""}
                >
                  <Link href={buildUsersHref({ page: page + 1 }, currentParams)}>Další</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
