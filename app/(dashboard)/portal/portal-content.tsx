"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Child {
  rowId: string;
  name: string;
  nickname: string;
  rocnik: string;
  currentYear: string;
  group: string;
}

export function PortalContent({
  parentName,
  children,
}: {
  parentName: string;
  children: Child[];
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Přihlášen jako: <span className="font-medium text-foreground">{parentName}</span>
        </p>
      </header>

      <div>
        <h1 className="text-2xl font-bold tracking-normal">Výběr dítěte</h1>
        <p className="text-muted-foreground">
          Vyberte dítě pro zobrazení výsledků.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children.map((child) => (
          <Card key={child.rowId} className="flex flex-col">
            <CardHeader className="pb-2">
              <p className="text-xl font-semibold leading-tight">
                {child.nickname || child.name}
              </p>
              {child.nickname && (
                <p className="text-sm text-muted-foreground">{child.name}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {[child.currentYear, child.group].filter(Boolean).join(" · ") || "—"}
              </p>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
              <Button asChild className="w-full">
                <Link href={`/portal/dite/${child.rowId}`}>Zobrazit výsledky</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
