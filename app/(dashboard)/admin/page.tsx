import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UI_CLASSES } from "@/src/lib/design-pack/ui";
import {
  MOCK_ADMIN_LOGIN_IDENTITIES,
  type MockIdentityLinkStatus,
} from "@/src/lib/mock/admin-user-identities";
import {
  PROTO_ADMIN_ROLE_OPTIONS,
  PROTO_MANAGED_USERS,
  type ProtoAdminRole,
  type ProtoUserStatus,
} from "@/src/lib/mock/proto-user-management";

const ROLE_LABELS = new Map(PROTO_ADMIN_ROLE_OPTIONS.map((role) => [role.id, role.label]));

const IDENTITY_SOURCE_LABELS = {
  edookit: "Edookit",
  manual: "Ručně",
  "csv-sync": "CSV sync",
} as const;

const USER_STATUS_LABELS: Record<ProtoUserStatus, string> = {
  active: "Aktivní",
  pending: "Čeká na aktivaci",
  blocked: "Blokovaný",
};

const USER_STATUS_BADGES: Record<ProtoUserStatus, string> = {
  active: "border border-[#BEE3D2] bg-[#ECFDF5] text-[#047857] hover:bg-[#ECFDF5]",
  pending: "border border-[#F2D9A4] bg-[#FFF8E8] text-[#A16207] hover:bg-[#FFF8E8]",
  blocked: "border border-[#F2CACA] bg-[#FFF1F1] text-[#B91C1C] hover:bg-[#FFF1F1]",
};

