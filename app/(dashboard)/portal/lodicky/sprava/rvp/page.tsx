import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen, Database, Filter, Network, Sailboat } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auth } from "@/src/lib/auth";
import { LOCAL_DEV_ROLES, collectSessionRoles, isLocalDevAuthBypass } from "@/src/lib/api/session";
import { getSelectedDevAuthUser } from "@/src/lib/dev-auth";

import { canViewRvpManagement, getRvpManagementPage, parseRvpManagementFilters } from "../data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const selectClass =
  "h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20";

function formatDate(value: Date | null) {
  if (!value) return "bez konce";
  return value.toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function RvpSectionNav() {
  return (
    <div className="flex flex-wrap gap-2 rounded-[12px] border border-[#D6DFF0] bg-white p-2">
      <Button asChild variant="outline">
        <Link href="/portal/lodicky/sprava">
          <Sailboat className="size-4" aria-hidden={true} />
          Správa sady lodiček
        </Link>
      </Button>
      <Button type="button" aria-current="page" className="cursor-default hover:translate-y-0 hover:bg-primary">
        <BookOpen className="size-4" aria-hidden={true} />
        Správa RVP
      </Button>
      <Button asChild variant="outline">
        <Link href="/portal/lodicky/sprava/vazby">
          <Network className="size-4" aria-hidden={true} />
          Vazby RVP
        </Link>
      </Button>
    </div>
  );
}

export default async function RvpSpravaPage({ searchParams }: PageProps) {
  const session = await auth();
  const selectedDevUser = isLocalDevAuthBypass() ? await getSelectedDevAuthUser() : null;

  if (!session?.user?.email && !selectedDevUser && !isLocalDevAuthBypass()) {
    redirect("/auth/signin?callbackUrl=/portal/lodicky/sprava/rvp");
  }

  const roles = selectedDevUser?.roles ?? (session ? collectSessionRoles(session) : LOCAL_DEV_ROLES);
  if (!canViewRvpManagement(roles)) {
    redirect("/portal/lodicky");
  }

  const rawSearchParams = await searchParams;
  const filters = parseRvpManagementFilters(rawSearchParams);
  let page: Awaited<ReturnType<typeof getRvpManagementPage>>;
  try {
    page = await getRvpManagementPage({ filters });
  } catch (error) {
    console.error("[lodicky/sprava/rvp] failed to load RVP data", error);
    return (
      <div className="space-y-6">
        <section className="sv-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="sv-eyebrow text-[#C8372D]">Správa RVP</p>
              <h1 className="sv-display-sm text-[#0E2A5C]">RVP verze a OVU</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Správa RVP je připravená, ale teď se nepodařilo načíst data z vývojové databáze.
              </p>
            </div>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EEF2F7] text-[#0E2A5C]">
              <BookOpen className="size-5" aria-hidden={true} />
            </span>
          </div>
        </section>
        <RvpSectionNav />
        <Card>
          <CardHeader>
            <CardTitle>Databáze není dostupná</CardTitle>
            <CardDescription>
              Preview server běží, ale aktuální DB connection string neumožnil načíst RVP data.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[#4A5A7C]">
            Jakmile bude v dev prostředí nastavené platné <span className="font-mono">POSTGRES_PRISMA_URL</span>,
            stránka zobrazí RVP verze, OVU a navázané sady.
          </CardContent>
        </Card>
      </div>
    );
  }
  const selectedRvp = page.selectedRvp;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="sv-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="sv-eyebrow text-[#C8372D]">Správa RVP</p>
              <h1 className="sv-display-sm text-[#0E2A5C]">RVP verze a OVU</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                RVP je referenční vrstva pro sady lodiček. Tady je vidět, které RVP verze existují,
                na jaké sady jsou napojené a jak jsou OVU použité v katalogu.
              </p>
            </div>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EEF2F7] text-[#0E2A5C]">
              <BookOpen className="size-5" aria-hidden={true} />
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/lodicky/sprava">
                <ArrowLeft className="size-4" aria-hidden={true} />
                Zpět na správu lodiček
              </Link>
            </Button>
          </div>
        </div>

        <div className="sv-card border-[#0E2A5C] bg-[#0E2A5C] p-6 text-white">
          <p className="sv-eyebrow text-white/70">Vybraná RVP</p>
          <p className="mt-2 text-2xl font-semibold">{selectedRvp?.datasetVersion ?? "nenalezena"}</p>
          <p className="mt-2 text-xs text-white/75">
            {selectedRvp?.sourceFormat ?? "-"} · OVU {selectedRvp?.ovuCount ?? 0} · uzlové body {selectedRvp?.uzlovyBodCount ?? 0}
          </p>
          <p className="mt-1 text-xs text-white/75">
            Import: {formatDate(selectedRvp?.importedAt ?? null)}
          </p>
        </div>
      </section>

      <RvpSectionNav />

      <div className="grid gap-4 md:grid-cols-3">
        {page.rvpVersions.map((rvp) => (
          <Card key={rvp.id} className={selectedRvp?.id === rvp.id ? "border-[#0E2A5C]" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{rvp.datasetVersion}</CardTitle>
                  <CardDescription>{rvp.sourceFormat}</CardDescription>
                </div>
                <Badge variant={rvp.isActive ? "default" : "outline"}>{rvp.isActive ? "aktivní" : "archiv"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#4A5A7C]">
              <div className="grid grid-cols-3 gap-2">
                <div><span className="font-semibold text-[#0E2A5C]">{rvp.ovuCount}</span><br />OVU</div>
                <div><span className="font-semibold text-[#0E2A5C]">{rvp.uzlovyBodCount}</span><br />uzlů</div>
                <div><span className="font-semibold text-[#0E2A5C]">{rvp.svpVersionCount}</span><br />sad</div>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/portal/lodicky/sprava/rvp?rvp=${rvp.id}`}>Otevřít</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Sady navázané na RVP</CardTitle>
              <CardDescription>RVP se do praxe dostává přes konkrétní sadu lodiček.</CardDescription>
            </div>
            <Database className="size-5 text-[#0E2A5C]" aria-hidden={true} />
          </div>
        </CardHeader>
        <CardContent>
          {page.svpLinks.length === 0 ? (
            <div className="sv-placeholder">Na vybranou RVP verzi zatím není navázaná žádná sada.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sada</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead>Platnost</TableHead>
                  <TableHead>Lodičky</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.svpLinks.map((svp) => (
                  <TableRow key={svp.id}>
                    <TableCell className="font-semibold text-[#0E2A5C]">{svp.label}</TableCell>
                    <TableCell>
                      <Badge variant={svp.isCurrent ? "default" : "outline"}>{svp.isCurrent ? "aktuální" : svp.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {formatDate(svp.effectiveFrom)} až {formatDate(svp.effectiveTo)}
                    </TableCell>
                    <TableCell>{svp.lodickyCount}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/portal/lodicky/sprava?svp=${svp.id}`}>
                          <Sailboat className="size-3.5" aria-hidden={true} />
                          Otevřít sadu
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>OVU ve vybrané RVP</CardTitle>
              <CardDescription>Zobrazuji nejvýše 500 OVU. Počet lodiček ukazuje katalogové napojení.</CardDescription>
            </div>
            <Badge variant="outline">
              <Filter className="size-3" aria-hidden={true} />
              {page.ovuRows.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action="/portal/lodicky/sprava/rvp" className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_minmax(14rem,1fr)_auto]">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">Hledat OVU</span>
              <Input name="q" defaultValue={filters.q} placeholder="Kód, text OVU, uzlový bod..." />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">RVP verze</span>
              <select name="rvp" defaultValue={selectedRvp?.id ?? ""} className={selectClass}>
                {page.rvpVersions.map((rvp) => (
                  <option key={rvp.id} value={rvp.id}>
                    {rvp.datasetVersion} · {rvp.sourceFormat}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit">Filtrovat</Button>
              <Button asChild variant="outline">
                <Link href="/portal/lodicky/sprava/rvp">Vymazat</Link>
              </Button>
            </div>
          </form>

          {page.ovuRows.length === 0 ? (
            <div className="sv-placeholder">Pro zadané hledání nejsou dostupné žádné OVU.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kód</TableHead>
                  <TableHead>Uzlový bod</TableHead>
                  <TableHead>OVU</TableHead>
                  <TableHead>Lodičky</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.ovuRows.map((ovu) => (
                  <TableRow key={ovu.id}>
                    <TableCell className="font-mono text-xs text-[#4A5A7C]">{ovu.kod}</TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {ovu.uzlovyBodKod ? `${ovu.uzlovyBodKod} · ${ovu.uzlovyBodNazev}` : "bez uzlového bodu"}
                    </TableCell>
                    <TableCell className="text-sm text-[#0E2A5C]">{ovu.zneni}</TableCell>
                    <TableCell>
                      <Badge variant={ovu.linkedLodickyCount > 0 ? "secondary" : "destructive"}>
                        {ovu.linkedLodickyCount}
                      </Badge>
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
