import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatDateTime } from "../uzivatele/format";
import { ADMIN_SYNC_RUN_LIMIT, getAdminSyncPage } from "./data";

export const dynamic = "force-dynamic";

type SyncRun = Awaited<ReturnType<typeof getAdminSyncPage>>["runs"][number];

function statusBadge(status: string) {
  if (status === "success") return <Badge variant="secondary">úspěch</Badge>;
  if (status === "failed") return <Badge variant="destructive">chyba</Badge>;
  if (status === "running") return <Badge variant="default">běží</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function statusIcon(status: string) {
  if (status === "success")
    return (
      <CheckCircle2 className="size-4 text-[#1F7A4D]" aria-hidden={true} />
    );
  if (status === "failed")
    return <XCircle className="size-4 text-[#C8372D]" aria-hidden={true} />;
  return <Clock3 className="size-4 text-[#4A5A7C]" aria-hidden={true} />;
}

function durationLabel(run: SyncRun): string {
  if (!run.finishedAt) return "-";
  const started = new Date(run.startedAt).getTime();
  const finished = new Date(run.finishedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(finished)) return "-";
  const seconds = Math.max(0, Math.round((finished - started) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return `${minutes} min ${restSeconds} s`;
}

function QualityItem({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const content = (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[#D6DFF0] bg-white p-3">
      <span className="text-sm font-medium text-[#0E2A5C]">{label}</span>
      <Badge variant={value > 0 ? "destructive" : "secondary"}>{value}</Badge>
    </div>
  );

  return href ? (
    <Link href={href} className="block hover:opacity-90">
      {content}
    </Link>
  ) : (
    content
  );
}

export default async function AdminSyncPage() {
  const {
    runs,
    latestRun,
    latestSuccessfulRun,
    totalRuns,
    successRuns,
    failedRuns,
    runningRuns,
    sourceSummary,
    quality,
  } = await getAdminSyncPage();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="sv-card p-6">
          <p className="sv-eyebrow text-[#C8372D]">Importy</p>
          <h1 className="sv-display-sm mt-2 text-[#0E2A5C]">
            Synchronizace a importy
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Read-only provozní přehled synchronizací z Edookitu a CSV importů
            rodičů. Spouštění a preview změn přidáme jako samostatný potvrzovací
            workflow.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/kontrola-dat">Kontrola dat</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/vazby">Rodinné vazby</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="sv-card p-4">
            <p className="sv-eyebrow text-[#4A5A7C]">Poslední běh</p>
            <p className="mt-1 text-xl font-semibold text-[#0E2A5C]">
              {latestRun ? formatDateTime(latestRun.startedAt) : "-"}
            </p>
            <div className="mt-2">
              {latestRun ? (
                statusBadge(latestRun.status)
              ) : (
                <Badge variant="outline">bez běhu</Badge>
              )}
            </div>
          </div>
          <div className="sv-card p-4">
            <p className="sv-eyebrow text-[#4A5A7C]">Ke kontrole</p>
            <p className="mt-1 text-2xl font-semibold text-[#C8372D]">
              {quality.totalIssues}
            </p>
            <p className="text-xs text-[#7F88A0]">
              souhrn po posledních importech
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Běhy celkem</CardTitle>
            <CardDescription>Historie v `AppUserSyncRun`.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#0E2A5C]">{totalRuns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Úspěšné</CardTitle>
            <CardDescription>Dokončené bez chyby.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#0E2A5C]">
              {successRuns}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Chybové</CardTitle>
            <CardDescription>Běhy, které skončily výjimkou.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#C8372D]">
              {failedRuns}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Běžící</CardTitle>
            <CardDescription>Aktuálně nedokončené běhy.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#0E2A5C]">
              {runningRuns}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Zdrojová data</CardTitle>
            <CardDescription>
              Počet zdrojových záznamů podle typu a poslední synchronizace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sourceSummary.length === 0 ? (
              <div className="sv-placeholder">
                Zatím nejsou uložené zdrojové záznamy
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zdroj</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead>Počet</TableHead>
                    <TableHead>Poslední sync</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourceSummary.map((source) => (
                    <TableRow
                      key={`${source.sourceType}:${source.activeSource}`}
                    >
                      <TableCell className="font-medium text-[#0E2A5C]">
                        {source.sourceType}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            source.activeSource ? "secondary" : "outline"
                          }
                        >
                          {source.activeSource ? "aktivní" : "neaktivní"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-[#4A5A7C]">
                        {source.count}
                      </TableCell>
                      <TableCell className="text-sm text-[#4A5A7C]">
                        {formatDateTime(source.lastSyncedAt)}
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Kontrolní signály</CardTitle>
                <CardDescription>
                  Čísla, která bude další krok převádět na frontu problémů.
                </CardDescription>
              </div>
              <AlertTriangle
                className="size-5 text-[#C8372D]"
                aria-hidden={true}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <QualityItem
              label="Děti bez rodiče"
              value={quality.childrenWithoutParentsCount}
              href="/admin/vazby"
            />
            <QualityItem
              label="Rodiče bez dětí"
              value={quality.parentsWithoutChildrenCount}
              href="/admin/vazby"
            />
            <QualityItem
              label="Děti bez smečky"
              value={quality.childrenWithoutSmeckaCount}
              href="/admin/skolni-roky"
            />
            <QualityItem
              label="Děti bez studijní skupiny"
              value={quality.childrenWithoutStudyGroupCount}
              href="/admin/skolni-roky"
            />
            <QualityItem
              label="Průvodci bez smečky"
              value={quality.guidesWithoutSmeckaCount}
              href="/admin/skolni-roky"
            />
            <QualityItem
              label="Otevřené login konflikty"
              value={quality.openIdentityConflictsCount}
              href="/admin/pristupy?status=conflict"
            />
            <QualityItem
              label="Porušení členství"
              value={quality.openMembershipViolationsCount}
              href="/admin/kontrola-dat"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Historie běhů</CardTitle>
              <CardDescription>
                Zobrazuji posledních{" "}
                {Math.min(runs.length, ADMIN_SYNC_RUN_LIMIT)} běhů
                synchronizace/importu.
              </CardDescription>
            </div>
            <Badge variant="outline">
              <RefreshCcw className="size-3" aria-hidden={true} />
              {latestSuccessfulRun
                ? `poslední úspěch ${formatDateTime(latestSuccessfulRun.finishedAt)}`
                : "bez úspěchu"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="sv-placeholder">
              Zatím tu není žádný běh synchronizace
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stav</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Datum dat</TableHead>
                  <TableHead>Načteno</TableHead>
                  <TableHead>Zasažené osoby</TableHead>
                  <TableHead>Trvání</TableHead>
                  <TableHead>Chyba</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcon(run.status)}
                        {statusBadge(run.status)}
                      </div>
                      <div className="mt-1 text-xs text-[#7F88A0]">
                        {formatDateTime(run.startedAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      <div className="font-medium text-[#0E2A5C]">
                        {run.runType}
                      </div>
                      <div className="text-xs text-[#7F88A0]">{run.source}</div>
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      <div>{run.requestedDate ?? "-"}</div>
                      <div className="text-xs text-[#7F88A0]">
                        inactive od {run.includeInactiveSince ?? "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      <div>{run.studentsCount} dětí</div>
                      <div>{run.employeesCount} zaměstnanců</div>
                      <div>{run.csvCount} rodičů z CSV</div>
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {run.personsTouched}
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {durationLabel(run)}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-[#4A5A7C]">
                      {run.error ? (
                        <span className="line-clamp-3 text-[#C8372D]">
                          {run.error}
                        </span>
                      ) : (
                        "-"
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
