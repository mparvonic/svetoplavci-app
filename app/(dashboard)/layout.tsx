import { InactivitySignOut } from "./inactivity-signout";
import { signOutAction } from "./actions";
import { Button } from "@/components/ui/button";
import { UI_CLASSES } from "@/src/lib/design-pack/ui";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InactivitySignOut>
      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
          <span className="text-sm font-semibold tracking-wide text-[#002060]">
            Školní aplikace Světoplavci
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Odhlásit se
            </Button>
          </form>
        </header>
        <main className="flex-1 overflow-auto px-4 py-6">
          <div className={`${UI_CLASSES.pageContainer} space-y-6`}>{children}</div>
        </main>
      </div>
    </InactivitySignOut>
  );
}
