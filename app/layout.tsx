import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Školní aplikace",
  description: "Aplikace pro školu – portál, admin, kiosk",
};

const isProtoRuntime = process.env.APP_RUNTIME_MODE === "proto";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {isProtoRuntime ? (
          <TooltipProvider delayDuration={0}>
            {children}
          </TooltipProvider>
        ) : (
          <Providers>
            <TooltipProvider delayDuration={0}>
              {children}
            </TooltipProvider>
          </Providers>
        )}
      </body>
    </html>
  );
}
