import { NextResponse } from "next/server";

import { getApiSessionContext } from "@/src/lib/api/session";
import { searchM01SemanticOvuCandidates } from "@/src/lib/m01/semantic-search";

const RVP_SEMANTIC_ROLES = new Set(["admin", "spravce_flotily", "spravce_lodicek"]);

function canReadSemanticLayer(roles: string[]) {
  return roles.some((role) => RVP_SEMANTIC_ROLES.has(role.trim().toLowerCase()));
}

function isSemanticIndexUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = error.cause;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause ? String((cause as { code?: unknown }).code ?? "") : "";
  return causeCode === "ECONNREFUSED" || error.message.includes("Qdrant search failed") || error.message.includes("fetch failed");
}

export async function GET(req: Request) {
  const context = await getApiSessionContext(req);
  if (!context) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }
  if (!canReadSemanticLayer(context.roles)) {
    return NextResponse.json({ error: "Přístup zamítnut." }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const lodickaId = (url.searchParams.get("lodickaId") ?? "").trim();
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "10", 10);
    const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 30) : 10;
    if (!lodickaId) {
      return NextResponse.json({ error: "Chybí lodickaId." }, { status: 400 });
    }

    const result = await searchM01SemanticOvuCandidates({ lodickaId, limit });
    if (!result) {
      return NextResponse.json({ error: "Lodička není v knowledge korpusu." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (isSemanticIndexUnavailable(error)) {
      return NextResponse.json({ error: "Semantický index není dostupný." }, { status: 503 });
    }
    console.error("[api/m01/rvp/semantic]", error);
    return NextResponse.json({ error: "Nepodařilo se načíst semantické kandidáty." }, { status: 500 });
  }
}
