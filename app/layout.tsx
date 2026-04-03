import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Školní aplikace",
  description: "Aplikace pro školu – portál, admin, kiosk",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className="antialiased">
        <Providers>
          <TooltipProvider delayDuration={0}>
            {children}
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
