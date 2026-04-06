export type ProtoAdminRole =
  | "admin"
  | "zamestnanec"
  | "ucitel"
  | "rodic"
  | "zak"
  | "tester"
  | "proto";

export type ProtoUserStatus = "active" | "pending" | "blocked";

export type ProtoInviteStatus = "pending" | "accepted" | "expired" | "cancelled";

export type ProtoManagedUser = {
  id: string;
  jmeno: string;
  email: string;
  roles: ProtoAdminRole[];
  status: ProtoUserStatus;
  source: "google" | "magic-link";
  lastLoginAt: string | null;
  createdAt: string;
  linkedChildren: number;
};

export type ProtoUserInvite = {
  id: string;
  email: string;
  roles: ProtoAdminRole[];
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: ProtoInviteStatus;
};

export type ProtoUserAuditItem = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail?: string;
};

export const PROTO_ADMIN_ROLE_OPTIONS: Array<{ id: ProtoAdminRole; label: string; description: string }> = [
  { id: "admin", label: "Admin", description: "Plná správa uživatelů a systémových nastavení." },
  { id: "zamestnanec", label: "Zaměstnanec", description: "Provozní role pro interní tým." },
  { id: "ucitel", label: "Učitel", description: "Práce s výukou, třídami a hodnocením." },
  { id: "rodic", label: "Rodič", description: "Náhled na děti, jejich progres a komunikaci." },
  { id: "zak", label: "Žák", description: "Vlastní profil a osobní přehled." },
  { id: "tester", label: "Tester", description: "Ověřování změn ve staging prostředí." },
  { id: "proto", label: "Proto", description: "Přístup do prototypových částí aplikace." },
];

export const PROTO_USER_STATUS_OPTIONS: Array<{ id: ProtoUserStatus; label: string }> = [
  { id: "active", label: "Aktivní" },
  { id: "pending", label: "Čeká na aktivaci" },
  { id: "blocked", label: "Blokovaný" },
];

export const PROTO_MANAGED_USERS: ProtoManagedUser[] = [
  {
    id: "usr-001",
    jmeno: "Miroslav Parvonič",
    email: "miroslav.parvonic@gmail.com",
    roles: ["admin", "rodic", "proto"],
    status: "active",
    source: "google",
    lastLoginAt: "2026-04-06T07:42:00",
    createdAt: "2025-12-19T10:00:00",
    linkedChildren: 2,
  },
  {
    id: "usr-002",
    jmeno: "Barbora Nováková",
    email: "barbora.novakova@svetoplavci.cz",
    roles: ["admin", "zamestnanec"],
    status: "active",
    source: "google",
    lastLoginAt: "2026-04-05T16:30:00",
    createdAt: "2026-01-04T08:45:00",
    linkedChildren: 0,
  },
  {
    id: "usr-003",
    jmeno: "Kateřina Parvonič",
    email: "katerina.parvonic@svetoplavci.cz",
    roles: ["ucitel", "tester"],
    status: "active",
    source: "google",
    lastLoginAt: "2026-04-05T13:12:00",
    createdAt: "2025-11-28T15:20:00",
    linkedChildren: 0,
  },
  {
    id: "usr-004",
    jmeno: "Tomáš Vrbka",
    email: "tomas.vrbka@svetoplavci.cz",
    roles: ["ucitel"],
    status: "active",
    source: "magic-link",
    lastLoginAt: "2026-04-04T11:05:00",
    createdAt: "2025-11-28T15:22:00",
    linkedChildren: 0,
  },
  {
    id: "usr-005",
    jmeno: "Anna Durková",
    email: "anna.durkova@svetoplavci.cz",
    roles: ["rodic"],
    status: "active",
    source: "magic-link",
    lastLoginAt: "2026-04-02T19:10:00",
    createdAt: "2026-02-09T09:40:00",
    linkedChildren: 1,
  },
  {
    id: "usr-006",
    jmeno: "Michal Sicouret",
    email: "michal.sicouret@svetoplavci.cz",
    roles: ["rodic"],
    status: "active",
    source: "magic-link",
    lastLoginAt: "2026-03-31T20:15:00",
    createdAt: "2026-02-09T09:41:00",
    linkedChildren: 2,
  },
  {
    id: "usr-007",
    jmeno: "Vendula Machová",
    email: "vendula.machova@svetoplavci.cz",
    roles: ["zak"],
    status: "active",
    source: "magic-link",
    lastLoginAt: "2026-04-03T07:50:00",
    createdAt: "2026-02-21T12:00:00",
    linkedChildren: 0,
  },
  {
    id: "usr-008",
    jmeno: "Externí QA účet",
    email: "qa.partner@example.org",
    roles: ["tester"],
    status: "pending",
    source: "magic-link",
    lastLoginAt: null,
    createdAt: "2026-04-01T08:20:00",
    linkedChildren: 0,
  },
  {
    id: "usr-009",
    jmeno: "Dočasný proto účet",
    email: "proto.user@svetoplavci.cz",
    roles: ["proto"],
    status: "pending",
    source: "google",
    lastLoginAt: null,
    createdAt: "2026-03-27T14:30:00",
    linkedChildren: 0,
  },
  {
    id: "usr-010",
    jmeno: "Neplatný test účet",
    email: "deprecated.user@svetoplavci.cz",
    roles: ["tester"],
    status: "blocked",
    source: "google",
    lastLoginAt: "2026-01-16T12:25:00",
    createdAt: "2025-10-10T09:00:00",
    linkedChildren: 0,
  },
];

