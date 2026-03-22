import { auth } from "@/src/lib/auth";
import {
  findParentByEmail,
  getChildrenOfParent,
  getChildTableData,
} from "@/src/lib/mirror-db";
import type { CodaRow } from "@/src/lib/coda";
import { NextResponse } from "next/server";

/** Maximální doba běhu handleru (sekundy). */
export const maxDuration = 120;

/**
 * GET /api/coda/child/[childId]/data
 * Vrátí dítě a data pro Lodičky. Vysvědčení se načte až po kliknutí na záložku (GET /vysvedceni).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ childId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  const { childId } = await params;
  if (!childId) {
    return NextResponse.json({ error: "Chybí childId" }, { status: 400 });
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

    // Načítáme jen Lodičky – Vysvědčení se načte až po kliknutí na záložku (GET /vysvedceni).
    const tableData: Record<string, CodaRow[]> = {};
    const lodickyRows = await getChildTableData(
      "table-RuXGEEn2z4",
      child.rowId,
      child.name,
      child.nickname,
      child.rocnik
    );
    tableData["table-RuXGEEn2z4"] = lodickyRows;
    tableData["table-1wVyfFAjX2"] = lodickyRows;

    return NextResponse.json({ child, tableData });
  } catch (e) {
    console.error("[api/coda/child/[childId]/data]", e);
    const message = e instanceof Error ? e.message : "Nepodařilo se načíst data.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
