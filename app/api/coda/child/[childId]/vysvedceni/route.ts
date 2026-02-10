import { auth } from "@/src/lib/auth";
import { findParentByEmail, getChildrenOfParent, getChildTableData } from "@/src/lib/coda";
import type { CodaRow } from "@/src/lib/coda";
import { NextResponse } from "next/server";

export const maxDuration = 120;

const TABLE_HODNOCENI_PREDMETU = process.env.CODA_TABLE_HODNOCENI_PREDMETU ?? "table-oCLreazO22";
const TABLE_HODNOCENI_OBLASTI = process.env.CODA_TABLE_HODNOCENI_OBLASTI ?? "table-NbDPhMF4ci";

/**
 * GET /api/coda/child/[childId]/vysvedceni
 * Načte pouze data pro záložku Vysvědčení (Hodnocení předmětů + Hodnocení oblastí).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const { childId } = await params;
    if (!childId) {
      return NextResponse.json({ error: "Chybí childId" }, { status: 400 });
    }

    const parent = await findParentByEmail(session.user.email);
    if (!parent) {
      return NextResponse.json({ error: "Přístup zamítnut." }, { status: 403 });
    }

    const children = await getChildrenOfParent(parent.rowId);
    const child = children.find((c) => c.rowId === childId);
    if (!child) {
      return NextResponse.json(
        { error: "Toto dítě vám není přiřazeno." },
        { status: 403 }
      );
    }

    // Paralelní načtení obou tabulek místo sekvenčního
    const [predmetuResult, oblastiResult] = await Promise.allSettled([
      getChildTableData(
        TABLE_HODNOCENI_PREDMETU,
        child.rowId,
        child.name,
        child.nickname,
        child.rocnik
      ),
      getChildTableData(
        TABLE_HODNOCENI_OBLASTI,
        child.rowId,
        child.name,
        child.nickname,
        child.rocnik
      ),
    ]);

    const predmetuRows: CodaRow[] =
      predmetuResult.status === "fulfilled" ? predmetuResult.value : [];
    const oblastiRows: CodaRow[] =
      oblastiResult.status === "fulfilled" ? oblastiResult.value : [];

    if (predmetuResult.status === "rejected") {
      console.error("[api/coda/child/[childId]/vysvedceni] Hodnocení předmětů:", predmetuResult.reason);
    }
    if (oblastiResult.status === "rejected") {
      console.error("[api/coda/child/[childId]/vysvedceni] Hodnocení oblastí:", oblastiResult.reason);
    }

    return NextResponse.json({
      predmetu: predmetuRows,
      oblasti: oblastiRows,
    });
  } catch (e) {
    console.error("[api/coda/child/[childId]/vysvedceni]", e);
    const message = e instanceof Error ? e.message : "Nepodařilo se načíst vysvědčení.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
