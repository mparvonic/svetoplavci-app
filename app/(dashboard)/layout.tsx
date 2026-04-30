import { InactivitySignOut } from "./inactivity-signout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InactivitySignOut>
      <div className="flex min-h-screen flex-col bg-[#EEF2F7]">
        <main className="flex-1 overflow-auto">
          <div className="app-page-container space-y-6 py-6">{children}</div>
        </main>
      </div>
    </InactivitySignOut>
  );
}
