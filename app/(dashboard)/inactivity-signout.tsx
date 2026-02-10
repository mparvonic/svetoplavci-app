"use client";

import { useCallback, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minut

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"] as const;

export function InactivitySignOut({ children }: { children: React.ReactNode }) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    timeoutRef.current = setTimeout(() => {
      void signOut({ redirectTo: "/auth/signin?reason=inactivity" });
    }, INACTIVITY_MS);
  }, []);

  useEffect(() => {
    resetTimer();
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, resetTimer);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, resetTimer);
      }
    };
  }, [resetTimer]);

  return <>{children}</>;
}
