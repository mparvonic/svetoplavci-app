export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#030b1d]">
      <div className="relative h-[720px] w-[1280px] overflow-hidden rounded-[28px] border border-white/10 bg-[#071538] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        {children}
      </div>
    </div>
  );
}
