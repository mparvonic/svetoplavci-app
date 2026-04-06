import { Suspense } from "react";
import OsobniLodickyClient from "./osobni-lodicky-client";
import { UI_CLASSES } from "@/src/lib/design-pack/ui";

export default function OsobniLodickyPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50">
          <section className={`${UI_CLASSES.pageContainer} py-6`}>
            <p className="text-sm text-slate-600">Načítám osobní lodičky…</p>
          </section>
        </main>
      }
    >
      <OsobniLodickyClient />
    </Suspense>
  );
}
