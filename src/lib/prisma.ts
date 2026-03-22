import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const connectionString = process.env.POSTGRES_PRISMA_URL;
  if (!connectionString) throw new Error("POSTGRES_PRISMA_URL is not set");
  const pool = new Pool({ connectionString, max: 3 });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

// Lazy proxy — PrismaClient sa vytvorí až pri prvom dotaze, nie pri importe
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return getClient()[prop as keyof PrismaClient];
  },
});
