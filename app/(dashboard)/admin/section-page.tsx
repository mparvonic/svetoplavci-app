import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { getAdminSection, type AdminSectionId } from "./admin-sections";

export function AdminSectionPage({ sectionId }: { sectionId: AdminSectionId }) {
  const section = getAdminSection(sectionId);
  const Icon = section.icon;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="sv-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="sv-eyebrow text-[#C8372D]">{section.eyebrow}</p>
              <h1 className="sv-display-sm text-[#0E2A5C]">{section.title}</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">{section.description}</p>
            </div>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EEF2F7] text-[#0E2A5C]">
              <Icon className="size-5" aria-hidden={true} />
            </span>
          </div>
        </div>

        <div className="sv-card border-[#0E2A5C] bg-[#0E2A5C] p-6 text-white">
          <p className="sv-eyebrow text-white/70">Stav</p>
          <p className="mt-2 text-sm font-semibold">{section.status}</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>První verze</CardTitle>
            <CardDescription>Nejbližší funkční rozsah pro tuto část adminu.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-[#4A5A7C]">
              {section.mvpItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#C8372D]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budoucí role</CardTitle>
            <CardDescription>Připravenost na jemnější oprávnění.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="outline">{section.futureRole}</Badge>
            <p className="text-sm text-[#4A5A7C]">
              Zatím bude stránka chráněná rolí <span className="font-semibold text-[#0E2A5C]">admin</span>.
              API a UI ale budeme navrhovat tak, aby šlo oprávnění později oddělit.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kontext</CardTitle>
            <CardDescription>Vztah k celkovému plánu admin sekce.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[#4A5A7C]">
            <p>
              Cílový postup je uložený v dokumentaci projektu. Tato stránka je zatím shell pro další
              implementační krok.
            </p>
            <Link href="/admin" className="font-semibold text-[#0E2A5C] hover:text-[#C8372D]">
              Zpět na admin přehled
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
