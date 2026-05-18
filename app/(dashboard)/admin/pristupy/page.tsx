import Link from "next/link";
import { KeyRound, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { formatDateTime, formatPersonDisplayName } from "../uzivatele/format";
import { ConflictResolutionDialog } from "./conflict-resolution-dialog";
import { ADMIN_ACCESS_PAGE_SIZE, getAdminAccessPage, parseAdminAccessSearchParams } from "./data";

export const dynamic = "force-dynamic";

type AdminAccessPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AccessAuth = {
  emailVerified: Date | null;
  providers: string[];
  activeSessionExpires: Date | null;
};

function buildAccessHref(
  overrides: Record<string, string | number | null>,
  current: Record<string, string>,
): string {
  const params = new URLSearchParams(current);
  Object.entries(overrides).forEach(([key, value]) => {
    if (!value) params.delete(key);
    else params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `/admin/pristupy?${query}` : "/admin/pristupy";
}

function authSummary(auth: AccessAuth | undefined): string {
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

export default async function AdminAccessPage({ searchParams }: AdminAccessPageProps) {
  const rawSearchParams = await searchParams;
  const filters = parseAdminAccessSearchParams(rawSearchParams);
  const currentParams = {
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
  const {
    identities,
    totalCount,
    activeIdentities,
    approvedLinks,
    pendingLinks,
    openConflictsCount,
    authByEmail,
    page,
    pageSize,
    pageCount,
  } = await getAdminAccessPage(filters);
  const firstVisible = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastVisible = Math.min(totalCount, page * pageSize);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="sv-card p-6">
          <p className="sv-eyebrow text-[#C8372D]">Login</p>
          <h1 className="sv-display-sm mt-2 text-[#0E2A5C]">Přístupy a oprávnění</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Read-only přehled login identit, vazeb na osoby a konfliktů, které je potřeba ručně rozhodnout.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="sv-card p-4">
            <p className="sv-eyebrow text-[#4A5A7C]">Login identity</p>
            <p className="mt-1 text-2xl font-semibold text-[#0E2A5C]">{totalCount}</p>
            <p className="text-xs text-[#7F88A0]">{activeIdentities} aktivních</p>
          </div>
          <div className="sv-card p-4">
            <p className="sv-eyebrow text-[#4A5A7C]">Otevřené konflikty</p>
            <p className="mt-1 text-2xl font-semibold text-[#C8372D]">{openConflictsCount}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Schválené vazby</CardTitle>
            <CardDescription>Login identita je povolená pro konkrétní osobu.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#0E2A5C]">{approvedLinks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Čekající vazby</CardTitle>
            <CardDescription>Potřebují kontrolu nebo potvrzení.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#0E2A5C]">{pendingLinks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Konflikty</CardTitle>
            <CardDescription>Typicky jeden e-mail navázaný na více osob.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant={openConflictsCount > 0 ? "default" : "outline"} size="sm">
              <Link href="/admin/pristupy?status=conflict">Filtrovat konflikty</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Vyhledávání</CardTitle>
              <CardDescription>E-mail, jméno osoby nebo stav vazby.</CardDescription>
            </div>
            <Badge variant="outline">
              <KeyRound className="size-3" aria-hidden={true} />
              {identities.length}/{Math.min(totalCount, ADMIN_ACCESS_PAGE_SIZE)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_14rem_auto]" action="/admin/pristupy">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">Hledat</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7F88A0]" />
                <Input name="q" defaultValue={filters.q} placeholder="E-mail nebo osoba..." className="pl-9" />
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">Stav</span>
              <select
                name="status"
                defaultValue={filters.status}
                className="h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
              >
                <option value="">Vše</option>
                <option value="active">Aktivní identity</option>
                <option value="inactive">Neaktivní identity</option>
                <option value="approved">Schválené vazby</option>
                <option value="pending">Čekající vazby</option>
                <option value="conflict">Otevřené konflikty</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit" className="w-full lg:w-auto">
                Filtrovat
              </Button>
              <Button asChild variant="outline" className="w-full lg:w-auto">
                <Link href="/admin/pristupy">Vymazat</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Login identity</CardTitle>
              <CardDescription>
                Zobrazuji {firstVisible}-{lastVisible} z {totalCount} odpovídajících identit.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                <Link href={buildAccessHref({ page: page > 2 ? page - 1 : null }, currentParams)}>Předchozí</Link>
              </Button>
              {paginationRange(page, pageCount).map((pageNumber) => (
                <Button
                  key={pageNumber}
                  asChild
                  variant={pageNumber === page ? "default" : "outline"}
                  size="sm"
                  className="min-w-8 px-3"
                >
                  <Link href={buildAccessHref({ page: pageNumber === 1 ? null : pageNumber }, currentParams)}>
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
                <Link href={buildAccessHref({ page: page + 1 }, currentParams)}>Další</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {identities.length === 0 ? (
            <div className="sv-placeholder">Žádné login identity neodpovídají filtrům</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identita</TableHead>
                  <TableHead>Vazby na osoby</TableHead>
                  <TableHead>Auth stav</TableHead>
                  <TableHead>Konflikty</TableHead>
                  <TableHead>Upraveno</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {identities.map((identity) => {
                  const auth = authByEmail.get(identity.normalizedValue.toLowerCase());
                  return (
                    <TableRow key={identity.id}>
                      <TableCell>
                        <div className="min-w-[14rem] space-y-1">
                          <div className="font-semibold text-[#0E2A5C]">{identity.normalizedValue}</div>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={identity.isActive ? "secondary" : "outline"}>
                              {identity.isActive ? "aktivní" : "neaktivní"}
                            </Badge>
                            <Badge variant="outline">{identity.identityType}</Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {identity.personLinks.length === 0 ? (
                            <span className="text-sm text-[#7F88A0]">bez vazby</span>
                          ) : (
                            identity.personLinks.map((link) => (
                              <div key={link.id} className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant={link.status === "approved" ? "secondary" : "outline"}>
                                  {link.status}
                                </Badge>
                                <Link
                                  href={`/admin/uzivatele/${link.person.id}`}
                                  className="font-medium text-[#0E2A5C] hover:text-[#C8372D]"
                                >
                                  {formatPersonDisplayName(link.person)}
                                </Link>
                                <span className="text-xs text-[#7F88A0]">
                                  {link.person.roles.map((role) => role.role).join(", ") || "bez role"}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-[#4A5A7C]">{authSummary(auth)}</TableCell>
                      <TableCell>
                        {identity.conflicts.length === 0 ? (
                          <span className="text-sm text-[#7F88A0]">-</span>
                        ) : (
                          <ConflictResolutionDialog
                            identityId={identity.id}
                            email={identity.normalizedValue}
                            conflicts={identity.conflicts.map((conflict) => ({
                              id: conflict.id,
                              reason: conflict.reason,
                              createdAt: conflict.createdAt.toISOString(),
                            }))}
                            candidates={identity.personLinks.map((link) => ({
                              personId: link.person.id,
                              displayName: formatPersonDisplayName(link.person),
                              status: link.status,
                              roles: link.person.roles.map((role) => role.role),
                            }))}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-[#4A5A7C]">{formatDateTime(identity.updatedAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
