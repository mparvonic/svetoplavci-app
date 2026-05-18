import Link from "next/link";
import { ArrowLeft, ExternalLink, Pencil, ShieldCheck, X } from "lucide-react";

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
import { isM01DerivedRole } from "@/src/lib/m01-lodicky-role-sync";
import { APP_ROLES } from "@/src/lib/user-directory";

import { getAdminPersonMergeOptions, getAdminUserDetail } from "../data";
import { formatDate, formatDateTime, formatPersonDisplayName } from "../format";
import { updateAdminUserRolesAction } from "./actions";
import { PersonMergeDialog } from "./person-merge-dialog";

export const dynamic = "force-dynamic";

type AdminUserDetailPageProps = {
  params: Promise<{ personId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  zamestnanec: "Zaměstnanec",
  ucitel: "Učitel",
  pruvodce: "Průvodce",
  garant: "Garant stavu lodiček",
  spravce_lodicek: "Správce lodiček",
  spravce_flotily: "Správce flotily",
  patron: "Patron",
  druzinar: "Družinář",
  editor_hodnoceni: "Editor hodnocení",
  schvalovatel_hodnoceni: "Schvalovatel hodnocení",
  rodic: "Rodič",
  zak: "Žák",
  tester: "Tester",
  proto: "Proto",
};

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "secondary" : "outline"}>
      {active ? "aktivní" : "neaktivní"}
    </Badge>
  );
}

