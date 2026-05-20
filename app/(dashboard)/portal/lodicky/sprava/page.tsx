import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Anchor, BookOpen, CheckCircle2, Filter, Network, Plus, Sailboat, ShieldCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/src/lib/auth";
import {
  LOCAL_DEV_ROLES,
  collectSessionRoles,
  isLocalDevAuthBypass,
} from "@/src/lib/api/session";
import { DEV_AUTH_COOKIE_NAME, getSelectedDevAuthUser } from "@/src/lib/dev-auth";
import { getApprovedLoginProfileByEmail } from "@/src/lib/user-directory";

import {
  discardSvpVersionDraftAction,
  publishSvpVersionDraftAction,
  startNextSchoolYearSvpVersionAction,
  startSvpVersionEditAction,
  updateSvpVersionManagementAction,
} from "./actions";
import {
  canManageWholeFleet,
  canViewRvpManagement,
  canViewLodickyManagement,
  formatSvpVersionLabel,
  getLodickyManagementPage,
  hasLodickyManagerRole,
  parseLodickyManagementFilters,
} from "./data";
import { LodickyFilterForm } from "./lodicky-filter-form";
import { LodickyTableClient } from "./lodicky-table-client";
import { OblastSpravciManager } from "./oblast-spravci-manager";
import { SvpDraftCleanupBeacon } from "./svp-draft-cleanup-beacon";
import { TaxonomyManagementPanel } from "./taxonomy-management-panel";
import { PendingSubmitButton } from "./svp-version-pending-submit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const selectClass =
  "h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20";

function buildHref(overrides: Record<string, string | number | null>, current: Record<string, string | string[]>) {
  const params = new URLSearchParams();
  Object.entries(current).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else {
      params.set(key, value);
    }
  });
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === null || value === "") params.delete(key);
    else params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `/portal/lodicky/sprava?${query}` : "/portal/lodicky/sprava";
}

function queryString(params: Record<string, string | string[]>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => searchParams.append(key, item));
    else searchParams.set(key, value);
  });
  return searchParams.toString();
}