const IDENTITY_LINK_BADGES: Record<MockIdentityLinkStatus, string> = {
  approved: "border border-[#BEE3D2] bg-[#ECFDF5] text-[#047857] hover:bg-[#ECFDF5]",
  pending: "border border-[#F2D9A4] bg-[#FFF8E8] text-[#A16207] hover:bg-[#FFF8E8]",
  rejected: "border border-[#E3E8EF] bg-[#F8FAFC] text-[#475569] hover:bg-[#F8FAFC]",
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type UserLoginRow = {
  id: string;
  name: string;
  email: string;
  roles: ProtoAdminRole[];
  status: ProtoUserStatus;
  approvedIdentities: string[];
  pendingIdentities: string[];
};

type PendingIdentityRow = {
  id: string;
  identityValue: string;
  source: string;
  updatedAt: string;
  pendingCandidates: Array<{ name: string; roles: string; reason?: string }>;
  approvedCandidates: Array<{ name: string; roles: string }>;
};

function formatDateTime(value: string): string {
  return DATE_TIME_FORMATTER.format(new Date(value));
}

export default function AdminPage() {
  const usersById = new Map(PROTO_MANAGED_USERS.map((user) => [user.id, user]));

  const userRows: UserLoginRow[] = PROTO_MANAGED_USERS.map((user) => {
    const approvedIdentities = new Set<string>();
    const pendingIdentities = new Set<string>();

    for (const identity of MOCK_ADMIN_LOGIN_IDENTITIES) {
      for (const link of identity.links) {
        if (link.userId !== user.id) continue;
        if (link.status === "approved" && identity.isActive) {
          approvedIdentities.add(identity.identityValue);
        }
        if (link.status === "pending") {
          pendingIdentities.add(identity.identityValue);
        }
      }
    }

    return {
      id: user.id,
      name: user.jmeno,
      email: user.email,
      roles: user.roles,
      status: user.status,
      approvedIdentities: [...approvedIdentities],
      pendingIdentities: [...pendingIdentities],
    };
  });

  const pendingIdentityRows: PendingIdentityRow[] = MOCK_ADMIN_LOGIN_IDENTITIES.flatMap((identity) => {
    const pendingLinks = identity.links.filter((link) => link.status === "pending");
    if (pendingLinks.length === 0) return [];

    const approvedLinks = identity.links.filter((link) => link.status === "approved");

    return [
      {
        id: identity.id,
        identityValue: identity.identityValue,
        source: IDENTITY_SOURCE_LABELS[identity.source],
        updatedAt: identity.updatedAt,
        pendingCandidates: pendingLinks.map((link) => {
          const user = usersById.get(link.userId);
          return {
            name: user?.jmeno ?? link.userId,
            roles: (user?.roles ?? []).map((role) => ROLE_LABELS.get(role) ?? role).join(", "),
            reason: link.reason,
          };
        }),
        approvedCandidates: approvedLinks.map((link) => {
          const user = usersById.get(link.userId);
          return {
            name: user?.jmeno ?? link.userId,
            roles: (user?.roles ?? []).map((role) => ROLE_LABELS.get(role) ?? role).join(", "),
          };
        }),
      },
    ];
  });

  const openConflictCount = pendingIdentityRows.filter((row) => row.approvedCandidates.length > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl ${UI_CLASSES.sectionTitle}`}>Admin</h1>
        <p className="text-slate-600">
          Mock přehled login identit: který účet je schválený pro přihlášení a které e-maily čekají
          ve stavu <code>pending</code>.
        </p>
      </div>

      <Card className="border-[#D9E4F2] bg-[#F8FBFF]">
        <CardHeader>
          <CardTitle className="text-[#05204A]">Zdroj dat</CardTitle>
          <CardDescription>
            Tato stránka běží čistě nad mock daty, nikoli nad produkčními záznamy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge className="border border-[#C9DBF2] bg-[#EAF2FF] text-[#0A4DA6] hover:bg-[#EAF2FF]">
            MOCK režim
          </Badge>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Uživatelé (mock)" value={String(userRows.length)} />
        <SummaryCard title="Login identity (mock)" value={String(MOCK_ADMIN_LOGIN_IDENTITIES.length)} />
        <SummaryCard title="Pending e-maily" value={String(pendingIdentityRows.length)} />
        <SummaryCard title="Otevřené konflikty" value={String(openConflictCount)} />
      </section>

      <Card className="border-[#D9E4F2]">
        <CardHeader>
          <CardTitle className="text-[#05204A]">Uživatelé a přihlašovací účty</CardTitle>
          <CardDescription>
            Sloupec „Může se přihlásit přes“ ukazuje schválené identity (<code>approved</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={UI_CLASSES.tableShell}>
            <Table>
              <TableHeader className={UI_CLASSES.tableHead}>
                <TableRow className="border-b border-[#D9E4F2]">
                  <TableHead>Uživatel</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Může se přihlásit přes</TableHead>
                  <TableHead>Pending e-maily</TableHead>
                  <TableHead>Stav účtu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-semibold text-[#05204A]">{row.name}</p>
                      <p className="text-xs text-slate-500">{row.email}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {row.roles.map((role) => (
                          <Badge
                            key={`${row.id}-${role}`}
                            className="border border-[#D8E3F5] bg-[#F8FBFF] text-[#0A4DA6] hover:bg-[#F8FBFF]"
                          >
                            {ROLE_LABELS.get(role) ?? role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.approvedIdentities.length === 0 ? (
                        <span className="text-slate-400">-</span>
                      ) : (
                        <div className="space-y-1">
                          {row.approvedIdentities.map((identity) => (
                            <p key={`${row.id}-${identity}`} className="font-mono text-xs text-[#05204A]">
                              {identity}
                            </p>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.pendingIdentities.length === 0 ? (
                        <span className="text-slate-400">-</span>
                      ) : (
                        <div className="space-y-1">
                          {row.pendingIdentities.map((identity) => (
                            <p key={`${row.id}-pending-${identity}`} className="font-mono text-xs text-[#A16207]">
                              {identity}
                            </p>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={USER_STATUS_BADGES[row.status]}>{USER_STATUS_LABELS[row.status]}</Badge>
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
          <CardTitle className="text-[#05204A]">Pending emailové adresy</CardTitle>
          <CardDescription>
            E-maily ve stavu <code>pending</code> čekající na rozhodnutí identity linku.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={UI_CLASSES.tableShell}>
            <Table>
              <TableHeader className={UI_CLASSES.tableHead}>
                <TableRow className="border-b border-[#D9E4F2]">
                  <TableHead>Email identity</TableHead>
                  <TableHead>Pending kandidáti</TableHead>
                  <TableHead>Už schváleno pro</TableHead>
                  <TableHead>Zdroj</TableHead>
                  <TableHead>Poslední změna</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingIdentityRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-mono text-xs text-[#05204A]">{row.identityValue}</p>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        {row.pendingCandidates.map((candidate) => (
                          <div key={`${row.id}-pending-${candidate.name}`}>
                            <div className="flex items-center gap-2">
                              <Badge className={IDENTITY_LINK_BADGES.pending}>pending</Badge>
                              <span className="text-sm text-[#05204A]">{candidate.name}</span>
                            </div>
                            <p className="text-xs text-slate-500">{candidate.roles}</p>
                            {candidate.reason && (
                              <p className="text-xs text-[#A16207]">{candidate.reason}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.approvedCandidates.length === 0 ? (
                        <span className="text-slate-400">-</span>
                      ) : (
                        <div className="space-y-2">
                          {row.approvedCandidates.map((candidate) => (
                            <div key={`${row.id}-approved-${candidate.name}`}>
                              <div className="flex items-center gap-2">
                                <Badge className={IDENTITY_LINK_BADGES.approved}>approved</Badge>
                                <span className="text-sm text-[#05204A]">{candidate.name}</span>
                              </div>
                              <p className="text-xs text-slate-500">{candidate.roles}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-700">{row.source}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-700">{formatDateTime(row.updatedAt)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="border-[#D9E4F2]">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
        <p className="mt-1 text-3xl font-semibold text-[#05204A]">{value}</p>
      </CardContent>
    </Card>
  );
}
