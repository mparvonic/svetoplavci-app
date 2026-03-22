import { NextRequest, NextResponse } from "next/server";
import { syncAllTables, getSyncStatus } from "@/src/lib/coda-sync";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minut — nutné pro 40k řádků

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CODA_SYNC_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// POST /api/sync/coda — spustí sync
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const results = await syncAllTables();
  const totalMs = Date.now() - start;

  const errors = results.filter((r) => r.error);

  return NextResponse.json({
    ok: errors.length === 0,
    totalMs,
    results,
    ...(errors.length > 0 && { errors: errors.map((r) => `${r.table}: ${r.error}`) }),
  });
}

// GET /api/sync/coda — vrátí stav posledního syncu
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getSyncStatus();
  return NextResponse.json({ status });
}
