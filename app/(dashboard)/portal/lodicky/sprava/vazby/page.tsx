import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen, Network, Sailboat, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auth } from "@/src/lib/auth";
import { LOCAL_DEV_ROLES, collectSessionRoles, isLocalDevAuthBypass } from "@/src/lib/api/session";
import { getSelectedDevAuthUser } from "@/src/lib/dev-auth";
import { getRvpGraphOverview } from "@/src/lib/m01/rvp-graph";

import { VazbyWorkspace } from "./vazby-workspace";

import { canViewRvpManagement } from "../data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const selectClass =
  "h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20";

function parseOne(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function buildHref(overrides: Record<string, string | null>, current: { svp: string; q: string }) {
  const params = new URLSearchParams();
  if (current.svp) params.set("svp", current.svp);
  if (current.q) params.set("q", current.q);
  Object.entries(overrides).forEach(([key, value]) => {
    if (!value) params.delete(key);
    else params.set(key, value);
  });
  const query = params.toString();
  return query ? `/portal/lodicky/sprava/vazby?${query}` : "/portal/lodicky/sprava/vazby";
}

function formatDate(value: Date | null) {
  if (!value) return "bez konce";
  return value.toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function CountTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[8px] border border-[#D6DFF0] bg-white p-3">
      <p className="text-xs font-semibold text-[#4A5A7C]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#0E2A5C]">{value}</p>
    </div>
  );
}

export default async function RvpVazbyPage({ searchParams }: PageProps) {
  const session = await auth();
  const selectedDevUser = isLocalDevAuthBypass() ? await getSelectedDevAuthUser() : null;

  if (!session?.user?.email && !selectedDevUser && !isLocalDevAuthBypass()) {
    redirect("/auth/signin?callbackUrl=/portal/lodicky/sprava/vazby");
  }

  const roles = selectedDevUser?.roles ?? (session ? collectSessionRoles(session) : LOCAL_DEV_ROLES);
  if (!canViewRvpManagement(roles)) {
    redirect("/portal/lodicky");
  }

  const rawSearchParams = await searchParams;
  const selectedSvpId = parseOne(rawSearchParams.svp).trim();
  const q = parseOne(rawSearchParams.q).trim();
  const page = await getRvpGraphOverview({ svpVersionId: selectedSvpId, q, limit: 1000 });
  const selectedSvp = page.selectedSvp;
  const current = { svp: selectedSvp?.id ?? "", q };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="sv-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="sv-eyebrow text-[#C8372D]">RVP vazby</p>
              <h1 className="sv-display-sm text-[#0E2A5C]">Lodičky, OVU a RVP kontext</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Potvrzené katalogové vazby jsou oddělené od širšího grafu RVP. Ten ukazuje, kde OVU leží a jaký kontext bude možné použít pro pozdější návrhy vazeb.
              </p>
            </div>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EEF2F7] text-[#0E2A5C]">
              <Network className="size-5" aria-hidden={true} />
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/lodicky/sprava">
                <ArrowLeft className="size-4" aria-hidden={true} />
                Zpět na správu
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/lodicky/sprava/rvp">
                <BookOpen className="size-4" aria-hidden={true} />
                Správa RVP
              </Link>
            </Button>
          </div>
        </div>

        <div className="sv-card border-[#0E2A5C] bg-[#0E2A5C] p-6 text-white">
          <p className="sv-eyebrow text-white/70">Vybraná sada</p>
          <p className="mt-2 text-2xl font-semibold">{selectedSvp?.label ?? "nenalezena"}</p>
          <p className="mt-2 text-xs text-white/75">
            RVP {selectedSvp?.rvpDatasetVersion ?? "-"} · {selectedSvp?.rvpSourceFormat ?? "-"}
          </p>
          <p className="mt-1 text-xs text-white/75">
            Platnost: {formatDate(selectedSvp?.effectiveFrom ?? null)} až {formatDate(selectedSvp?.effectiveTo ?? null)}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-[12px] border border-[#D6DFF0] bg-white p-2">
        <Button asChild variant="outline">
          <Link href="/portal/lodicky/sprava">
            <Sailboat className="size-4" aria-hidden={true} />
            Správa sady lodiček
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/portal/lodicky/sprava/rvp">
            <BookOpen className="size-4" aria-hidden={true} />
            Správa RVP
          </Link>
        </Button>
        <Button asChild>
          <Link href={buildHref({}, current)}>
            <Network className="size-4" aria-hidden={true} />
            Vazby RVP
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtr vazeb</CardTitle>
          <CardDescription>Výběr sady určuje potvrzené lodičkové vazby, RVP graf se bere z navázané RVP verze.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/portal/lodicky/sprava/vazby" className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_minmax(16rem,1fr)_auto]">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">Sada lodiček</span>
              <select name="svp" defaultValue={selectedSvp?.id ?? ""} className={selectClass}>
                {page.svpOptions.map((svp) => (
                  <option key={svp.id} value={svp.id}>
                    {svp.label} · RVP {svp.rvpDatasetVersion}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">Hledat</span>
              <Input name="q" defaultValue={q} placeholder="Lodička, OVU, oblast..." />
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit">
                <Search className="size-4" aria-hidden={true} />
                Filtrovat
              </Button>
              <Button asChild variant="outline">
                <Link href="/portal/lodicky/sprava/vazby">Vymazat</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-5">
        <CountTile label="Lodičky v sadě" value={selectedSvp?.lodickyCount ?? 0} />
        <CountTile label="Potvrzené vazby" value={page.counts.confirmedLinks} />
        <CountTile label="Lodičky s OVU" value={page.counts.linkedLodicky} />
        <CountTile label="RVP uzly" value={page.counts.graphNodes} />
        <CountTile label="RVP hrany" value={page.counts.graphEdges} />
      </div>


      <VazbyWorkspace page={page} />
    </div>
  );
}