function CountCard({ title, value, description, tone = "default" }: {
  title: string;
  value: number | string;
  description: string;
  tone?: "default" | "danger" | "success";
}) {
  const valueClass = tone === "danger"
    ? "text-3xl font-semibold text-[#C8372D]"
    : tone === "success"
      ? "text-3xl font-semibold text-green-700"
      : "text-3xl font-semibold text-[#0E2A5C]";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className={valueClass}>{value}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(value: Date | null) {
  if (!value) return "bez konce";
  return value.toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function dateInputValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function statusMessage(searchParams: Record<string, string | string[] | undefined>) {
  const saved = Array.isArray(searchParams.saved) ? searchParams.saved[0] : searchParams.saved;
  const error = Array.isArray(searchParams.error) ? searchParams.error[0] : searchParams.error;

  if (saved === "svp") return { tone: "success" as const, text: "Sada lodiček byla uložena." };
  if (saved === "bulk") return { tone: "success" as const, text: "Hromadné změny lodiček byly uloženy." };
  if (saved === "oblast-spravci") return { tone: "success" as const, text: "Správci oblasti byli uloženi." };
  if (saved === "taxonomy") return { tone: "success" as const, text: "Předměty a oblasti byly uloženy." };
  if (saved === "draft") return { tone: "success" as const, text: "Pracovní verze sady byla otevřena." };
  if (saved === "major-draft") return { tone: "success" as const, text: "Pracovní verze nové školní verze byla otevřena." };
  if (saved === "draft-opened") return { tone: "success" as const, text: "Pokračujete v rozpracované pracovní verzi." };
  if (saved === "draft-discarded") return { tone: "success" as const, text: "Pracovní verze byla zahozená." };
  if (saved === "published") return { tone: "success" as const, text: "Pracovní verze byla publikovaná jako nová verze sady." };
  if (!error) return null;

  const textByCode: Record<string, string> = {
    "invalid-svp": "Zkontrolujte název a platnost sady.",
    "invalid-rvp": "Vybraná RVP verze neexistuje.",
    "duplicate-svp-label": "Sada s tímto názvem už existuje.",
    "rvp-ovu-conflict": "RVP vazbu nejde změnit, protože sada obsahuje OVU vazby z jiné RVP verze.",
    "invalid-bulk-selection": "Vyberte platné lodičky pro hromadnou úpravu.",
    "invalid-bulk-action": "Vyberte alespoň jednu hromadnou změnu.",
    "invalid-grade-range": "Vybraný rozsah ročníků neodpovídá stupni.",
    "invalid-classification": "Vybrané zařazení lodiček není platné.",
    "invalid-spravce": "Vybraný správce lodiček není platný.",
    "invalid-garant": "Vybraný garant není platný.",
    "invalid-oblast-spravci": "Vybraná oblast nebo správci nejsou platní.",
    "invalid-taxonomy": "Zkontrolujte údaje předmětu, podpředmětu nebo oblasti.",
    "duplicate-taxonomy": "Položka se stejným názvem nebo kódem už v sadě existuje.",
    "draft-required": "Strukturální úpravy sady je potřeba dělat v pracovní verzi.",
    "confirm-required": "Před publikací změnu potvrďte.",
    "self-spravce-remove": "Sám sebe ze správců lodiček odebrat nemůžete.",
    "not-allowed": "K úpravě sady nemáte oprávnění.",
  };

  return { tone: "error" as const, text: textByCode[error] ?? "Změny se nepodařilo uložit." };
}

function SvpVersionWorkflowCard({
  selectedSvp,
  rvpVersions,
  draftChangeSummary,
  versionHistory,
  wholeFleet,
  currentParams,
}: {
  selectedSvp: Awaited<ReturnType<typeof getLodickyManagementPage>>["selectedSvp"];
  rvpVersions: Awaited<ReturnType<typeof getLodickyManagementPage>>["rvpVersions"];
  draftChangeSummary: Awaited<ReturnType<typeof getLodickyManagementPage>>["draftChangeSummary"];
  versionHistory: Awaited<ReturnType<typeof getLodickyManagementPage>>["versionHistory"];
  wholeFleet: boolean;
  currentParams: Record<string, string | string[]>;
}) {
  if (!selectedSvp) return null;

  const isDraft = selectedSvp.status === "DRAFT" && Boolean(selectedSvp.parentSvpVersionId);
  const isMajorDraft = isDraft && selectedSvp.zmenaType === "MAJOR";
  const versionLabel = formatSvpVersionLabel(selectedSvp);
  const returnTo = buildHref({ tab: "struktura", svp: selectedSvp.id }, currentParams);
  const changeTone = draftChangeSummary?.type === "minor"
    ? "border-[#F2C7C1] bg-[#FFF4F2] text-[#9A231A]"
    : "border-green-200 bg-green-50 text-green-800";

  return (
    <Card className={isDraft ? "border-[#C8372D]" : ""}>
      {isDraft && <SvpDraftCleanupBeacon svpVersionId={selectedSvp.id} />}
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Správa sady lodiček</CardTitle>
            <CardDescription>
              Strukturální změny probíhají v pracovní verzi. Publikace určí, zda jde o dílčí verzi nebo drobnou změnu.
            </CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={isDraft ? "destructive" : selectedSvp.isCurrent ? "default" : "outline"}>
              {isDraft ? "pracovní verze" : selectedSvp.isCurrent ? "aktuální" : selectedSvp.status}
            </Badge>
            <Badge variant="outline">Verze {versionLabel}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm text-[#4A5A7C] md:grid-cols-4">
          <div><span className="font-semibold text-[#0E2A5C]">Sada:</span><br />{selectedSvp.label}</div>
          <div><span className="font-semibold text-[#0E2A5C]">RVP:</span><br />{selectedSvp.rvpDatasetVersion}</div>
          <div><span className="font-semibold text-[#0E2A5C]">Platí od:</span><br />{formatDate(selectedSvp.effectiveFrom)}</div>
          <div><span className="font-semibold text-[#0E2A5C]">Rozsah:</span><br />{selectedSvp.predmetCount} předmětů · {selectedSvp.oblastCount} oblastí</div>
        </div>

        {wholeFleet && !isDraft && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#D6DFF0] bg-[#F8FAFD] p-4">
            <p className="max-w-2xl text-sm text-[#4A5A7C]">
              Pro změny v sadě otevřete pracovní verzi. Původní sada zůstane beze změny až do publikace.
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={startSvpVersionEditAction}>
                <input type="hidden" name="svpVersionId" value={selectedSvp.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <PendingSubmitButton variant="outline" message="Vytvářím pracovní kopii sady lodiček…">
                  Upravit sadu
                </PendingSubmitButton>
              </form>
              <form action={startNextSchoolYearSvpVersionAction}>
                <input type="hidden" name="svpVersionId" value={selectedSvp.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <PendingSubmitButton message="Vytvářím novou školní verzi sady lodiček…">
                  Nová školní verze
                </PendingSubmitButton>
              </form>
            </div>
          </div>
        )}

        {wholeFleet && isDraft && (
          <div className="space-y-4">
            <div className={`rounded-[12px] border p-4 ${changeTone}`}>
              <p className="text-sm font-semibold">
                {isMajorDraft ? "Nová školní verze" : draftChangeSummary?.type === "minor" ? "Dílčí verze" : "Drobná změna"} {isMajorDraft ? `· ${versionLabel}` : draftChangeSummary?.label ? `· ${draftChangeSummary.label}` : ""}
              </p>
              <p className="mt-1 text-sm">
                Platnost změn bude od {formatDate(isMajorDraft ? selectedSvp.effectiveFrom : draftChangeSummary?.effectiveFrom ?? selectedSvp.effectiveFrom)}.
                {isMajorDraft
                  ? " Nová hlavní verze může vzniknout pouze k 1. 9. následujícího školního roku."
                  : draftChangeSummary?.type === "minor"
                  ? " Mění se počet lodiček v alespoň jednom předmětu, takže změna ovlivní přepočet vysvědčení."
                  : " Počty lodiček v předmětech zůstávají stejné."}
              </p>
              {draftChangeSummary?.subjectChanges.length ? (
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                  {draftChangeSummary.subjectChanges.slice(0, 6).map((change) => (
                    <div key={change.subjectKey} className="rounded-[10px] bg-white/70 px-3 py-2">
                      <span className="font-semibold">{change.subjectName}</span>: {change.beforeCount} → {change.afterCount}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <form action={updateSvpVersionManagementAction} className="grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1fr)_minmax(16rem,2fr)_auto]">
              <input type="hidden" name="svpVersionId" value={selectedSvp.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="effectiveFrom" value={dateInputValue(selectedSvp.effectiveFrom)} />
              <input type="hidden" name="effectiveTo" value={dateInputValue(selectedSvp.effectiveTo)} />
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Název sady</span>
                <Input name="label" defaultValue={selectedSvp.label} required />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">RVP verze</span>
                <select name="basedOnRvpVersionId" defaultValue={selectedSvp.basedOnRvpVersionId} className={selectClass}>
                  {rvpVersions.map((rvp) => (
                    <option key={rvp.id} value={rvp.id}>{rvp.datasetVersion} · {rvp.sourceFormat}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#4A5A7C]">Poznámka</span>
                <Input name="notes" defaultValue={selectedSvp.notes ?? ""} />
              </label>
              <div className="flex items-end">
                <Button type="submit" variant="outline">Uložit metadata</Button>
              </div>
            </form>

            <div className="flex flex-wrap justify-end gap-2">
              <form action={discardSvpVersionDraftAction}>
                <input type="hidden" name="svpVersionId" value={selectedSvp.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <PendingSubmitButton variant="outline" message="Zahazuji pracovní verzi…">
                  Zahodit pracovní verzi
                </PendingSubmitButton>
              </form>
              <form action={publishSvpVersionDraftAction} className="flex flex-wrap items-center justify-end gap-3">
                <input type="hidden" name="svpVersionId" value={selectedSvp.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <label className="flex items-center gap-2 text-sm text-[#4A5A7C]">
                  <input type="checkbox" name="confirmVersionChange" value="1" className="size-4" />
                  Potvrzuji publikaci změn
                </label>
                <PendingSubmitButton message="Publikuji novou verzi sady lodiček…">
                  Publikovat verzi
                </PendingSubmitButton>
              </form>
            </div>
          </div>
        )}

        {versionHistory.length > 0 && (
          <div className="rounded-[12px] border border-[#E2E8F3] p-4">
            <p className="text-sm font-semibold text-[#0E2A5C]">Historie změn</p>
            <div className="mt-3 grid gap-2 text-sm text-[#4A5A7C]">
              {versionHistory.slice(0, 5).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF2F7] pt-2 first:border-t-0 first:pt-0">
                  <span>Verze {item.versionLabel} · {item.changeType === "MINOR" ? "dílčí verze" : "drobná změna"}</span>
                  <span>{formatDate(item.effectiveFrom)} · {item.changedByName ?? "systém"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function LodickySpravaPage({ searchParams }: PageProps) {
  const hasDevSelectionCookie = isLocalDevAuthBypass()
    ? Boolean((await cookies()).get(DEV_AUTH_COOKIE_NAME)?.value)
    : false;
  const selectedDevUser = hasDevSelectionCookie ? await getSelectedDevAuthUser() : null;
  const session = selectedDevUser ? null : await auth();

  if (!session?.user?.email && !selectedDevUser && !isLocalDevAuthBypass()) {
    redirect("/auth/signin?callbackUrl=/portal/lodicky/sprava");
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
      console.error("[lodicky/sprava] failed to load login profile; continuing without profile scope", error);
    }
  }
  const personIds = selectedDevUser?.personId && !selectedDevUser.personId.startsWith("local-dev-")
    ? [selectedDevUser.personId]
    : profile?.personIds ?? [];
  const rawSearchParams = await searchParams;
  const filters = parseLodickyManagementFilters(rawSearchParams);
  const rawTab = Array.isArray(rawSearchParams.tab) ? rawSearchParams.tab[0] : rawSearchParams.tab;
  const canViewRvp = canViewRvpManagement(roles);
  const activeTab = rawTab === "rvp" && !canViewRvp
    ? "struktura"
    : rawTab === "seznam" || rawTab === "pristup" || rawTab === "rvp"
    ? rawTab
    : "struktura";
  const wholeFleet = canManageWholeFleet(roles);
  const isBoatManager = hasLodickyManagerRole(roles);
  let page: Awaited<ReturnType<typeof getLodickyManagementPage>>;
  try {
    page = await getLodickyManagementPage({
      filters,
      access: {
        roles,
        personIds,
      },
      view: activeTab,
    });
  } catch (error) {
    console.error("[lodicky/sprava] failed to load management data", error);
    return (
      <div className="space-y-6">
        <section className="sv-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="sv-eyebrow text-[#C8372D]">Správa lodiček</p>
              <h1 className="sv-display-sm text-[#0E2A5C]">Sady lodiček a RVP vazby</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Správa je připravená, ale teď se nepodařilo načíst data z vývojové databáze.
              </p>
            </div>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EEF2F7] text-[#0E2A5C]">
              <Sailboat className="size-5" aria-hidden={true} />
            </span>
          </div>
        </section>
        <div className="flex flex-wrap gap-2 rounded-[12px] border border-[#D6DFF0] bg-white p-2">
          <Button asChild>
            <Link href="/portal/lodicky/sprava">
              <Sailboat className="size-4" aria-hidden={true} />
              Správa sady lodiček
            </Link>
          </Button>
          {canViewRvp ? (
            <>
              <Button asChild variant="outline">
                <Link href="/portal/lodicky/sprava/rvp">
                  <BookOpen className="size-4" aria-hidden={true} />
                  Správa RVP
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/portal/lodicky/sprava/vazby">
                  <Network className="size-4" aria-hidden={true} />
                  Vazby RVP
                </Link>
              </Button>
            </>
          ) : null}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Databáze není dostupná</CardTitle>
            <CardDescription>
              Preview server běží, ale aktuální DB connection string neumožnil načíst M01 data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[#4A5A7C]">
            <p>
              Jakmile bude v dev prostředí nastavené platné <span className="font-mono">POSTGRES_PRISMA_URL</span>,
              tahle stránka zobrazí správu sady, RVP vazby a katalog lodiček.
            </p>
            <p className="font-semibold text-[#C8372D]">
              Runtime chyba je zachycená, takže stránka už nespadne do Next error overlay.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  const selectedSvp = page.selectedSvp;
  const canEditSvpStructure = wholeFleet && selectedSvp?.status === "DRAFT" && Boolean(selectedSvp.parentSvpVersionId);
  const currentParams = {
    ...(filters.q ? { q: filters.q } : {}),
    ...(selectedSvp ? { svp: selectedSvp.id } : {}),
    ...(filters.scope ? { scope: filters.scope } : {}),
    ...(filters.predmetId ? { predmet: filters.predmetId } : {}),
    ...(filters.podpredmetId ? { podpredmet: filters.podpredmetId } : {}),
    ...(filters.oblastId ? { oblast: filters.oblastId } : {}),
    ...(filters.stupen ? { stupen: filters.stupen } : {}),
    ...(filters.rocnik ? { rocnik: String(filters.rocnik) } : {}),
    ...(filters.coverage ? { coverage: filters.coverage } : {}),
    ...(filters.page > 1 ? { page: String(filters.page) } : {}),
  };
  const message = statusMessage(rawSearchParams);
  const listScope = wholeFleet || filters.scope === "vse" || !isBoatManager ? "vse" : "moje";
  const detailQueryString = queryString({ ...currentParams, tab: "seznam", scope: listScope });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="sv-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="sv-eyebrow text-[#C8372D]">Správa lodiček</p>
              <h1 className="sv-display-sm text-[#0E2A5C]">Sady lodiček a RVP vazby</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Pracovní pohled nad sadou lodiček. Správce lodiček upravuje název a popis přidělených lodiček,
                správce flotily navíc spravuje celou sadu, její platnost, RVP a osoby.
              </p>
            </div>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EEF2F7] text-[#0E2A5C]">
              <Sailboat className="size-5" aria-hidden={true} />
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/lodicky">Zpět na lodičky</Link>
            </Button>
            {canViewRvp ? (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href="/portal/lodicky/sprava/rvp">
                    <BookOpen className="size-4" aria-hidden={true} />
                    Správa RVP
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/portal/lodicky/sprava/vazby">
                    <Network className="size-4" aria-hidden={true} />
                    Vazby RVP
                  </Link>
                </Button>
              </>
            ) : null}
            {canEditSvpStructure && selectedSvp && (
              <Button asChild size="sm">
                <Link href={`/portal/lodicky/sprava/nova?svp=${encodeURIComponent(selectedSvp.id)}`}>
                  <Plus className="size-4" aria-hidden={true} />
                  Nová lodička
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="sv-card border-[#0E2A5C] bg-[#0E2A5C] p-6 text-white">
          <p className="sv-eyebrow text-white/70">Rozsah</p>
          <p className="mt-2 text-2xl font-semibold">
            {wholeFleet ? "Celá flotila" : isBoatManager ? (listScope === "moje" ? "Moje lodičky" : "Všechny lodičky") : "Katalog pro čtení"}
          </p>
          <p className="mt-2 text-xs text-white/75">
            Sada: {selectedSvp?.label ?? "nenalezena"} · RVP {selectedSvp?.rvpDatasetVersion ?? "-"}
          </p>
          <p className="mt-1 text-xs text-white/75">
            Platnost: {formatDate(selectedSvp?.effectiveFrom ?? null)} až {formatDate(selectedSvp?.effectiveTo ?? null)}
          </p>
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

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="struktura" asChild>
            <Link href={buildHref({ tab: "struktura", page: null }, currentParams)}>
              <ShieldCheck className="mr-2 size-4" aria-hidden={true} />
              Struktura sady
            </Link>
          </TabsTrigger>
          <TabsTrigger value="seznam" asChild>
            <Link href={buildHref({ tab: "seznam", scope: listScope, page: null }, currentParams)}>
              <Sailboat className="mr-2 size-4" aria-hidden={true} />
              Seznam lodiček
            </Link>
          </TabsTrigger>
          <TabsTrigger value="pristup" asChild>
            <Link href={buildHref({ tab: "pristup", page: null }, currentParams)}>
              <ShieldCheck className="mr-2 size-4" aria-hidden={true} />
              Přístup k lodičkám
            </Link>
          </TabsTrigger>
          {canViewRvp ? (
            <>
              <TabsTrigger value="rvp" asChild>
                <Link href={buildHref({ tab: "rvp", page: null }, currentParams)}>
                  <BookOpen className="mr-2 size-4" aria-hidden={true} />
                  Správa RVP
                </Link>
              </TabsTrigger>
              <Button asChild variant="outline" size="sm" className="h-9 rounded-full">
                <Link href="/portal/lodicky/sprava/vazby">
                  <Network className="mr-2 size-4" aria-hidden={true} />
                  Vazby RVP
                </Link>
              </Button>
            </>
          ) : null}
        </TabsList>

        {activeTab === "struktura" && <TabsContent value="struktura" className="space-y-4">
          <SvpVersionWorkflowCard
            selectedSvp={selectedSvp}
            rvpVersions={page.rvpVersions}
            draftChangeSummary={page.draftChangeSummary}
            versionHistory={page.versionHistory}
            wholeFleet={wholeFleet}
            currentParams={{ ...currentParams, tab: "struktura" }}
          />

          {selectedSvp ? (
            <TaxonomyManagementPanel
              svpVersionId={selectedSvp.id}
              returnTo={buildHref({ tab: "struktura" }, currentParams)}
              predmetOptions={page.predmetOptions}
              podpredmetOptions={page.podpredmetOptions}
              oblastOptions={page.oblastOptions}
              lodickaOptions={page.lodickaOptions}
              ovuOptions={page.ovuOptions}
              spravceOptions={page.spravceOptions}
              garantOptions={page.garantOptions}
              canEdit={canEditSvpStructure}
            />
          ) : null}
        </TabsContent>}

        {activeTab === "seznam" && <TabsContent value="seznam" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <CountCard title="Lodičky" value={page.counts.total} description="V aktuálním zobrazení." />
            <CountCard title="Chybí OVU" value={page.counts.withoutOvu} description="Chyba: není vazba ani výjimka." tone={page.counts.withoutOvu > 0 ? "danger" : "default"} />
            <CountCard title="OVU nerelevantní" value={page.counts.ovuNotApplicable} description="OK: lodička vědomě nemá OVU." tone={page.counts.ovuNotApplicable > 0 ? "success" : "default"} />
            <CountCard title="Bez správce" value={page.counts.withoutSpravce} description="Chybí správce lodičky." tone={page.counts.withoutSpravce > 0 ? "danger" : "default"} />
            <CountCard title="Bez garanta" value={page.counts.withoutGarant} description="Chybí garant pro zápis stavu." tone={page.counts.withoutGarant > 0 ? "danger" : "default"} />
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Filtry</CardTitle>
                  <CardDescription>Hledání v pořadí sada → stupeň/ročník → předmět → podpředmět → oblast.</CardDescription>
                </div>
                <Badge variant="outline">
                  <Filter className="size-3" aria-hidden={true} />
                  {page.counts.total} výsledků
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isBoatManager && !wholeFleet && (
                <div className="mb-4 flex flex-wrap gap-2 rounded-[12px] border border-[#D6DFF0] bg-[#F8FAFC] p-2">
                  <Button asChild size="sm" variant={listScope === "moje" ? "default" : "outline"}>
                    <Link href={buildHref({ tab: "seznam", scope: "moje", page: null }, currentParams)}>Moje lodičky</Link>
                  </Button>
                  <Button asChild size="sm" variant={listScope === "vse" ? "default" : "outline"}>
                    <Link href={buildHref({ tab: "seznam", scope: "vse", page: null }, currentParams)}>Všechny lodičky</Link>
                  </Button>
                  <span className="flex items-center px-2 text-xs text-[#4A5A7C]">
                    Všechny lodičky jsou pro cizí oblasti pouze pro čtení.
                  </span>
                </div>
              )}
              <LodickyFilterForm
                filters={filters}
                svpVersions={page.svpVersions}
                selectedSvpId={selectedSvp?.id ?? ""}
                listScope={listScope}
                clearHref={`/portal/lodicky/sprava?tab=seznam${selectedSvp ? `&svp=${encodeURIComponent(selectedSvp.id)}` : ""}${isBoatManager ? `&scope=${listScope}` : ""}`}
                predmetOptions={page.predmetOptions}
                podpredmetOptions={page.podpredmetOptions}
                oblastOptions={page.oblastOptions}
              />
            </CardContent>
          </Card>

          <LodickyTableClient
            queryString={detailQueryString}
            detailQuery={detailQueryString}
            initialTotal={page.counts.total}
            wholeFleet={canEditSvpStructure}
            canEditBasicFromList={wholeFleet}
            scopeLabel={wholeFleet ? (canEditSvpStructure ? "pracovní verze" : "editace názvu a popisu") : isBoatManager ? (listScope === "moje" ? "moje lodičky" : "všechny lodičky") : "jen pro čtení"}
            selectedSvpId={selectedSvp?.id ?? null}
            predmetOptions={page.predmetOptions}
            podpredmetOptions={page.podpredmetOptions}
            oblastOptions={page.oblastOptions}
            spravceOptions={page.spravceOptions}
            garantOptions={page.garantOptions}
            currentPersonIds={personIds}
          />

          {filters.coverage && (
            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href={buildHref({ coverage: null, tab: "seznam", scope: listScope }, currentParams)}>Zrušit kontrolní filtr</Link>
              </Button>
            </div>
          )}
        </TabsContent>}

        {activeTab === "pristup" && <TabsContent value="pristup" className="space-y-4">
          {wholeFleet && selectedSvp ? (
            <OblastSpravciManager
              svpVersionId={selectedSvp.id}
              returnTo={buildHref({ tab: "pristup" }, currentParams)}
              predmetOptions={page.predmetOptions}
              podpredmetOptions={page.podpredmetOptions}
              oblastOptions={page.oblastOptions}
              spravceOptions={page.spravceOptions}
              currentPersonIds={personIds}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Přístup k lodičkám</CardTitle>
                <CardDescription>Správci lodiček vidí jen oblasti, ke kterým jsou přiřazení správcem flotily.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-[#4A5A7C]">
                Změny přístupů k oblastem může dělat pouze správce flotily.
              </CardContent>
            </Card>
          )}
        </TabsContent>}

        {canViewRvp && activeTab === "rvp" && <TabsContent value="rvp" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {page.rvpVersions.map((rvp) => (
              <Card key={rvp.id} className={selectedSvp?.basedOnRvpVersionId === rvp.id ? "border-[#0E2A5C]" : ""}>
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
                    <Link href={`/portal/lodicky/sprava/rvp?rvp=${encodeURIComponent(rvp.id)}`}>Detail RVP a OVU</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>RVP vazba aktuální sady</CardTitle>
              <CardDescription>
                Detailní výpis OVU zůstává na samostatné stránce, protože může mít stovky položek.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#4A5A7C]">
              <div>
                <span className="font-semibold text-[#0E2A5C]">{selectedSvp?.label ?? "bez sady"}</span>
                <br />
                RVP {selectedSvp?.rvpDatasetVersion ?? "-"} · {selectedSvp?.rvpSourceFormat ?? "-"}
              </div>
              <Button asChild>
                <Link href={`/portal/lodicky/sprava/rvp${selectedSvp?.basedOnRvpVersionId ? `?rvp=${encodeURIComponent(selectedSvp.basedOnRvpVersionId)}` : ""}`}>
                  <BookOpen className="size-4" aria-hidden={true} />
                  Otevřít správu RVP
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>}
      </Tabs>

      <div className="flex items-center gap-2 text-xs text-[#7F88A0]">
        <Anchor className="size-3" aria-hidden={true} />
        Vazba školní rok ↔ sada se řeší přes platnost sady a osobní sady žáků; samotný katalog není kopie pro každý rok.
      </div>
    </div>
  );
}
