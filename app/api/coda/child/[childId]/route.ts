import { auth } from "@/src/lib/auth";
import { findParentByEmail, getChildrenOfParent } from "@/src/lib/coda";
import { NextResponse } from "next/server";

/**
 * GET /api/coda/child/[childId]
 * Vrátí detail dítěte. Ověří, že dítě patří přihlášenému rodiči.
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
        { error: "Přístup zamítnut. Váš email nebyl nalezen v systému." },
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

    return NextResponse.json(child);
  } catch (e) {
    console.error("[api/coda/child/[childId]]", e);
    return NextResponse.json(
      { error: "Nepodařilo se načíst data." },
      { status: 500 }
    );
  }
}
