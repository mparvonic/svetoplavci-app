import { signOutAction } from "./actions";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <span className="text-sm font-medium text-muted-foreground">
          Školní aplikace
        </span>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Odhlásit
          </Button>
        </form>
      </header>
      <main className="flex-1 overflow-auto p-4">{children}</main>
    </div>
  );
}
