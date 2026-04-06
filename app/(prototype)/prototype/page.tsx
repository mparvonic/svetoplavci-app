import Link from "next/link";
import { ArrowRight, LayoutPanelTop, Paintbrush, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UI_CLASSES } from "@/src/lib/design-pack/ui";

const PROTOTYPE_PAGES = [
  {
    id: "proto-shell",
    title: "Proto shell",
    description:
      "Klikací role-based kostra aplikace: navigace, dashboard, lodičky a akce nad mock daty.",
    href: "/proto-shell",
    icon: LayoutPanelTop,
  },
  {
    id: "ui-redesign",
    title: "UI redesign",
    description: "Vizuální storyboard a redesign koncept pro hlavní obrazovky.",
    href: "/ui-redesign",
    icon: Paintbrush,
  },
  {
    id: "user-management",
    title: "Správa uživatelů",
    description: "Admin-only prototyp pro role, pozvánky a audit změn uživatelských účtů.",
    href: "/proto-shell/sprava-uzivatelu",
    icon: UserCog,
  },
];

export default function PrototypeIndexPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className={`${UI_CLASSES.pageContainer} space-y-6`}>
        <header>
          <h1 className="text-2xl font-semibold text-[#002060]">Prototype playground</h1>
          <p className="mt-1 text-sm text-slate-600">
            Přehled klikacích prototypů určených pro rychlé ověření UX před live implementací.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {PROTOTYPE_PAGES.map((page) => {
            const Icon = page.icon;
            return (
              <Card key={page.id} className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#002060]">
                    <Icon className="size-5" />
                    {page.title}
                  </CardTitle>
                  <CardDescription>{page.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="bg-[#002060] text-white hover:bg-[#001540]">
                    <Link href={page.href}>
                      Otevřít
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}
