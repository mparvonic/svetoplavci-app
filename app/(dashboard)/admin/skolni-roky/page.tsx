import Link from "next/link";
import {
  AlertTriangle,
  CalendarRange,
  Layers3,
  UsersRound,
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

import { formatDate } from "../uzivatele/format";
import { getAdminSchoolYearsPage } from "./data";

function groupKindLabel(kind: string) {
  const labels: Record<string, string> = {
    stupen: "Stupeň",
    rocnik: "Ročník",
    smecka: "Smečka",
    posadka: "Posádka",
    studijni_skupina: "Studijní skupina",
  };
  return labels[kind] ?? kind;
}

function CountCard({
  title,
  description,
  value,
  tone = "default",
}: {
  title: string;
  description: string;
  value: number | string;
  tone?: "default" | "danger";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p
          className={
            tone === "danger"
              ? "text-3xl font-semibold text-[#C8372D]"
              : "text-3xl font-semibold text-[#0E2A5C]"
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function AdminSchoolYearsPage() {
  const {
    schoolYears,
    activeSchoolYear,
    groupSummaries,
    groupKindSummary,
    activeStudentsCount,
    activeGuidesCount,
    childrenWithoutSmeckaCount,
    childrenWithoutStudyGroupCount,
    guidesWithoutSmeckaCount,
    openMembershipViolationsCount,
    policies,
  } = await getAdminSchoolYearsPage();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="sv-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="sv-eyebrow text-[#C8372D]">Skupiny</p>
              <h1 className="sv-display-sm text-[#0E2A5C]">
                Školní roky, smečky a skupiny
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Read-only přehled aktivního školního roku, skupin a členství.
                Editace smeček, studijních skupin a přiřazování dětí/průvodců
                bude další krok nad těmito daty.
              </p>
            </div>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EEF2F7] text-[#0E2A5C]">
              <CalendarRange className="size-5" aria-hidden={true} />
            </span>
          </div>
        </div>

        <div className="sv-card border-[#0E2A5C] bg-[#0E2A5C] p-6 text-white">
          <p className="sv-eyebrow text-white/70">Aktivní školní rok</p>
          <p className="mt-2 text-2xl font-semibold">
            {activeSchoolYear?.code ?? "-"}
          </p>
          <p className="mt-2 text-xs text-white/75">
            {activeSchoolYear
              ? `${formatDate(activeSchoolYear.teachingStartDate)} až ${formatDate(activeSchoolYear.teachingEndDate)}`
              : "Zatím není založený školní rok"}
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <CountCard
          title="Žáci"
          description="Aktivní osoby s rolí žák."
          value={activeStudentsCount}
        />
        <CountCard
          title="Průvodci"
          description="Aktivní osoby s rolí průvodce."
          value={activeGuidesCount}
        />
        <CountCard
          title="Skupiny"
          description="Smečky, skupiny a další školní členění."
          value={groupSummaries.length}
        />
        <CountCard
          title="Porušení"
          description="Otevřená porušení pravidel členství."
          value={openMembershipViolationsCount}
          tone={openMembershipViolationsCount > 0 ? "danger" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Děti bez smečky</CardTitle>
            <CardDescription>
              Aktivní žáci bez aktivního členství ve smečce.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold text-[#C8372D]">
              {childrenWithoutSmeckaCount}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/kontrola-dat">Otevřít ve frontě</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Děti bez skupiny</CardTitle>
            <CardDescription>
              Aktivní žáci bez studijní skupiny.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold text-[#C8372D]">
              {childrenWithoutStudyGroupCount}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/kontrola-dat">Otevřít ve frontě</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Průvodci bez smečky</CardTitle>
            <CardDescription>
              Aktivní průvodci bez přiřazení ke smečce.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold text-[#C8372D]">
              {guidesWithoutSmeckaCount}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/kontrola-dat">Otevřít ve frontě</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Školní roky</CardTitle>
            <CardDescription>
              Základní kalendářní a výukové období.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {schoolYears.length === 0 ? (
              <div className="sv-placeholder">
                Zatím není založený žádný školní rok
              </div>
            ) : (
              <div className="space-y-2">
                {schoolYears.map((year) => (
                  <div
                    key={year.id}
                    className="rounded-[12px] border border-[#D6DFF0] bg-white p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-[#0E2A5C]">
                        {year.code}
                      </div>
                      <Badge variant={year.isActive ? "secondary" : "outline"}>
                        {year.isActive ? "aktivní" : "neaktivní"}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-[#4A5A7C]">
                      školní rok {formatDate(year.startDate)} až{" "}
                      {formatDate(year.endDate)}
                    </div>
                    <div className="text-xs text-[#7F88A0]">
                      výuka {formatDate(year.teachingStartDate)} až{" "}
                      {formatDate(year.teachingEndDate)} · {year.groups.length}{" "}
                      skupin
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Souhrn skupin</CardTitle>
                <CardDescription>
                  Počty skupin a aktivních členství podle typu.
                </CardDescription>
              </div>
              <Layers3 className="size-5 text-[#0E2A5C]" aria-hidden={true} />
            </div>
          </CardHeader>
          <CardContent>
            {groupKindSummary.length === 0 ? (
              <div className="sv-placeholder">
                Zatím nejsou založené žádné skupiny
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Typ</TableHead>
                    <TableHead>Skupiny</TableHead>
                    <TableHead>Členství</TableHead>
                    <TableHead>Děti</TableHead>
                    <TableHead>Průvodci</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupKindSummary.map((summary) => (
                    <TableRow key={summary.kind}>
                      <TableCell className="font-medium text-[#0E2A5C]">
                        {groupKindLabel(summary.kind)}
                      </TableCell>
                      <TableCell className="text-sm text-[#4A5A7C]">
                        {summary.activeGroupsCount}/{summary.groupsCount}{" "}
                        aktivních
                      </TableCell>
                      <TableCell className="text-sm text-[#4A5A7C]">
                        {summary.membershipCount}
                      </TableCell>
                      <TableCell className="text-sm text-[#4A5A7C]">
                        {summary.studentCount}
                      </TableCell>
                      <TableCell className="text-sm text-[#4A5A7C]">
                        {summary.guideCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Skupiny</CardTitle>
              <CardDescription>
                Smečky, studijní skupiny a jejich aktuální členství.
              </CardDescription>
            </div>
            <Badge variant="outline">
              <UsersRound className="size-3" aria-hidden={true} />
              {groupSummaries.length} skupin
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {groupSummaries.length === 0 ? (
            <div className="sv-placeholder">
              Zatím nejsou založené žádné skupiny
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Skupina</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Školní rok</TableHead>
                  <TableHead>Členové</TableHead>
                  <TableHead>Platnost</TableHead>
                  <TableHead>Stav</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupSummaries.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div className="font-semibold text-[#0E2A5C]">
                        {group.name}
                      </div>
                      <div className="text-xs text-[#7F88A0]">{group.code}</div>
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {groupKindLabel(group.kind)}
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {group.schoolYear?.code ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      <div>{group.membershipCount} celkem</div>
                      <div className="text-xs text-[#7F88A0]">
                        {group.studentCount} dětí · {group.guideCount} průvodců
                        {group.otherCount > 0
                          ? ` · ${group.otherCount} ostatní`
                          : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {formatDate(group.validFrom)} až{" "}
                      {formatDate(group.validTo)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={group.isActive ? "secondary" : "outline"}>
                        {group.isActive ? "aktivní" : "neaktivní"}
                      </Badge>
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
              <CardTitle>Pravidla členství</CardTitle>
              <CardDescription>
                Aktivní politiky určující očekávaná členství.
              </CardDescription>
            </div>
            <AlertTriangle
              className="size-5 text-[#C8372D]"
              aria-hidden={true}
            />
          </div>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <div className="sv-placeholder">
              Zatím nejsou aktivní žádná pravidla členství
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="rounded-[12px] border border-[#D6DFF0] bg-white p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-[#0E2A5C]">
                      {policy.scope}
                      {policy.scopeValue ? `: ${policy.scopeValue}` : ""}
                    </div>
                    <Badge variant="outline">priorita {policy.priority}</Badge>
                  </div>
                  <div className="mt-2 space-y-1">
                    {policy.rules.map((rule) => (
                      <div key={rule.id} className="text-sm text-[#4A5A7C]">
                        {groupKindLabel(rule.groupKind)}: {rule.minCount}-
                        {rule.maxCount ?? "∞"} · {rule.enforcement}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-[#7F88A0]">
                    {formatDate(policy.validFrom)} až{" "}
                    {formatDate(policy.validTo)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
