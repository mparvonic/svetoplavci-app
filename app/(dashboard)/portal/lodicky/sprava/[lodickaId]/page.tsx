import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, ShieldCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auth } from "@/src/lib/auth";
import { collectSessionRoles, isLocalDevAuthBypass, LOCAL_DEV_ROLES } from "@/src/lib/api/session";
import { getSelectedDevAuthUser } from "@/src/lib/dev-auth";
import { getApprovedLoginProfileByEmail } from "@/src/lib/user-directory";

import { updateLodickaManagementAction } from "../actions";
import { canManageWholeFleet, canViewLodickyManagement, getLodickyManagementDetailPage } from "../data";
import { LodickaAssignmentFields } from "../lodicka-assignment-fields";
import { LodickaClassificationFields } from "../lodicka-classification-fields";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ lodickaId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatStupen(value: string) {
  if (value === "I_STUPEN") return "I. stupeň";
  if (value === "II_STUPEN") return "II. stupeň";
  return value;
}

function queryWithoutStatus(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === "saved" || key === "error") return;
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value) params.set(key, value);
  });
  return params.toString();
}

function statusMessage(searchParams: Record<string, string | string[] | undefined>) {
  const saved = Array.isArray(searchParams.saved) ? searchParams.saved[0] : searchParams.saved;
  const error = Array.isArray(searchParams.error) ? searchParams.error[0] : searchParams.error;

  if (saved === "1") {
    return {
      tone: "success" as const,
      text: "Lodička byla uložena.",
    };
  }

  if (!error) return null;

  const textByCode: Record<string, string> = {
    invalid: "Zkontrolujte název a rozsah ročníků.",
    "invalid-grade-range": "Rozsah ročníků neodpovídá zvolenému stupni.",
    "invalid-ovu": "Vybrané OVU nepatří do RVP verze této sady.",
    "invalid-spravce": "Vybraný správce lodiček není platný.",
    "invalid-garant": "Vybraný garant není platný.",
    "invalid-classification": "Vybrané zařazení nepatří do stejné sady nebo na sebe nenavazuje.",
    "not-allowed": "K této lodičce nemáte oprávnění.",
  };

  return {
    tone: "error" as const,
    text: textByCode[error] ?? "Změny se nepodařilo uložit.",
  };
}