function EmptyText({
  children = "Žádná data",
}: {
  children?: React.ReactNode;
}) {
  return <div className="sv-placeholder min-h-24">{children}</div>;
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function payloadText(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function sourceRecordMeta(record: {
  organizationIdent: string | null;
  sourcePersonId: string | null;
  sourceRecordId: string | null;
  payload: unknown;
}) {
  const payload = jsonObject(record.payload);
  return {
    organizationName: payloadText(payload, "OrganizationName"),
    organizationIdent:
      record.organizationIdent ?? payloadText(payload, "OrganizationIdent"),
    enrolledSince: payloadText(payload, "EnrolledSince"),
    unenrolledSince: payloadText(payload, "UnenrolledSince"),
    sourcePersonId: record.sourcePersonId ?? record.sourceRecordId,
  };
}

function roleValidityLabel(role: {
  validFrom: Date | string | null;
  validTo: Date | string | null;
}) {
  if (!role.validFrom && !role.validTo) return "platnost neomezena";
  return `platnost ${formatDate(role.validFrom)} až ${formatDate(role.validTo)}`;
}

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: AdminUserDetailPageProps) {
  const { personId } = await params;
  const query = await searchParams;
  const [person, mergeOptions] = await Promise.all([
    getAdminUserDetail(personId),
    getAdminPersonMergeOptions(),
  ]);
  const displayName = formatPersonDisplayName(person);
  const activeRoles = person.roles.filter((role) => role.isActive);
  const activeRoleCodes = new Set(activeRoles.map((role) => role.role));
  const visibleRoles = person.roles.filter(
    (role) => role.isActive || !activeRoleCodes.has(role.role),
  );
  const hiddenDuplicateHistoricalRolesCount =
    person.roles.length - visibleRoles.length;
  const primarySourceEmail = person.sourceRecords.find(
    (record) => record.primaryEmail,
  )?.primaryEmail;
  const primaryLoginEmail = person.loginLinks.find(
    (link) => link.status === "approved",
  )?.identity.normalizedValue;
  const roleUpdateState =
    typeof query.roleUpdate === "string" ? query.roleUpdate : null;
  const roleUpdateMessage =
    typeof query.message === "string" ? query.message : null;
  const roleEditMode = query.roleEdit === "1";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/uzivatele">
            <ArrowLeft className="size-4" aria-hidden={true} />
            Zpět na uživatele
          </Link>
        </Button>
        <Badge variant="outline">{person.id}</Badge>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="sv-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="sv-eyebrow text-[#C8372D]">Detail osoby</p>
              <h1 className="sv-display-sm text-[#0E2A5C]">{displayName}</h1>
              <div className="flex flex-wrap gap-2">
                <StatusBadge active={person.isActive} />
                {activeRoles.length === 0 ? (
                  <Badge variant="outline">bez aktivní role</Badge>
                ) : (
                  activeRoles.map((role) => (
                    <Badge
                      key={`${role.role}:${role.source}`}
                      variant="outline"
                    >
                      {role.role}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div className="text-right text-xs text-[#7F88A0]">
              <div>Vytvořeno {formatDateTime(person.createdAt)}</div>
              <div>Upraveno {formatDateTime(person.updatedAt)}</div>
              <div className="mt-3">
                <PersonMergeDialog
                  currentPersonId={person.id}
                  people={mergeOptions}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="sv-card border-[#0E2A5C] bg-[#0E2A5C] p-6 text-white">
          <p className="sv-eyebrow text-white/70">Primární kontakt</p>
          <p className="mt-2 text-sm font-semibold">
            {primaryLoginEmail ?? primarySourceEmail ?? "Bez e-mailu"}
          </p>
          <p className="mt-2 text-xs text-white/75">
            E-mail v detailu může pocházet ze zdrojového záznamu nebo ze
            schválené login identity.
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>Základní údaje osoby.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[
                ["Jméno", displayName],
                ["Jméno v DB", person.displayName],
                ["Přezdívka", person.nickname ?? "-"],
                ["Křestní", person.firstName ?? "-"],
                ["Prostřední", person.middleName ?? "-"],
                ["Příjmení", person.lastName ?? "-"],
                ["Identifikátor", person.identifier ?? "-"],
                ["Plus4U ID", person.plus4uId ?? "-"],
                ["Čip UID", person.chipUid ?? "-"],
                ["Čip HID", person.chipHid ?? "-"],
                [
                  "Sloučeno do",
                  person.mergedIntoPerson
                    ? formatPersonDisplayName(person.mergedIntoPerson)
                    : "-",
                ],
                [
                  "Sloučeno",
                  person.mergedAt
                    ? `${formatDateTime(person.mergedAt)} · ${person.mergedBy ?? "-"}`
                    : "-",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 border-b border-[#EEF2F7] pb-2"
                >
                  <dt className="text-[#7F88A0]">{label}</dt>
                  <dd className="text-right font-medium text-[#0E2A5C]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role</CardTitle>
            <CardDescription>
              Přehled aktuálně přiřazených rolí osoby.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {roleUpdateState === "saved" && (
              <div className="rounded-[12px] border border-[#B8D9C6] bg-[#F0FAF3] p-3 text-sm font-medium text-[#1F7A4D]">
                Role byly uloženy.
              </div>
            )}
            {roleUpdateState === "error" && (
              <div className="rounded-[12px] border border-[#F0B8B6] bg-[#FFF4F3] p-3 text-sm font-medium text-[#C8372D]">
                {roleUpdateMessage ?? "Role se nepodařilo uložit."}
              </div>
            )}

            {roleEditMode ? (
              <form action={updateAdminUserRolesAction} className="space-y-3">
                <input type="hidden" name="personId" value={person.id} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {APP_ROLES.map((role) => {
                    const checked = activeRoleCodes.has(role);
                    const managedByLodicky = isM01DerivedRole(role);
                    return (
                      <div
                        key={role}
                        className={[
                          "flex min-h-11 items-center gap-3 rounded-[12px] border px-3 py-2 text-sm transition",
                          checked
                            ? "border-[#0E2A5C] bg-[#F7FAFF] text-[#0E2A5C]"
                            : "border-[#D6DFF0] bg-white text-[#4A5A7C] hover:bg-[#EEF2F7]",
                          managedByLodicky
                            ? "cursor-not-allowed opacity-70 hover:bg-white"
                            : "cursor-pointer",
                        ].join(" ")}
                      >
                        {managedByLodicky ? (
                          <span
                            className={[
                              "size-4 rounded border",
                              checked
                                ? "border-[#0E2A5C] bg-[#0E2A5C]"
                                : "border-[#D6DFF0] bg-white",
                            ].join(" ")}
                            aria-hidden={true}
                          />
                        ) : (
                          <input
                            name="role"
                            value={role}
                            type="checkbox"
                            defaultChecked={checked}
                            className="size-4 rounded border-[#D6DFF0] text-[#0E2A5C]"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block font-semibold">
                            {ROLE_LABELS[role] ?? role}
                          </span>
                          <span className="block text-xs text-[#7F88A0]">
                            {managedByLodicky
                              ? "řízeno správou lodiček"
                              : role}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#F7FAFF] p-3 text-xs text-[#4A5A7C]">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="size-4" aria-hidden={true} />
                    Odebrání posledního admina je blokované.
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                      <Link href={`/admin/uzivatele/${person.id}`}>
                        <X className="size-4" aria-hidden={true} />
                        Storno
                      </Link>
                    </Button>
                    <Button
                      type="submit"
                      className="bg-[#002060] text-white hover:bg-[#001540]"
                    >
                      Uložit role
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                {activeRoles.length === 0 ? (
                  <EmptyText>Bez aktivních rolí</EmptyText>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {activeRoles.map((role) => (
                      <Badge
                        key={`${role.role}:${role.source}`}
                        variant="outline"
                        className="px-3 py-1"
                      >
                        {ROLE_LABELS[role.role] ?? role.role}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button asChild variant="outline">
                  <Link href={`/admin/uzivatele/${person.id}?roleEdit=1`}>
                    <Pencil className="size-4" aria-hidden={true} />
                    Upravit role
                  </Link>
                </Button>
              </div>
            )}

            {roleEditMode && (
              <div className="space-y-2 border-t border-[#EEF2F7] pt-4">
                <h3 className="text-sm font-semibold text-[#0E2A5C]">
                  Záznamy rolí
                </h3>
                {visibleRoles.length === 0 ? (
                  <EmptyText>Bez rolí</EmptyText>
                ) : (
                  <div className="space-y-2">
                    {visibleRoles.map((role) => (
                      <div
                        key={role.id}
                        className="rounded-[12px] border border-[#D6DFF0] bg-white p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#0E2A5C]">
                            {role.role}
                          </span>
                          <StatusBadge active={role.isActive} />
                        </div>
                        <div className="mt-2 text-xs text-[#7F88A0]">
                          Zdroj {role.source} · {roleValidityLabel(role)}
                        </div>
                      </div>
                    ))}
                    {hiddenDuplicateHistoricalRolesCount > 0 && (
                      <div className="rounded-[12px] border border-[#D6DFF0] bg-[#F7FAFF] p-3 text-xs text-[#7F88A0]">
                        Skryto {hiddenDuplicateHistoricalRolesCount} duplicitních
                        historických rolí, které mají stejný kód jako aktivní role.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datová kvalita</CardTitle>
            <CardDescription>
              Rychlé signály pro další admin workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge
              variant={person.loginLinks.length > 0 ? "secondary" : "outline"}
            >
              {person.loginLinks.length > 0
                ? "má login identitu"
                : "bez login identity"}
            </Badge>
            <Badge
              variant={
                person.sourceRecords.length > 0 ? "secondary" : "outline"
              }
            >
              {person.sourceRecords.length > 0
                ? "má zdrojový záznam"
                : "bez zdroje"}
            </Badge>
            <Badge
              variant={
                person.violations.length === 0 ? "secondary" : "destructive"
              }
            >
              {person.violations.length === 0
                ? "bez otevřených porušení"
                : `${person.violations.length} porušení`}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Login identity</CardTitle>
          <CardDescription>
            E-maily a další identity navázané na tuto osobu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {person.loginLinks.length === 0 ? (
            <EmptyText>Bez login identit</EmptyText>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identita</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead>Schválení</TableHead>
                  <TableHead>Důvod</TableHead>
                  <TableHead>Upraveno</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {person.loginLinks.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell>
                      <div className="font-medium text-[#0E2A5C]">
                        {link.identity.normalizedValue}
                      </div>
                      <div className="text-xs text-[#7F88A0]">
                        {link.identity.identityType}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          link.status === "approved" ? "secondary" : "outline"
                        }
                      >
                        {link.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {link.approvedBy
                        ? `${link.approvedBy} · ${formatDateTime(link.approvedAt)}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {link.reason ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm text-[#4A5A7C]">
                      {formatDateTime(link.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Zdrojové záznamy</CardTitle>
            <CardDescription>
              Edookit, CSV nebo jiné zdroje dat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {person.sourceRecords.length === 0 ? (
              <EmptyText>Bez zdrojových záznamů</EmptyText>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zdroj</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Organizace</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead>Role ze zdroje</TableHead>
                    <TableHead>Sync</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {person.sourceRecords.map((record) => {
                    const meta = sourceRecordMeta(record);

                    return (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="font-medium text-[#0E2A5C]">
                            {record.sourceType}
                          </div>
                          <div className="text-xs text-[#7F88A0]">
                            {record.activeSource ? "aktivní" : "neaktivní"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-[#4A5A7C]">
                          {record.primaryEmail ?? "-"}
                        </TableCell>
                        <TableCell className="text-sm text-[#4A5A7C]">
                          <div>{meta.organizationName ?? "-"}</div>
                          <div className="text-xs text-[#7F88A0]">
                            {meta.organizationIdent
                              ? `IČO ${meta.organizationIdent}`
                              : ""}
                            {meta.sourcePersonId
                              ? `${meta.organizationIdent ? " · " : ""}ID ${meta.sourcePersonId}`
                              : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-[#4A5A7C]">
                          <div>vstup {formatDate(meta.enrolledSince)}</div>
                          <div className="text-xs text-[#7F88A0]">
                            výstup {formatDate(meta.unenrolledSince)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {record.derivedRoles.length === 0 ? (
                              <span className="text-sm text-[#7F88A0]">-</span>
                            ) : (
                              record.derivedRoles.map((role) => (
                                <Badge key={role} variant="outline">
                                  {role}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-[#4A5A7C]">
                          {formatDateTime(record.syncedAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rodinné vazby</CardTitle>
            <CardDescription>Rodič-dítě vazby v obou směrech.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[#0E2A5C]">
                Děti této osoby
              </h3>
              {person.parentLinks.length === 0 ? (
                <EmptyText>Žádné děti</EmptyText>
              ) : (
                <div className="space-y-2">
                  {person.parentLinks.map((link) => (
                    <Link
                      key={link.id}
                      href={`/admin/uzivatele/${link.childPerson.id}`}
                      className="flex items-center justify-between gap-3 rounded-[12px] border border-[#D6DFF0] bg-white p-3 text-sm hover:bg-[#EEF2F7]"
                    >
                      <span className="font-medium text-[#0E2A5C]">
                        {formatPersonDisplayName(link.childPerson)}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-[#7F88A0]">
                        {link.isActive ? "aktivní" : "neaktivní"}{" "}
                        <ExternalLink className="size-3" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-[#0E2A5C]">
                Rodiče této osoby
              </h3>
              {person.childLinks.length === 0 ? (
                <EmptyText>Žádní rodiče</EmptyText>
              ) : (
                <div className="space-y-2">
                  {person.childLinks.map((link) => (
                    <Link
                      key={link.id}
                      href={`/admin/uzivatele/${link.parentPerson.id}`}
                      className="flex items-center justify-between gap-3 rounded-[12px] border border-[#D6DFF0] bg-white p-3 text-sm hover:bg-[#EEF2F7]"
                    >
                      <span className="font-medium text-[#0E2A5C]">
                        {formatPersonDisplayName(link.parentPerson)}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-[#7F88A0]">
                        {link.isActive ? "aktivní" : "neaktivní"}{" "}
                        <ExternalLink className="size-3" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Školní členství a stav dítěte</CardTitle>
          <CardDescription>
            Smečky, studijní skupiny, ročníky a typ studia.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-[#0E2A5C]">
              Členství ve skupinách
            </h3>
            {person.memberships.length === 0 ? (
              <EmptyText>Bez členství</EmptyText>
            ) : (
              <div className="space-y-2">
                {person.memberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="rounded-[12px] border border-[#D6DFF0] bg-white p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#0E2A5C]">
                        {membership.group.name}
                      </span>
                      <Badge
                        variant={membership.validTo ? "outline" : "secondary"}
                      >
                        {membership.validTo ? "ukončeno" : "aktivní"}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-[#7F88A0]">
                      {String(membership.groupKind)} ·{" "}
                      {membership.group.schoolYear?.code ?? "bez školního roku"}{" "}
                      · {formatDate(membership.validFrom)} až{" "}
                      {formatDate(membership.validTo)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-[#0E2A5C]">
              Stav dítěte
            </h3>
            {person.studentStates.length === 0 ? (
              <EmptyText>Bez stavu dítěte</EmptyText>
            ) : (
              <div className="space-y-2">
                {person.studentStates.map((state) => (
                  <div
                    key={state.id}
                    className="rounded-[12px] border border-[#D6DFF0] bg-white p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#0E2A5C]">
                        {state.schoolYear?.code ?? "bez školního roku"}
                      </span>
                      <Badge
                        variant={state.effectiveTo ? "outline" : "secondary"}
                      >
                        {state.effectiveTo ? "historie" : "aktuální"}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-[#7F88A0]">
                      ročník {state.currentGradeNum ?? "-"} · typ{" "}
                      {String(state.studyModeKey)} ·{" "}
                      {formatDate(state.effectiveFrom)} až{" "}
                      {formatDate(state.effectiveTo)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
