import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { getPortalParentAndChildrenByEmail } from "@/src/lib/portal-db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  try {
    const context = await getPortalParentAndChildrenByEmail(session.user.email);
    if (!context) {
      return NextResponse.json({ error: "Přístup zamítnut." }, { status: 403 });
    }

    return NextResponse.json({
      parent: context.parent,
      userEmail: session.user.email,
      children: context.children,
    });
  } catch (error) {
    console.error("[api/m01/my-children]", error);
    return NextResponse.json({ error: "Nepodařilo se načíst děti." }, { status: 500 });
  }
}
