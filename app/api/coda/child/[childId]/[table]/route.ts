import { auth } from "@/src/lib/auth";
import {
  findParentByEmail,
  getChildrenOfParent,
  getChildTableData,
} from "@/src/lib/mirror-db";
import type { TableId } from "@/src/types/coda";
import { NextResponse } from "next/server";

const ALLOWED_TABLES: TableId[] = [
  "table-RuXGEEn2z4",
  "table-1wVyfFAjX2",
  "table-oCLreazO22",
  "table-NbDPhMF4ci",
];

/**
 * GET /api/coda/child/[childId]/[table]
 * Vrátí data z tabulky pro dané dítě. Ověří, že dítě patří přihlášenému rodiči.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ childId: string; table: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  const { childId, table: tableParam } = await params;
  if (!childId || !tableParam) {
    return NextResponse.json(
      { error: "Chybí childId nebo table" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TABLES.includes(tableParam as TableId)) {
    return NextResponse.json({ error: "Neplatná tabulka" }, { status: 400 });
  }

  try {
    const parent = await findParentByEmail(session.user.email);
    if (!parent) {
      return NextResponse.json(
        { error: "Přístup zamítnut." },
        { status: 403 }
      );
    }

    const children = await getChildrenOfParent(parent.rowId);
    const child = children.find((c) => c.rowId === childId);
    if (!child) {
      return NextResponse.json(
        { error: "Toto dítě vám není přiřazeno." },
        { status: 403 }
      );
    }

    const rows = await getChildTableData(
      tableParam as TableId,
      child.rowId,
      child.name,
      child.nickname,
      child.rocnik
    );
    return NextResponse.json({ rows });
  } catch (e) {
    console.error("[api/coda/child/[childId]/[table]]", e);
    return NextResponse.json(
      { error: "Nepodařilo se načíst data z tabulky." },
      { status: 500 }
    );
  }
}
