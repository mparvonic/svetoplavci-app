import { auth } from "@/src/lib/auth";
import { findParentByEmail, getChildrenOfParent } from "@/src/lib/coda";
import { NextResponse } from "next/server";

/**
 * GET /api/coda/my-children
 * Vrátí seznam dětí přihlášeného rodiče. Pouze pro přihlášené uživatele.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Nepřihlášen" },
      { status: 401 }
    );
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
    return NextResponse.json({
      parent: { name: parent.name, rowId: parent.rowId },
      userEmail: session.user.email,
      children,
    });
  } catch (e) {
    console.error("[api/coda/my-children]", e);
    return NextResponse.json(
      { error: "Nepodařilo se načíst data z Coda." },
      { status: 500 }
    );
  }
}
