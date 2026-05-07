import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { adminSections } from "./admin-sections";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="sv-card p-6">
          <p className="sv-eyebrow text-[#C8372D]">Admin</p>
          <h1 className="sv-display-sm mt-2 text-[#0E2A5C]">Provozní správa školy</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Admin sekce je rozdělená podle domén: osoby, rodinné vazby, přístupy, synchronizace,
            kontrola dat a nastavení školního roku.
          </p>
        </div>

        <div className="sv-card border-[#0E2A5C] bg-[#0E2A5C] p-6 text-white">
          <p className="sv-eyebrow text-white/70">První krok</p>
          <p className="mt-2 text-sm font-semibold">
            Shell adminu a cílové stránky jsou připravené pro postupné doplňování funkcí.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.id} className="sv-card-hover">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Badge variant="outline">{section.eyebrow}</Badge>
                    <CardTitle>{section.label}</CardTitle>
                  </div>
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EEF2F7] text-[#0E2A5C]">
                    <Icon className="size-5" aria-hidden={true} />
                  </span>
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-[#4A5A7C]">{section.status}</p>
                <Button asChild variant="outline" size="sm" className="w-fit">
                  <Link href={section.href}>Otevřít</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roadmapa</CardTitle>
          <CardDescription>
            Detailní plán balíku je uložený v dokumentaci projektu.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-[#4A5A7C] sm:flex-row sm:items-center sm:justify-between">
          <p>Další implementační krok: read-only správa uživatelů a detail osoby.</p>
          <code className="w-fit rounded-[8px] border border-[#D6DFF0] bg-[#EEF2F7] px-3 py-1.5 text-xs text-[#0E2A5C]">
            docs/admin-roadmap.md
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
