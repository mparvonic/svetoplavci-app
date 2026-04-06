export type MockLoginIdentitySource = "edookit" | "manual" | "csv-sync";

export type MockIdentityLinkStatus = "approved" | "pending" | "rejected";

export type MockLoginIdentity = {
  id: string;
  identityType: "email";
  identityValue: string;
  normalizedValue: string;
  isActive: boolean;
  source: MockLoginIdentitySource;
  updatedAt: string;
  links: Array<{
    userId: string;
    status: MockIdentityLinkStatus;
    reason?: string;
  }>;
};

export const MOCK_ADMIN_LOGIN_IDENTITIES: MockLoginIdentity[] = [
  {
    id: "idn-001",
    identityType: "email",
    identityValue: "miroslav.parvonic@gmail.com",
    normalizedValue: "miroslav.parvonic@gmail.com",
    isActive: true,
    source: "edookit",
    updatedAt: "2026-04-06T08:42:00",
    links: [{ userId: "usr-001", status: "approved" }],
  },
  {
    id: "idn-002",
    identityType: "email",
    identityValue: "barbora.novakova@svetoplavci.cz",
    normalizedValue: "barbora.novakova@svetoplavci.cz",
    isActive: true,
    source: "edookit",
    updatedAt: "2026-04-06T08:40:00",
    links: [{ userId: "usr-002", status: "approved" }],
  },
  {
    id: "idn-003",
    identityType: "email",
    identityValue: "katerina.parvonic@svetoplavci.cz",
    normalizedValue: "katerina.parvonic@svetoplavci.cz",
    isActive: true,
    source: "edookit",
    updatedAt: "2026-04-05T17:05:00",
    links: [{ userId: "usr-003", status: "approved" }],
  },
  {
    id: "idn-004",
    identityType: "email",
    identityValue: "tomas.vrbka@svetoplavci.cz",
    normalizedValue: "tomas.vrbka@svetoplavci.cz",
    isActive: true,
    source: "edookit",
    updatedAt: "2026-04-05T16:11:00",
    links: [{ userId: "usr-004", status: "approved" }],
  },
  {
    id: "idn-005",
    identityType: "email",
    identityValue: "anna.durkova@svetoplavci.cz",
    normalizedValue: "anna.durkova@svetoplavci.cz",
    isActive: true,
    source: "edookit",
    updatedAt: "2026-04-04T20:09:00",
    links: [{ userId: "usr-005", status: "approved" }],
  },
  {
    id: "idn-006",
    identityType: "email",
    identityValue: "michal.sicouret@svetoplavci.cz",
    normalizedValue: "michal.sicouret@svetoplavci.cz",
    isActive: true,
    source: "edookit",
    updatedAt: "2026-04-04T20:07:00",
    links: [{ userId: "usr-006", status: "approved" }],
  },
  {
    id: "idn-007",
    identityType: "email",
    identityValue: "vendula.machova@svetoplavci.cz",
    normalizedValue: "vendula.machova@svetoplavci.cz",
    isActive: true,
    source: "manual",
    updatedAt: "2026-04-03T08:00:00",
    links: [{ userId: "usr-007", status: "approved" }],
  },
  {
    id: "idn-008",
    identityType: "email",
    identityValue: "novy.ucitel@svetoplavci.cz",
    normalizedValue: "novy.ucitel@svetoplavci.cz",
    isActive: true,
    source: "manual",
    updatedAt: "2026-04-05T09:10:00",
    links: [{ userId: "usr-003", status: "pending", reason: "čeká na schválení identity linku" }],
  },
  {
    id: "idn-009",
    identityType: "email",
    identityValue: "qa.partner@example.org",
    normalizedValue: "qa.partner@example.org",
    isActive: true,
    source: "manual",
    updatedAt: "2026-04-01T08:20:00",
    links: [{ userId: "usr-008", status: "pending", reason: "čeká na první přihlášení" }],
  },
  {
    id: "idn-010",
    identityType: "email",
    identityValue: "rodina.sicouret@centrum.cz",
    normalizedValue: "rodina.sicouret@centrum.cz",
    isActive: true,
    source: "csv-sync",
    updatedAt: "2026-04-06T07:55:00",
    links: [
      { userId: "usr-006", status: "approved" },
      { userId: "usr-005", status: "pending", reason: "duplicitní vazba – čeká na rozhodnutí admina" },
    ],
  },
  {
    id: "idn-011",
    identityType: "email",
    identityValue: "deprecated.user@svetoplavci.cz",
    normalizedValue: "deprecated.user@svetoplavci.cz",
    isActive: false,
    source: "manual",
    updatedAt: "2026-04-04T09:42:00",
    links: [{ userId: "usr-010", status: "approved", reason: "účet je blokovaný" }],
  },
];
