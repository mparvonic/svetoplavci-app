"use client";

import { cn } from "@/lib/utils";

interface SailboatLoadingProps {
  className?: string;
  /** Text pod plachetnicí (např. "Načítám data…", "Načítám vysvědčení…") */
  message?: string;
}

/**
 * Animace plachetnice na vlnách – modrý trup, červená plachta. Zobrazuje se při načítání dat (Lodičky i Vysvědčení).
 */
export function SailboatLoading({ className, message = "Načítám data…" }: SailboatLoadingProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-6 py-12 text-center",
        className
      )}
      aria-hidden
    >
      <div className="relative flex h-40 w-full max-w-[14rem] items-end justify-center">
        {/* Vlny – širší než plachetnice, překrývají trup */}
        <svg
          className="absolute bottom-0 left-1/2 z-10 h-24 w-40 -translate-x-1/2 text-blue-400/50 dark:text-blue-500/40"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 28 Q12 16 24 28 T48 28 V48 H0 Z"
            className="animate-wave origin-bottom"
            fill="currentColor"
          />
          <path
            d="M0 34 Q16 20 24 34 T48 34 V48 H0 Z"
            className="animate-wave-slow origin-bottom"
            fill="currentColor"
            style={{ animationDelay: "300ms" }}
          />
        </svg>
        {/* Plachetnice – modrý trup, červená plachta, vycentrovaná, dvojnásobná velikost */}
        <svg
          className="absolute bottom-4 left-1/2 z-0 h-32 w-32 -translate-x-1/2 animate-sail"
          viewBox="0 0 48 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform="translate(10,0)">
            {/* Trup (modrý) */}
            <path
              d="M8 52 L16 62 L36 62 L44 52 L40 52 L24 52 L12 52 Z"
              fill="#2563eb"
              className="dark:fill-blue-600"
            />
            {/* Plachta (červená) */}
            <path
              d="M24 62 L24 14 L40 32 L24 50 Z"
              fill="#dc2626"
              className="dark:fill-red-600"
            />
            {/* Stěžeň */}
            <line
              x1="24"
              y1="62"
              x2="24"
              y2="12"
              stroke="#1e40af"
              strokeWidth="2"
              className="dark:stroke-blue-700"
            />
          </g>
        </svg>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
