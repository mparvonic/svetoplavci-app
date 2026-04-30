import { InactivitySignOut } from "./inactivity-signout";
import { signOutAction } from "./actions";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InactivitySignOut>
      <div className="flex min-h-screen flex-col bg-[#EEF2F7]">
        <header className="shrink-0 border-b border-[#D6DFF0] bg-white/95 backdrop-blur">
          <div className="app-page-container flex h-16 items-center justify-between gap-3">
            <div>
              <span className="sv-eyebrow">Školní aplikace</span>
              <div className="text-sm font-semibold text-[#0E2A5C]">Světoplavci</div>
            </div>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Odhlásit se
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="app-page-container space-y-6 py-6">{children}</div>
        </main>
      </div>
    </InactivitySignOut>
  );
}
