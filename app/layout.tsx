import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "@/components/providers";
import { DevAppMenu } from "@/components/dev-app-menu";
import { DevAuthSelector } from "@/components/dev-auth-selector";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sv-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-sv-display",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sv-mono",
  display: "swap",
});

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
      <body className={`${plusJakarta.variable} ${instrumentSerif.variable} ${jetBrainsMono.variable} antialiased`}>
        <Providers>
          <TooltipProvider delayDuration={0}>
            <DevAppMenu />
            {children}
            <DevAuthSelector />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