export const PROTO_USER_INVITES: ProtoUserInvite[] = [
  {
    id: "inv-001",
    email: "novy.ucitel@svetoplavci.cz",
    roles: ["ucitel", "proto"],
    invitedBy: "Miroslav Parvonič",
    invitedAt: "2026-04-05T09:10:00",
    expiresAt: "2026-04-12T09:10:00",
    status: "pending",
  },
  {
    id: "inv-002",
    email: "rodic.berta@gmail.com",
    roles: ["rodic"],
    invitedBy: "Barbora Nováková",
    invitedAt: "2026-03-30T17:40:00",
    expiresAt: "2026-04-06T17:40:00",
    status: "expired",
  },
  {
    id: "inv-003",
    email: "tester.staging@svetoplavci.cz",
    roles: ["tester"],
    invitedBy: "Barbora Nováková",
    invitedAt: "2026-04-02T11:30:00",
    expiresAt: "2026-04-09T11:30:00",
    status: "accepted",
  },
  {
    id: "inv-004",
    email: "externista@agency.example",
    roles: ["proto"],
    invitedBy: "Miroslav Parvonič",
    invitedAt: "2026-03-25T08:05:00",
    expiresAt: "2026-04-01T08:05:00",
    status: "cancelled",
  },
];

export const PROTO_USER_AUDIT: ProtoUserAuditItem[] = [
  {
    id: "aud-001",
    at: "2026-04-06T08:03:00",
    actor: "Miroslav Parvonič",
    action: "Přidal roli admin",
    target: "Barbora Nováková",
    detail: "Kvůli zastupitelnosti během synchronizace dat.",
  },
  {
    id: "aud-002",
    at: "2026-04-05T18:14:00",
    actor: "Barbora Nováková",
    action: "Poslal pozvánku",
    target: "novy.ucitel@svetoplavci.cz",
  },
  {
    id: "aud-003",
    at: "2026-04-04T09:42:00",
    actor: "Miroslav Parvonič",
    action: "Zablokoval účet",
    target: "deprecated.user@svetoplavci.cz",
    detail: "Neplatný test účet po skončení pilotu.",
  },
  {
    id: "aud-004",
    at: "2026-04-03T16:19:00",
    actor: "Barbora Nováková",
    action: "Změnil role",
    target: "Kateřina Parvonič",
    detail: "Přidána role tester.",
  },
  {
    id: "aud-005",
    at: "2026-04-02T12:05:00",
    actor: "Miroslav Parvonič",
    action: "Vynutil odhlášení",
    target: "Externí QA účet",
  },
];
