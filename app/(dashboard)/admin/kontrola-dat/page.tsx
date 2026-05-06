import Link from "next/link";
import { AlertTriangle, CheckCircle2, Inbox, SearchCheck } from "lucide-react";

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
import {
  ADMIN_DATA_QUALITY_PREVIEW_LIMIT,
  getAdminDataQualityPage,
  type DataQualityIssue,
} from "./data";

function severityBadge(severity: DataQualityIssue["severity"]) {
  return severity === "error" ? (
    <Badge variant="destructive">kritické</Badge>
  ) : (
    <Badge variant="outline">ke kontrole</Badge>
  );
}

function CountCard({
  title,
  description,
  value,
  href,
}: {
  title: string;
  description: string;
  value: number;
  href: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p
          className={
            value > 0
              ? "text-3xl font-semibold text-[#C8372D]"
              : "text-3xl font-semibold text-[#0E2A5C]"
          }
        >
          {value}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={href}>Otevřít</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function issueTargetLabel(kind: DataQualityIssue["kind"]) {
  if (kind === "child_without_parent" || kind === "parent_without_child")
    return "Vazby";
  if (kind === "login_conflict") return "Přístupy";
  if (kind === "membership_violation") return "Detail osoby";
  return "Školní rok";
}

export default async function AdminDataQualityPage() {
  const { counts, issues } = await getAdminDataQualityPage();
  const criticalCount = issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="sv-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="sv-eyebrow text-[#C8372D]">Kvalita dat</p>
              <h1 className="sv-display-sm text-[#0E2A5C]">Kontrolní fronta</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Read-only fronta problémů odvozená z aktuálních dat po
                syncu/importu. Položky zatím nemají vlastní stav; po vyřešení v
                příslušné části adminu z fronty zmizí.
              </p>
            </div>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EEF2F7] text-[#0E2A5C]">
              <Inbox className="size-5" aria-hidden={true} />
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="sv-card p-4">
            <p className="sv-eyebrow text-[#4A5A7C]">Otevřeno</p>
            <p className="mt-1 text-2xl font-semibold text-[#C8372D]">
              {counts.totalIssues}
            </p>
            <p className="text-xs text-[#7F88A0]">
              aktuálně odvozených problémů
            </p>
          </div>
          <div className="sv-card p-4">
            <p className="sv-eyebrow text-[#4A5A7C]">V náhledu</p>
            <p className="mt-1 text-2xl font-semibold text-[#0E2A5C]">
              {issues.length}
            </p>
            <p className="text-xs text-[#7F88A0]">
              max. {ADMIN_DATA_QUALITY_PREVIEW_LIMIT} z každého typu
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Kritické</CardTitle>
            <CardDescription>Blokují spolehlivé použití dat.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <AlertTriangle
              className="size-5 text-[#C8372D]"
              aria-hidden={true}
            />
            <p className="text-3xl font-semibold text-[#C8372D]">
              {criticalCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ke kontrole</CardTitle>
            <CardDescription>
              Nemusí být chyba, ale chce lidské rozhodnutí.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <SearchCheck className="size-5 text-[#0E2A5C]" aria-hidden={true} />
            <p className="text-3xl font-semibold text-[#0E2A5C]">
              {warningCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Bez problémů</CardTitle>
            <CardDescription>Stav hlavní fronty.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <CheckCircle2
              className="size-5 text-[#1F7A4D]"
              aria-hidden={true}
            />
            <p className="text-3xl font-semibold text-[#0E2A5C]">
              {counts.totalIssues === 0 ? "ano" : "ne"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <CountCard
          title="Děti bez rodiče"
          description="Žáci bez aktivní rodinné vazby."
          value={counts.childrenWithoutParentsCount}
          href="/admin/vazby"
        />
        <CountCard
          title="Rodiče bez dětí"
          description="Rodiče bez aktivní vazby na dítě."
          value={counts.parentsWithoutChildrenCount}
          href="/admin/vazby"
        />
        <CountCard
          title="Login konflikty"
          description="E-mail nebo identita navázaná konfliktně."
          value={counts.openIdentityConflictsCount}
          href="/admin/pristupy?status=conflict"
        />
        <CountCard
          title="Děti bez smečky"
          description="Chybí členství ve školním roce."
          value={counts.childrenWithoutSmeckaCount}
          href="/admin/skolni-roky"
        />
        <CountCard
          title="Děti bez skupiny"
          description="Chybí studijní skupina."
          value={counts.childrenWithoutStudyGroupCount}
          href="/admin/skolni-roky"
        />
        <CountCard
          title="Průvodci bez smečky"
          description="Průvodce není přiřazený ke smečce."
          value={counts.guidesWithoutSmeckaCount}
          href="/admin/skolni-roky"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Otevřené položky</CardTitle>
              <CardDescription>
                Konkrétní ukázka problémů napříč kategoriemi. Další krok přidá
                persistované stavy a filtrování.
              </CardDescription>
            </div>
            <Badge variant="outline">{issues.length} položek</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <div className="sv-placeholder">
              Aktuálně nejsou žádné odvozené problémy
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Subjekt</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Zdroj</TableHead>
                  <TableHead>Vznik</TableHead>
                  <TableHead>Řešení</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>
                      <div className="space-y-1">
                        {severityBadge(issue.severity)}
                        <div className="text-sm font-semibold text-[#0E2A5C]">
                          {issue.title}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-[#0E2A5C]">
                      {issue.subject}
                    </TableCell>
                    <TableCell className="max-w-md text-sm text-[#4A5A7C]">
                      {issue.detail}
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {issue.source}
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {formatDateTime(issue.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link href={issue.href}>
                          {issueTargetLabel(issue.kind)}
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
    </div>
  );
}
