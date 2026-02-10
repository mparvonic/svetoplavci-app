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
    if (process.env.AUTH_DEBUG === "1") {
      console.log("[api/my-children] no session or email", { sessionUser: session?.user });
    }
    return NextResponse.json(
      { error: "Nepřihlášen" },
      { status: 401 }
    );
  }

  try {
    const parent = await findParentByEmail(session.user.email);
    if (!parent) {
      if (process.env.AUTH_DEBUG === "1") {
        console.log("[api/my-children] parent not found in Coda", {
          email: session.user.email,
        });
      }
      return NextResponse.json(
        {
          error:
            "Přístup zamítnut. Váš e‑mail nebyl nalezen v systému. Zkontrolujte, zda používáte stejnou adresu jako v systému Edookit. Pokud chcete přidat přístup pro další e‑mail, obraťte se na kancelář školy (kancelar@svetoplavci.cz).",
        },
        { status: 403 }
      );
    }

    const children = await getChildrenOfParent(parent.rowId);
    if (process.env.AUTH_DEBUG === "1") {
      console.log("[api/my-children] success", {
        email: session.user.email,
        parentRowId: parent.rowId,
        parentName: parent.name,
        childrenCount: children.length,
        childNames: children.map((c) => c.name),
      });
    }
    return NextResponse.json({
      parent: { name: parent.name, rowId: parent.rowId },
      userEmail: session.user.email,
      children,
    });
  } catch (e) {
    console.error("[api/coda/my-children] error", e);
    return NextResponse.json(
      { error: "Nepodařilo se načíst data z Coda." },
      { status: 500 }
    );
  }
}
