/**
 * Coda → PostgreSQL mirror sync
 *
 * Každá tabulka se synchronizuje jako celek (TRUNCATE + INSERT v transakci).
 * Během transakce PostgreSQL MVCC zajistí, že čtenáři vidí konzistentní data.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";

const CODA_API_BASE = "https://coda.io/apis/v1";
const BATCH_SIZE = 200;

interface SyncTableConfig {
  codaId: string;
  mirrorTable: string;
  displayName: string;
}

interface SyncResult {
  table: string;
  rows: number;
  durationMs: number;
  error?: string;
}

const SYNC_TABLES: SyncTableConfig[] = [
  {
    codaId: process.env.CODA_TABLE_SEZNAM_OSOB ?? "grid-PIwfgW7bQU",
    mirrorTable: "mirror_seznam_osob",
    displayName: "Seznam osob",
  },
  {
    codaId: "grid-3m-_XP8oMp",
    mirrorTable: "mirror_osobni_lodicky",
    displayName: "Osobní lodičky",
  },
  {
    codaId: "table-1wVyfFAjX2",
    mirrorTable: "mirror_lodicky_po_plavbach",
    displayName: "Lodičky po plavbách",
  },
  {
    codaId:
      process.env.CODA_TABLE_HODNOCENI_PREDMETU ?? "table-o85zm2oqc_",
    mirrorTable: "mirror_hodnoceni_predmetu",
    displayName: "Hodnocení předmětů",
  },
  {
    codaId:
      process.env.CODA_TABLE_HODNOCENI_OBLASTI ?? "table-TbzZTQK1dj",
    mirrorTable: "mirror_hodnoceni_oblasti",
    displayName: "Hodnocení oblastí",
  },
  {
    codaId: process.env.CODA_TABLE_CURVE ?? "grid-WRLBZgw4Vo",
    mirrorTable: "mirror_krivka",
    displayName: "Křivka",
  },
];

async function fetchAllRows(tableId: string): Promise<
  Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    values: Record<string, unknown>;
  }>
> {
  const docId = process.env.CODA_DOC_ID;
  const token = process.env.CODA_API_TOKEN;
  if (!docId || !token) throw new Error("CODA_DOC_ID nebo CODA_API_TOKEN není nastaven");

  const rows: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    values: Record<string, unknown>;
  }> = [];
  let pageToken: string | null = null;

  do {
    const params = new URLSearchParams({ limit: "500" });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `${CODA_API_BASE}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Coda API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    rows.push(...(data.items ?? []));
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);

  return rows;
}

async function syncOneTable(config: SyncTableConfig): Promise<SyncResult> {
  const start = Date.now();

  try {
    const rows = await fetchAllRows(config.codaId);

    // TRUNCATE + INSERT v transakci — čtenáři vidí stará data až do commitu
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE "${config.mirrorTable}"`);

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);

          const valueClauses = batch.map(
            (_, j) =>
              `($${j * 4 + 1}, $${j * 4 + 2}::timestamptz, $${j * 4 + 3}::timestamptz, NOW(), $${j * 4 + 4}::jsonb)`
          );

          const params: unknown[] = [];
          for (const row of batch) {
            params.push(
              row.id,
              row.createdAt,
              row.updatedAt,
              JSON.stringify(row.values)
            );
          }

          await tx.$executeRawUnsafe(
            `INSERT INTO "${config.mirrorTable}" (coda_row_id, coda_created_at, coda_updated_at, synced_at, data)
             VALUES ${valueClauses.join(", ")}`,
            ...params
          );
        }
      },
      { timeout: 120_000 }
    );

    const durationMs = Date.now() - start;

    await prisma.codaSyncLog.upsert({
      where: { tableId: config.codaId },
      update: {
        lastSyncedAt: new Date(),
        rowsSynced: rows.length,
        durationMs,
        lastError: null,
      },
      create: {
        tableId: config.codaId,
        tableName: config.displayName,
        lastSyncedAt: new Date(),
        rowsSynced: rows.length,
        durationMs,
      },
    });

    return { table: config.displayName, rows: rows.length, durationMs };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - start;

    await prisma.codaSyncLog.upsert({
      where: { tableId: config.codaId },
      update: { lastError: error, durationMs },
      create: {
        tableId: config.codaId,
        tableName: config.displayName,
        lastError: error,
        durationMs,
      },
    });

    return { table: config.displayName, rows: 0, durationMs, error };
  }
}

export async function syncAllTables(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  // Tabulky synkujeme sekvenčně — nechceme Coda API zahltit paralelními requesty
  for (const table of SYNC_TABLES) {
    results.push(await syncOneTable(table));
  }
  return results;
}

export async function getSyncStatus() {
  return prisma.codaSyncLog.findMany({ orderBy: { tableId: "asc" } });
}