export default async function LodickaSpravaDetailPage({ params, searchParams }: PageProps) {
  const { lodickaId } = await params;
  const rawSearchParams = await searchParams;
  const selectedDevUser = isLocalDevAuthBypass() ? await getSelectedDevAuthUser() : null;
  const session = selectedDevUser ? null : await auth();

  if (!session?.user?.email && !selectedDevUser && !isLocalDevAuthBypass()) {
    redirect(`/auth/signin?callbackUrl=/portal/lodicky/sprava/${encodeURIComponent(lodickaId)}`);
  }

  const roles = selectedDevUser?.roles ?? (session ? collectSessionRoles(session) : LOCAL_DEV_ROLES);
  if (!canViewLodickyManagement(roles)) {
    redirect("/portal/lodicky");
  }

  let profile: Awaited<ReturnType<typeof getApprovedLoginProfileByEmail>> = null;
  if (session?.user?.email) {
    try {
      profile = await getApprovedLoginProfileByEmail(session.user.email);
    } catch (error) {
      console.error("[lodicky/sprava/detail] failed to load login profile; continuing without profile scope", error);
    }
  }
  const personIds =
    selectedDevUser?.personId && !selectedDevUser.personId.startsWith("local-dev-")
      ? [selectedDevUser.personId]
      : profile?.personIds ?? [];
  const sourceTab = Array.isArray(rawSearchParams.tab) ? rawSearchParams.tab[0] : rawSearchParams.tab;
  const openedFromList = sourceTab === "seznam";

  let page: Awaited<ReturnType<typeof getLodickyManagementDetailPage>>;
  try {
    page = await getLodickyManagementDetailPage({
      lodickaId,
      access: {
        roles,
        personIds,
      },
      basicOnly: openedFromList,
    });
  } catch (error) {
    console.error("[lodicky/sprava/detail] failed to load lodička detail data", error);
    const listQuery = queryWithoutStatus(rawSearchParams);
    const listHref = `/portal/lodicky/sprava${listQuery ? `?${listQuery}` : ""}`;

    return (
      <div className="space-y-6">
        <section className="sv-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="sv-eyebrow text-[#C8372D]">Správa lodiček</p>
              <h1 className="sv-display-sm text-[#0E2A5C]">Detail lodičky</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Detail je připravený, ale teď se nepodařilo načíst data z vývojové databáze.
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

        <Card>
          <CardHeader>
            <CardTitle>Databáze není dostupná</CardTitle>
            <CardDescription>
              Preview server běží, ale spojení na vývojovou databázi se při načítání detailu přerušilo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[#4A5A7C]">
            <p>
              Zkuste stránku obnovit. Pokud se to bude opakovat, je potřeba zkontrolovat dev Postgres,
              protože aplikace dostala chybu spojení místo dat.
            </p>
            <p className="font-semibold text-[#C8372D]">
              Chyba je zachycená, takže stránka nespadne do Next error overlay.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!page.lodicka) notFound();

  const message = statusMessage(rawSearchParams);
  const listQuery = queryWithoutStatus(rawSearchParams);
  const listHref = `/portal/lodicky/sprava${listQuery ? `?${listQuery}` : ""}`;
  const returnTo = `/portal/lodicky/sprava/${page.lodicka.id}${listQuery ? `?${listQuery}` : ""}`;
  const wholeFleet = canManageWholeFleet(roles);
  const canEditFleetFields = page.canEditFleetFields && !openedFromList;
  const canEditBasicFields = page.canEditBasicFields || (wholeFleet && openedFromList);
  const readOnly = !canEditBasicFields;
  const needsDraftForFleetEdit = wholeFleet && !openedFromList && !canEditFleetFields;

  return (
    <div className="space-y-6">
      <section className="sv-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="sv-eyebrow text-[#C8372D]">Správa lodiček</p>
            <h1 className="sv-display-sm text-[#0E2A5C]">{page.lodicka.nazev}</h1>
            <div className="flex flex-wrap gap-2 text-sm text-[#4A5A7C]">
              <Badge variant="outline">{page.lodicka.kod}</Badge>
              <Badge variant="secondary">{formatStupen(page.lodicka.stupen)}</Badge>
              <Badge variant="secondary">{page.lodicka.rocnikOd}.–{page.lodicka.rocnikDo}. ročník</Badge>
              <Badge variant="outline">{page.lodicka.svpLabel}</Badge>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {page.lodicka.predmet}
              {page.lodicka.podpredmet ? ` · ${page.lodicka.podpredmet}` : ""} · {page.lodicka.oblast}
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
        <div
          className={
            message.tone === "success"
              ? "flex items-center gap-2 rounded-[12px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
              : "flex items-center gap-2 rounded-[12px] border border-[#F2C7C1] bg-[#FFF4F2] px-4 py-3 text-sm text-[#9A231A]"
          }
        >
          {message.tone === "success" ? (
            <CheckCircle2 className="size-4" aria-hidden={true} />
          ) : (
            <TriangleAlert className="size-4" aria-hidden={true} />
          )}
          {message.text}
        </div>
      )}

      <form action={updateLodickaManagementAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <input type="hidden" name="lodickaId" value={page.lodicka.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {openedFromList && <input type="hidden" name="editMode" value="basic" />}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Základní údaje</CardTitle>
              <CardDescription>Název a popis katalogové lodičky.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Název</span>
                <Input name="nazev" defaultValue={page.lodicka.nazev} required disabled={readOnly} />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Popis</span>
                <textarea
                  name="popis"
                  defaultValue={page.lodicka.popis ?? ""}
                  rows={6}
                  disabled={readOnly}
                  className="w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 py-2 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20 disabled:bg-[#EEF2F7] disabled:text-[#7F88A0]"
                />
              </label>

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zařazení v sadě</CardTitle>
              <CardDescription>Stupeň určuje dostupné ročníky i nabídku předmětů, podpředmětů a oblastí.</CardDescription>
            </CardHeader>
            <CardContent>
              {canEditFleetFields ? (
                <LodickaClassificationFields
                  canEditFleetFields={canEditFleetFields}
                  initialStupen={page.lodicka.stupen}
                  initialRocnikOd={page.lodicka.rocnikOd}
                  initialRocnikDo={page.lodicka.rocnikDo}
                  initialPredmetId={page.lodicka.predmetId}
                  initialPodpredmetId={page.lodicka.podpredmetId}
                  initialOblastId={page.lodicka.oblastId}
                  predmetOptions={page.predmetOptions}
                  podpredmetOptions={page.podpredmetOptions}
                  oblastOptions={page.oblastOptions}
                />
              ) : (
                <div className="grid gap-3 text-sm text-[#4A5A7C] md:grid-cols-2">
                  <div><span className="font-semibold text-[#0E2A5C]">Stupeň:</span> {formatStupen(page.lodicka.stupen)}</div>
                  <div><span className="font-semibold text-[#0E2A5C]">Ročníky:</span> {page.lodicka.rocnikOd}.–{page.lodicka.rocnikDo}.</div>
                  <div><span className="font-semibold text-[#0E2A5C]">Předmět:</span> {page.lodicka.predmet}</div>
                  <div><span className="font-semibold text-[#0E2A5C]">Podpředmět:</span> {page.lodicka.podpredmet ?? "bez podpředmětu"}</div>
                  <div className="md:col-span-2"><span className="font-semibold text-[#0E2A5C]">Oblast:</span> {page.lodicka.oblast}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>RVP / OVU</CardTitle>
              <CardDescription>
                Vazby na RVP {page.lodicka.rvpDatasetVersion} pro sadu {page.lodicka.svpLabel}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canEditFleetFields ? (
                <LodickaAssignmentFields
                  canEditFleetFields={canEditFleetFields}
                  ovuOptions={page.ovuOptions}
                  initialOvuIds={page.lodicka.ovuIds}
                  initialOvuNotApplicable={page.lodicka.ovuNotApplicable}
                  initialStupen={page.lodicka.stupen}
                  spravceOptions={page.spravceOptions}
                  initialSpravceIds={page.lodicka.spravcePersonIds}
                  garantOptions={page.garantOptions}
                  initialGarantIds={page.lodicka.garantPersonIds}
                />
              ) : page.lodicka.ovuNotApplicable ? (
                <div className="flex items-start gap-2 rounded-[12px] border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden={true} />
                  <span>
                    <span className="block font-semibold">OVU je vědomě označené jako nerelevantní.</span>
                    <span className="block text-xs">Tento stav se nepočítá mezi chybějící OVU vazby.</span>
                  </span>
                </div>
              ) : page.ovuOptions.length > 0 ? (
                <div className="space-y-2">
                  {page.ovuOptions.map((ovu) => (
                    <div key={ovu.id} className="rounded-[12px] border border-[#D6DFF0] bg-[#EEF2F7] p-3 text-sm text-slate-700">
                      <span className="block font-semibold text-[#0E2A5C]">{ovu.kod}</span>
                      {ovu.uzlovyBod && <span className="block text-xs text-slate-500">{ovu.uzlovyBod}</span>}
                      {ovu.uzlovyBodStupen || ovu.uzlovyBodRocnik ? (
                        <span className="block text-xs text-slate-500">
                          {[ovu.uzlovyBodStupen, ovu.uzlovyBodRocnik ? `${ovu.uzlovyBodRocnik}. ročník` : null].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs">{ovu.zneni}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-[12px] border border-[#F2C7C1] bg-[#FFF4F2] px-3 py-2 text-sm text-[#9A231A]">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden={true} />
                  <span>
                    <span className="block font-semibold">Chybí OVU vazba.</span>
                    <span className="block text-xs">Lodička nemá přiřazené OVU ani výjimku.</span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Oprávnění</CardTitle>
                  <CardDescription>
                    {canEditFleetFields
                      ? "Správci lodičky a garant zápisu stavu."
                      : wholeFleet && openedFromList
                        ? "Ze seznamu lodiček upravujete jen název a popis bez vytváření pracovní verze."
                      : needsDraftForFleetEdit
                        ? "Tato lodička je v publikované sadě. Úpravy flotily probíhají v pracovní verzi."
                      : canEditBasicFields
                        ? "Jako správce lodiček můžete upravit název a popis."
                        : "Tuto lodičku máte jen pro čtení."}
                  </CardDescription>
                </div>
                <ShieldCheck className="size-5 text-[#0E2A5C]" aria-hidden={true} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {canEditFleetFields ? (
                <p className="text-sm text-[#4A5A7C]">
                  Správce i garant se nastavují vyhledáváním v kartě RVP / OVU nad touto kartou.
                </p>
              ) : wholeFleet && openedFromList ? (
                <p className="text-sm text-[#4A5A7C]">
                  Tady se ukládá jen název a popis lodičky. Ročníky, OVU, zařazení a osoby patří do strukturální editace sady.
                </p>
              ) : needsDraftForFleetEdit ? (
                <div className="space-y-3">
                  <p className="text-sm text-[#4A5A7C]">
                    Jako správce flotily máte oprávnění sadu upravovat, ale ne přímo v publikované verzi.
                    Otevřete pracovní kopii sady a úpravy proveďte tam.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-[#4A5A7C]">
                  {canEditBasicFields
                    ? "Můžete upravit název a popis lodičky. Ročníky, OVU, zařazení a osoby mění správce flotily v pracovní verzi."
                    : "Tato lodička je pro vás jen ke čtení."}
                </p>
              )}

              <div className="grid gap-2">
                {canEditBasicFields && (
                  <Button type="submit" className="w-full">
                    Uložit lodičku
                  </Button>
                )}
                <Button asChild variant="outline" className="w-full">
                  <a href={listHref}>{canEditBasicFields ? "Storno změn" : "Zpět na seznam"}</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
