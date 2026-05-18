"use client";

import { useEffect } from "react";

type SvpDraftCleanupBeaconProps = {
  svpVersionId: string;
};

export function SvpDraftCleanupBeacon({ svpVersionId }: SvpDraftCleanupBeaconProps) {
  useEffect(() => {
    let submitted = false;

    function markSubmitted() {
      submitted = true;
    }

    function cleanupDraft() {
      if (submitted) return;
      const body = JSON.stringify({ svpVersionId });
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/m01/lodicky/sprava/draft-cleanup", blob);
    }

    document.addEventListener("submit", markSubmitted, true);
    window.addEventListener("pagehide", cleanupDraft);
    return () => {
      document.removeEventListener("submit", markSubmitted, true);
      window.removeEventListener("pagehide", cleanupDraft);
    };
  }, [svpVersionId]);

  return null;
}
