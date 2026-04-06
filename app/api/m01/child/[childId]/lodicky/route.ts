import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { getPortalChildLodickyByEmail } from "@/src/lib/portal-db";

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
    const result = await getPortalChildLodickyByEmail(session.user.email, childId);
    if (!result) {
      return NextResponse.json({ error: "Toto dítě vám není přiřazeno." }, { status: 403 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/m01/child/[childId]/lodicky]", error);
    return NextResponse.json({ error: "Nepodařilo se načíst osobní lodičky." }, { status: 500 });
  }
}
