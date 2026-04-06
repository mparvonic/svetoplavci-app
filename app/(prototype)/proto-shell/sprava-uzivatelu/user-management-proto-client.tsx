"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Compass,
  Download,
  MailPlus,
  Menu,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  UserRoundPlus,
  UserX,
  X,
} from "lucide-react";
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

type ProtoContextRole = ProtoAdminRole;

const CONTEXT_ROLE_ORDER: ProtoContextRole[] = [
  "admin",
  "zamestnanec",
  "ucitel",
  "rodic",
  "zak",
  "tester",
  "proto",
];

const CONTEXT_ROLE_SET = new Set<ProtoContextRole>(CONTEXT_ROLE_ORDER);

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

function normalizeContextRole(input: string | null, fallback: ProtoContextRole): ProtoContextRole {
  if (input && CONTEXT_ROLE_SET.has(input as ProtoContextRole)) {
    return input as ProtoContextRole;
  }
  return fallback;
}

function normalizeSessionRoles(roles: string[]): ProtoContextRole[] {
  const normalized: ProtoContextRole[] = [];
  for (const role of roles) {
    const lower = role.toLowerCase();
    if (CONTEXT_ROLE_SET.has(lower as ProtoContextRole)) {
      normalized.push(lower as ProtoContextRole);
    }
  }
  return [...new Set(normalized)];
}

function resolveDefaultContextRole(sessionRoles: string[]): ProtoContextRole {
  const normalized = new Set(normalizeSessionRoles(sessionRoles));
  for (const role of CONTEXT_ROLE_ORDER) {
    if (normalized.has(role)) return role;
  }
  return "admin";
}

