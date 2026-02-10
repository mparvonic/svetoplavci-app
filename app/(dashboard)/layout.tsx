import { InactivitySignOut } from "./inactivity-signout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InactivitySignOut>
      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 shrink-0 items-center border-b px-4">
          <span className="text-sm font-semibold tracking-wide text-[#002060]">
            Školní aplikace Světoplavci
          </span>
        </header>
        <main className="flex-1 overflow-auto px-4 py-6">
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </InactivitySignOut>
  );
}
