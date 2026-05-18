import { NextResponse } from "next/server";

import { getApiSessionContext } from "@/src/lib/api/session";
import { getRvpGraphOverview } from "@/src/lib/m01/rvp-graph";

const RVP_GRAPH_ROLES = new Set(["admin", "spravce_flotily", "spravce_lodicek"]);

function canReadRvpGraph(roles: string[]) {
  return roles.some((role) => RVP_GRAPH_ROLES.has(role.trim().toLowerCase()));
}

export async function GET(req: Request) {
  const context = await getApiSessionContext(req);
  if (!context) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }
  if (!canReadRvpGraph(context.roles)) {
    return NextResponse.json({ error: "Přístup zamítnut." }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const svpVersionId = (url.searchParams.get("svp") ?? "").trim();
    const q = (url.searchParams.get("q") ?? "").trim();
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "80", 10);
    const limit = Number.isInteger(rawLimit) ? rawLimit : 80;
    const overview = await getRvpGraphOverview({ svpVersionId, q, limit });

    return NextResponse.json(overview);
  } catch (error) {
    console.error("[api/m01/rvp/graph]", error);
    return NextResponse.json({ error: "Nepodařilo se načíst RVP graf." }, { status: 500 });
  }
}