export default function UserManagementProtoClient({
  sessionName,
  sessionEmail,
  sessionRoles,
}: {
  sessionName: string;
  sessionEmail: string;
  sessionRoles: string[];
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const defaultContextRole = useMemo(() => resolveDefaultContextRole(sessionRoles), [sessionRoles]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activeContextRole, setActiveContextRole] = useState<ProtoContextRole>(() =>
    normalizeContextRole(searchParams.get("role"), defaultContextRole),
  );
  const [selectedContextUserId, setSelectedContextUserId] = useState<string>(searchParams.get("user") ?? "");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<ProtoAdminRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ProtoUserStatus | "all">("all");
  const [selectedUserId, setSelectedUserId] = useState<string>(PROTO_MANAGED_USERS[0]?.id ?? "");
  const [lastAction, setLastAction] = useState<string>("");

  const contextUsers = useMemo(
    () => PROTO_MANAGED_USERS.filter((user) => user.roles.includes(activeContextRole)),
    [activeContextRole],
  );

  const activeContextUserId = useMemo(
    () =>
      contextUsers.some((user) => user.id === selectedContextUserId)
        ? selectedContextUserId
        : (contextUsers[0]?.id ?? ""),
    [contextUsers, selectedContextUserId],
  );

  const activeContextUser = useMemo(
    () => contextUsers.find((user) => user.id === activeContextUserId) ?? contextUsers[0] ?? null,
    [activeContextUserId, contextUsers],
  );

  const sessionRoleLabels = useMemo(
    () => normalizeSessionRoles(sessionRoles).map((role) => ROLE_LABELS.get(role) ?? role),
    [sessionRoles],
  );

  const isAdminContext = activeContextRole === "admin";

  useEffect(() => {
    if (!activeContextUserId) return;
    const params = new URLSearchParams();
    params.set("role", activeContextRole);
    params.set("user", activeContextUserId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeContextRole, activeContextUserId, pathname, router]);

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

  function handleContextRoleChange(value: string) {
    const nextRole = normalizeContextRole(value, defaultContextRole);
    const nextUsers = PROTO_MANAGED_USERS.filter((user) => user.roles.includes(nextRole));
    setActiveContextRole(nextRole);
    setSelectedContextUserId(nextUsers[0]?.id ?? "");
  }

  function handleContextUserChange(value: string) {
    setSelectedContextUserId(value);
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <button
        type="button"
        onClick={() => setToolsOpen((prev) => !prev)}
        className="fixed left-0 top-36 z-50 inline-flex items-center gap-2 rounded-r-xl border border-l-0 border-[#BFD2EA] bg-white px-3 py-2 text-xs font-semibold text-[#0A4DA6] shadow-md"
      >
        {toolsOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        Nástroje
      </button>

      {toolsOpen && (
        <aside className="fixed left-0 top-24 z-40 w-80 max-w-[92vw] rounded-r-2xl border border-l-0 border-[#C7D8EE] bg-white p-4 shadow-2xl">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A4DA6]">Přepínače</p>
              <div className="mt-2 space-y-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Kontext role
                  </span>
                  <select
                    value={activeContextRole}
                    onChange={(event) => handleContextRoleChange(event.target.value)}
                    className="w-full rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700"
                  >
                    {PROTO_ADMIN_ROLE_OPTIONS.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Kontext uživatele
                  </span>
                  <select
                    value={activeContextUserId}
                    onChange={(event) => handleContextUserChange(event.target.value)}
                    className="w-full rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700"
                  >
                    {contextUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.jmeno}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A4DA6]">Pomocná navigace</p>
              <div className="mt-2 space-y-2">
                <Button asChild variant="outline" className="w-full justify-start border-[#D9E4F2] bg-white text-[#05204A]">
                  <Link href="/proto-shell/sprava-uzivatelu">
                    <Compass className="size-4 text-[#0A4DA6]" />
                    Správa uživatelů
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start border-[#D9E4F2] bg-white text-[#05204A]">
                  <Link href="/proto-shell">
                    <Compass className="size-4 text-[#0A4DA6]" />
                    Proto shell
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start border-[#D9E4F2] bg-white text-[#05204A]">
                  <Link href="/prototype">
                    <Compass className="size-4 text-[#0A4DA6]" />
                    Prototype index
                  </Link>
                </Button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Změny účtů jsou dostupné jen v kontextu role <strong>admin</strong>.
            </p>
          </div>
        </aside>
      )}

      <section className={`${UI_CLASSES.pageContainer} space-y-6`}>
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">
            Proto shell · správa uživatelů
          </p>
          <h1 className={`text-2xl ${UI_CLASSES.sectionTitle}`}>Správa uživatelů</h1>
          <p className="text-sm text-slate-600">
            Prototyp administrace uživatelských účtů. Správcem této sekce je vždy uživatel s rolí <strong>admin</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge className="border border-[#C9DBF2] bg-[#EAF2FF] text-[#0A4DA6] hover:bg-[#EAF2FF]">
              Přihlášený účet: {sessionName}{sessionEmail ? ` (${sessionEmail})` : ""}
            </Badge>
            <Badge className="border border-[#D9E4F2] bg-white text-[#334155] hover:bg-white">
              Session role: {sessionRoleLabels.length > 0 ? sessionRoleLabels.join(", ") : "bez role"}
            </Badge>
            <Badge className="border border-[#C9DBF2] bg-[#F4F8FF] text-[#0A4DA6] hover:bg-[#F4F8FF]">
              Aktivní kontext: {activeContextUser?.jmeno ?? "-"} · {ROLE_LABELS.get(activeContextRole) ?? activeContextRole}
            </Badge>
          </div>
        </header>

        {!isAdminContext && (
          <Card className="border-[#F2CACA] bg-[#FFF7F7]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#8A1C1B]">
                <ShieldAlert className="size-5" />
                Read-only režim
              </CardTitle>
              <CardDescription className="text-[#8A1C1B]">
                Aktivní kontext role není <strong>admin</strong>. Přepněte roli v menu <strong>Nástroje</strong>.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Users} label="Uživatelé celkem" value={String(summary.total)} tone="info" />
          <MetricCard icon={ShieldCheck} label="Administrátoři" value={String(summary.adminCount)} tone="success" />
          <MetricCard
            icon={UserRoundPlus}
            label="Čeká na aktivaci"
            value={String(summary.pendingCount)}
            tone="warning"
          />
          <MetricCard icon={UserX} label="Blokované účty" value={String(summary.blockedCount)} tone="danger" />
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
                <CardDescription>Rychlé filtrování podle role a stavu. Akce jsou v prototypu neperzistentní.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_1fr]">
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Hledat</span>
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
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Role</span>
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
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Stav účtu</span>
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
                    disabled={!isAdminContext}
                  >
                    <MailPlus className="size-4" />
                    Pozvat uživatele
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={UI_CLASSES.secondaryButton}
                    onClick={() => setLastAction("Akce: Export CSV")}
                    disabled={!isAdminContext}
                  >
                    <Download className="size-4" />
                    Export CSV
                  </Button>
                  <Button asChild type="button" variant="outline" className="border-[#D9E4F2] bg-white text-[#05204A]">
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
                            <TableCell className="text-slate-600">{formatDateTime(user.lastLoginAt)}</TableCell>
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
                  {!selectedUser && <p className="text-sm text-slate-500">Vyberte uživatele ze seznamu.</p>}

                  {selectedUser && (
                    <>
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-[#05204A]">{selectedUser.jmeno}</p>
                        <p className="text-sm text-slate-600">{selectedUser.email}</p>
                        <StatusBadge status={selectedUser.status} />
                      </div>

                      <div className="rounded-xl border border-[#E2EBF8] bg-[#F8FBFF] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Role assignment</p>
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
                          <dd className="font-medium text-[#05204A]">{formatDateTime(selectedUser.lastLoginAt)}</dd>
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
                          disabled={!isAdminContext}
                        >
                          Uložit role
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={UI_CLASSES.dangerButton}
                          onClick={() => setLastAction(`Akce: Zablokovat účet ${selectedUser.email}`)}
                          disabled={!isAdminContext}
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
          <p className="rounded-xl border border-[#D9E4F2] bg-white px-3 py-2 text-sm text-slate-600">{lastAction}</p>
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
