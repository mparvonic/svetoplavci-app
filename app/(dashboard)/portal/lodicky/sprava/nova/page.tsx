import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, ShieldCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auth } from "@/src/lib/auth";
import { collectSessionRoles, isLocalDevAuthBypass, LOCAL_DEV_ROLES } from "@/src/lib/api/session";
import { getSelectedDevAuthUser } from "@/src/lib/dev-auth";

import { createLodickaManagementAction } from "../actions";
import { canManageWholeFleet, getLodickyCreatePage } from "../data";
import { LodickaAssignmentFields } from "../lodicka-assignment-fields";
import { LodickaClassificationFields } from "../lodicka-classification-fields";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseOne(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function statusMessage(searchParams: Record<string, string | string[] | undefined>) {
  const error = Array.isArray(searchParams.error) ? searchParams.error[0] : searchParams.error;
  if (!error) return null;

  const textByCode: Record<string, string> = {
    invalid: "Zkontrolujte název, stupeň a rozsah ročníků.",
    "invalid-grade-range": "Rozsah ročníků neodpovídá zvolenému stupni.",
    "invalid-classification": "Vybrané zařazení nepatří do stejné sady nebo na sebe nenavazuje.",
    "invalid-ovu": "Vybrané OVU nepatří do RVP verze této sady.",
    "invalid-spravce": "Vybraný správce lodiček není platný.",
    "invalid-garant": "Vybraný garant není platný.",
    "not-allowed": "Nové lodičky může zakládat jen správce flotily.",
  };

  return {
    tone: "error" as const,
    text: textByCode[error] ?? "Lodičku se nepodařilo založit.",
  };
}

export default async function NovaLodickaPage({ searchParams }: PageProps) {
  const rawSearchParams = await searchParams;
  const session = await auth();
  const selectedDevUser = isLocalDevAuthBypass() ? await getSelectedDevAuthUser() : null;

  if (!session?.user?.email && !selectedDevUser && !isLocalDevAuthBypass()) {
    redirect("/auth/signin?callbackUrl=/portal/lodicky/sprava/nova");
  }

  const roles = selectedDevUser?.roles ?? (session ? collectSessionRoles(session) : LOCAL_DEV_ROLES);
  if (!canManageWholeFleet(roles)) {
    redirect("/portal/lodicky/sprava");
  }

  const page = await getLodickyCreatePage({
    svpVersionId: parseOne(rawSearchParams.svp).trim(),
  });
  const message = statusMessage(rawSearchParams);
  const listHref = `/portal/lodicky/sprava${page.selectedSvp ? `?svp=${encodeURIComponent(page.selectedSvp.id)}` : ""}`;
  const returnTo = `/portal/lodicky/sprava/nova${page.selectedSvp ? `?svp=${encodeURIComponent(page.selectedSvp.id)}` : ""}`;

  return (
    <div className="space-y-6">
      <section className="sv-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="sv-eyebrow text-[#C8372D]">Správa lodiček</p>
            <h1 className="sv-display-sm text-[#0E2A5C]">Nová lodička</h1>
            <div className="flex flex-wrap gap-2 text-sm text-[#4A5A7C]">
              <Badge variant="outline">{page.selectedSvp?.label ?? "bez sady"}</Badge>
              <Badge variant="secondary">RVP {page.selectedSvp?.rvpDatasetVersion ?? "-"}</Badge>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Nová lodička vznikne v katalogu vybrané sady. Do osobních sad žáků se nepromítá automaticky.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={listHref}>
              <ArrowLeft className="size-4" aria-hidden={true} />
              Zpět na katalog
            </Link>
          </Button>
        </div>
      </section>

      {message && (
        <div className="flex items-center gap-2 rounded-[12px] border border-[#F2C7C1] bg-[#FFF4F2] px-4 py-3 text-sm text-[#9A231A]">
          <TriangleAlert className="size-4" aria-hidden={true} />
          {message.text}
        </div>
      )}

      {!page.selectedSvp || !page.defaults ? (
        <Card>
          <CardHeader>
            <CardTitle>Nelze založit lodičku</CardTitle>
            <CardDescription>Vybraná sada nemá připravenou taxonomii předmětů a oblastí.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/portal/lodicky/sprava">Vrátit se na správu</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <form action={createLodickaManagementAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <input type="hidden" name="svpVersionId" value={page.selectedSvp.id} />
          <input type="hidden" name="returnTo" value={returnTo} />

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Základní údaje</CardTitle>
                <CardDescription>Název a popis katalogové lodičky.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-[#4A5A7C]">Název</span>
                  <Input name="nazev" required />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-[#4A5A7C]">Popis</span>
                  <textarea
                    name="popis"
                    rows={6}
                    className="w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 py-2 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
                  />
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Zařazení v sadě</CardTitle>
                <CardDescription>Sada → stupeň/ročník → předmět → podpředmět → oblast.</CardDescription>
              </CardHeader>
              <CardContent>
                <LodickaClassificationFields
                  canEditFleetFields={true}
                  initialStupen={page.defaults.stupen}
                  initialRocnikOd={page.defaults.rocnikOd}
                  initialRocnikDo={page.defaults.rocnikDo}
                  initialPredmetId={page.defaults.predmetId}
                  initialPodpredmetId={page.defaults.podpredmetId}
                  initialOblastId={page.defaults.oblastId}
                  predmetOptions={page.predmetOptions}
                  podpredmetOptions={page.podpredmetOptions}
                  oblastOptions={page.oblastOptions}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>RVP / OVU</CardTitle>
                <CardDescription>Vazby na RVP {page.selectedSvp.rvpDatasetVersion}.</CardDescription>
              </CardHeader>
              <CardContent>
                <LodickaAssignmentFields
                  canEditFleetFields={true}
                  ovuOptions={page.ovuOptions}
                  initialOvuIds={[]}
                  initialOvuNotApplicable={false}
                  initialStupen={page.defaults.stupen}
                  spravceOptions={page.spravceOptions}
                  initialSpravceIds={[]}
                  garantOptions={page.garantOptions}
                  initialGarantIds={[]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Oprávnění</CardTitle>
                    <CardDescription>Správci lodičky a garant zápisu stavu.</CardDescription>
                  </div>
                  <ShieldCheck className="size-5 text-[#0E2A5C]" aria-hidden={true} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[#4A5A7C]">
                  Správce i garant se nastavují vyhledáváním v kartě RVP / OVU nad touto kartou.
                </p>

                <div className="grid gap-2">
                  <Button type="submit" className="w-full">
                    <CheckCircle2 className="size-4" aria-hidden={true} />
                    Založit lodičku
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={listHref}>Storno změn</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      )}
    </div>
  );
}
