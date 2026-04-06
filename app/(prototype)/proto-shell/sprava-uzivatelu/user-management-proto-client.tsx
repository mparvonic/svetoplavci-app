"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType } from "react";
import { Download, MailPlus, Search, ShieldCheck, Users, UserX, UserRoundPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PROTO_ADMIN_ROLE_OPTIONS,
  PROTO_MANAGED_USERS,
  PROTO_USER_AUDIT,
  PROTO_USER_INVITES,
  PROTO_USER_STATUS_OPTIONS,
  type ProtoAdminRole,
  type ProtoInviteStatus,
  type ProtoUserStatus,
} from "@/src/lib/mock/proto-user-management";
import { UI_CLASSES } from "@/src/lib/design-pack/ui";

const ROLE_LABELS = new Map(PROTO_ADMIN_ROLE_OPTIONS.map((item) => [item.id, item.label]));

const STATUS_LABELS = new Map(PROTO_USER_STATUS_OPTIONS.map((item) => [item.id, item.label]));

const DATE_FORMATTER = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function UserManagementProtoClient({ adminName }: { adminName: string }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<ProtoAdminRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ProtoUserStatus | "all">("all");
  const [selectedUserId, setSelectedUserId] = useState<string>(PROTO_MANAGED_USERS[0]?.id ?? "");
  const [lastAction, setLastAction] = useState<string>("");

  const summary = useMemo(
    () => ({
      total: PROTO_MANAGED_USERS.length,
      adminCount: PROTO_MANAGED_USERS.filter((user) => user.roles.includes("admin")).length,
      pendingCount: PROTO_MANAGED_USERS.filter((user) => user.status === "pending").length,
      blockedCount: PROTO_MANAGED_USERS.filter((user) => user.status === "blocked").length,
    }),
    [],
  );

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return PROTO_MANAGED_USERS.filter((user) => {
      const roleMatches = roleFilter === "all" ? true : user.roles.includes(roleFilter);
      const statusMatches = statusFilter === "all" ? true : user.status === statusFilter;
      const searchMatches =
        term.length === 0
          ? true
          : `${user.jmeno} ${user.email} ${user.roles.join(" ")}`.toLowerCase().includes(term);
      return roleMatches && statusMatches && searchMatches;
    });
  }, [roleFilter, search, statusFilter]);

  const selectedUser = useMemo(() => {
    const match = filteredUsers.find((user) => user.id === selectedUserId);
    if (match) return match;
    return filteredUsers[0] ?? null;
  }, [filteredUsers, selectedUserId]);

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <section className={`${UI_CLASSES.pageContainer} space-y-6`}>
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">
            Proto shell · admin
          </p>
          <h1 className={`text-2xl ${UI_CLASSES.sectionTitle}`}>Správa uživatelů</h1>
          <p className="text-sm text-slate-600">
            Prototyp administrace uživatelských účtů. Správcem této sekce je vždy uživatel s rolí{" "}
            <strong>admin</strong>.
          </p>
          <Badge className="w-fit border border-[#C9DBF2] bg-[#EAF2FF] text-[#0A4DA6] hover:bg-[#EAF2FF]">
            Přihlášený správce: {adminName}
          </Badge>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Users}
            label="Uživatelé celkem"
            value={String(summary.total)}
            tone="info"
          />
          <MetricCard
            icon={ShieldCheck}
            label="Administrátoři"
            value={String(summary.adminCount)}
            tone="success"
          />
          <MetricCard
            icon={UserRoundPlus}
            label="Čeká na aktivaci"
            value={String(summary.pendingCount)}
            tone="warning"
          />
          <MetricCard
            icon={UserX}
            label="Blokované účty"
            value={String(summary.blockedCount)}
            tone="danger"
          />
        </section>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="h-10 bg-[#EAF2FF] text-[#0A4DA6]">
            <TabsTrigger value="users">Uživatelé</TabsTrigger>
            <TabsTrigger value="invites">Pozvánky</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card className="border-[#D9E4F2]">
              <CardHeader>
                <CardTitle className="text-[#05204A]">Filtry a akce</CardTitle>
                <CardDescription>
                  Rychlé filtrování podle role a stavu. Akce jsou v prototypu neperzistentní.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_1fr]">
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Hledat
                    </span>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Jméno, e-mail nebo role"
                        className="border-[#CFE0F7] bg-white pl-9"
                      />
                    </div>
                  </label>

                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Role
                    </span>
                    <select
                      value={roleFilter}
                      onChange={(event) => setRoleFilter(event.target.value as ProtoAdminRole | "all")}
                      className="h-9 w-full rounded-md border border-[#CFE0F7] bg-white px-3 text-sm text-slate-700"
                    >
                      <option value="all">Všechny role</option>
                      {PROTO_ADMIN_ROLE_OPTIONS.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Stav účtu
                    </span>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as ProtoUserStatus | "all")}
                      className="h-9 w-full rounded-md border border-[#CFE0F7] bg-white px-3 text-sm text-slate-700"
                    >
                      <option value="all">Všechny stavy</option>
                      {PROTO_USER_STATUS_OPTIONS.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className={UI_CLASSES.primaryButton}
                    onClick={() => setLastAction("Akce: Pozvat uživatele")}
                  >
                    <MailPlus className="size-4" />
                    Pozvat uživatele
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={UI_CLASSES.secondaryButton}
                    onClick={() => setLastAction("Akce: Export CSV")}
                  >
                    <Download className="size-4" />
                    Export CSV
                  </Button>
                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    className="border-[#D9E4F2] bg-white text-[#05204A]"
                  >
                    <Link href="/proto-shell">Zpět na proto shell</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <section className="grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
              <Card className="border-[#D9E4F2]">
                <CardHeader>
                  <CardTitle className="text-[#05204A]">Seznam uživatelů</CardTitle>
                  <CardDescription>
                    Zobrazeno {filteredUsers.length} z {PROTO_MANAGED_USERS.length} účtů.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={UI_CLASSES.tableShell}>
                    <Table>
                      <TableHeader className={UI_CLASSES.tableHead}>
                        <TableRow className="border-b border-[#D9E4F2]">
                          <TableHead>Uživatel</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Stav</TableHead>
                          <TableHead>Poslední přihlášení</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                              Filtrům neodpovídá žádný účet.
                            </TableCell>
                          </TableRow>
                        )}

                        {filteredUsers.map((user) => (
                          <TableRow
                            key={user.id}
                            className={`cursor-pointer ${user.id === selectedUser?.id ? "bg-[#F2F7FF]" : ""}`}
                            onClick={() => setSelectedUserId(user.id)}
                          >
                            <TableCell>
                              <div>
                                <p className="font-semibold text-[#05204A]">{user.jmeno}</p>
                                <p className="text-xs text-slate-500">{user.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1.5">
                                {user.roles.map((role) => (
                                  <Badge
                                    key={role}
                                    className="border border-[#C9DBF2] bg-[#F4F8FF] text-[#0A4DA6] hover:bg-[#F4F8FF]"
                                  >
                                    {ROLE_LABELS.get(role) ?? role}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={user.status} />
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {formatDateTime(user.lastLoginAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#D9E4F2]">
                <CardHeader>
                  <CardTitle className="text-[#05204A]">Detail účtu</CardTitle>
                  <CardDescription>Náhled role assignmentu a administrátorských akcí.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedUser && (
                    <p className="text-sm text-slate-500">Vyberte uživatele ze seznamu.</p>
                  )}

                  {selectedUser && (
                    <>
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-[#05204A]">{selectedUser.jmeno}</p>
                        <p className="text-sm text-slate-600">{selectedUser.email}</p>
                        <StatusBadge status={selectedUser.status} />
                      </div>

                      <div className="rounded-xl border border-[#E2EBF8] bg-[#F8FBFF] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Role assignment
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {PROTO_ADMIN_ROLE_OPTIONS.map((role) => (
                            <label key={role.id} className="flex items-start gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={selectedUser.roles.includes(role.id)}
                                readOnly
                                className="mt-0.5 size-4 rounded border-slate-300 accent-[#0A4DA6]"
                              />
                              <span>{role.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <dl className="grid gap-2 rounded-xl border border-[#E2EBF8] bg-white p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-500">Poslední přihlášení</dt>
                          <dd className="font-medium text-[#05204A]">
                            {formatDateTime(selectedUser.lastLoginAt)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-500">Založen</dt>
                          <dd className="font-medium text-[#05204A]">{formatDate(selectedUser.createdAt)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-500">Přihlášení přes</dt>
                          <dd className="font-medium text-[#05204A]">
                            {selectedUser.source === "google" ? "Google OAuth" : "Magic link"}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-500">Navázané děti</dt>
                          <dd className="font-medium text-[#05204A]">{selectedUser.linkedChildren}</dd>
                        </div>
                      </dl>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className={UI_CLASSES.primaryButton}
                          onClick={() => setLastAction(`Akce: Uložit role pro ${selectedUser.email}`)}
                        >
                          Uložit role
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={UI_CLASSES.dangerButton}
                          onClick={() => setLastAction(`Akce: Zablokovat účet ${selectedUser.email}`)}
                        >
                          Zablokovat účet
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="invites">
            <Card className="border-[#D9E4F2]">
              <CardHeader>
                <CardTitle className="text-[#05204A]">Pozvánky</CardTitle>
                <CardDescription>Stav rozeslaných pozvánek a expirací přístupů.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={UI_CLASSES.tableShell}>
                  <Table>
                    <TableHeader className={UI_CLASSES.tableHead}>
                      <TableRow className="border-b border-[#D9E4F2]">
                        <TableHead>E-mail</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Pozval</TableHead>
                        <TableHead>Expirace</TableHead>
                        <TableHead>Stav</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PROTO_USER_INVITES.map((invite) => (
                        <TableRow key={invite.id}>
                          <TableCell className="font-medium text-[#05204A]">{invite.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {invite.roles.map((role) => (
                                <Badge
                                  key={`${invite.id}-${role}`}
                                  className="border border-[#D8E3F5] bg-[#F8FBFF] text-[#0A4DA6] hover:bg-[#F8FBFF]"
                                >
                                  {ROLE_LABELS.get(role) ?? role}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>{invite.invitedBy}</TableCell>
                          <TableCell>{formatDateTime(invite.expiresAt)}</TableCell>
                          <TableCell>
                            <InviteStatusBadge status={invite.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card className="border-[#D9E4F2]">
              <CardHeader>
                <CardTitle className="text-[#05204A]">Audit log</CardTitle>
                <CardDescription>Historie změn v uživatelských účtech.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={UI_CLASSES.tableShell}>
                  <Table>
                    <TableHeader className={UI_CLASSES.tableHead}>
                      <TableRow className="border-b border-[#D9E4F2]">
                        <TableHead>Datum a čas</TableHead>
                        <TableHead>Autor</TableHead>
                        <TableHead>Akce</TableHead>
                        <TableHead>Cíl</TableHead>
                        <TableHead>Poznámka</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PROTO_USER_AUDIT.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{formatDateTime(item.at)}</TableCell>
                          <TableCell className="font-medium text-[#05204A]">{item.actor}</TableCell>
                          <TableCell>{item.action}</TableCell>
                          <TableCell>{item.target}</TableCell>
                          <TableCell className="text-slate-600">{item.detail ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {lastAction && (
          <p className="rounded-xl border border-[#D9E4F2] bg-white px-3 py-2 text-sm text-slate-600">
            {lastAction}
          </p>
        )}
      </section>
    </main>
  );
}

function formatDate(value: string): string {
  return DATE_FORMATTER.format(new Date(value));
}

function formatDateTime(value: string | null): string {
  if (!value) return "Nikdy";
  return DATETIME_FORMATTER.format(new Date(value));
}

function StatusBadge({ status }: { status: ProtoUserStatus }) {
  const labels: Record<ProtoUserStatus, string> = {
    active: STATUS_LABELS.get("active") ?? "Aktivní",
    pending: STATUS_LABELS.get("pending") ?? "Čeká na aktivaci",
    blocked: STATUS_LABELS.get("blocked") ?? "Blokovaný",
  };

  const classes: Record<ProtoUserStatus, string> = {
    active: "border border-[#BEE3D2] bg-[#ECFDF5] text-[#047857] hover:bg-[#ECFDF5]",
    pending: "border border-[#F2D9A4] bg-[#FFF8E8] text-[#A16207] hover:bg-[#FFF8E8]",
    blocked: "border border-[#F2CACA] bg-[#FFF1F1] text-[#B91C1C] hover:bg-[#FFF1F1]",
  };

  return <Badge className={classes[status]}>{labels[status]}</Badge>;
}

function InviteStatusBadge({ status }: { status: ProtoInviteStatus }) {
  const labels: Record<ProtoInviteStatus, string> = {
    pending: "Čeká",
    accepted: "Přijato",
    expired: "Expirace",
    cancelled: "Zrušeno",
  };

  const classes: Record<ProtoInviteStatus, string> = {
    pending: "border border-[#F2D9A4] bg-[#FFF8E8] text-[#A16207] hover:bg-[#FFF8E8]",
    accepted: "border border-[#BEE3D2] bg-[#ECFDF5] text-[#047857] hover:bg-[#ECFDF5]",
    expired: "border border-[#DADDE2] bg-[#F6F7F9] text-[#475569] hover:bg-[#F6F7F9]",
    cancelled: "border border-[#F2CACA] bg-[#FFF1F1] text-[#B91C1C] hover:bg-[#FFF1F1]",
  };

  return <Badge className={classes[status]}>{labels[status]}</Badge>;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "info" | "success" | "warning" | "danger";
}) {
  const toneMap: Record<"info" | "success" | "warning" | "danger", string> = {
    info: "bg-[#EAF2FF] text-[#0A4DA6]",
    success: "bg-[#ECFDF5] text-[#047857]",
    warning: "bg-[#FFF8E8] text-[#A16207]",
    danger: "bg-[#FFF1F1] text-[#B91C1C]",
  };

  return (
    <Card className="border-[#D9E4F2]">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-semibold text-[#05204A]">{value}</p>
        </div>
        <span className={`inline-flex size-10 items-center justify-center rounded-xl ${toneMap[tone]}`}>
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}
