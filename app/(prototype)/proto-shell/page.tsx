import { Suspense } from "react";
import ProtoShellClient from "./proto-shell-client";
import { UI_CLASSES } from "@/src/lib/design-pack/ui";

export default function ProtoShellPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 py-8">
          <section className={UI_CLASSES.pageContainer}>
            <p className="text-sm text-slate-600">Načítám proto shell…</p>
          </section>
        </main>
      }
    >
      <ProtoShellClient />
    </Suspense>
  );
}
