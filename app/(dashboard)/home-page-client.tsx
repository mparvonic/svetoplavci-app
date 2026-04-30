"use client";

import { useEffect, useState } from "react";
import { HomeContent } from "./home-content";
import { SailboatLoading } from "@/components/sailboat-loading";

interface Child {
  rowId: string;
  name: string;
  nickname: string;
  rocnik: string;
  currentYear: string;
  group: string;
}

export function HomePageClient() {
  const [showSuccess, setShowSuccess] = useState(true);
  const [data, setData] = useState<{
    parent: { name: string; rowId: string };
    userEmail: string | null;
    children: Child[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/coda/my-children", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error ?? "Chyba")));
        return res.json();
      })
      .then((body) => {
        setData({
          parent: body.parent,
          userEmail: body.userEmail ?? null,
          children: body.children ?? [],
        });
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Nepodařilo se načíst data.");
        }
      });
    return () => controller.abort();
  }, []);

  // Skrýt hlášku o přihlášení po 4 s
  useEffect(() => {
    const t = setTimeout(() => setShowSuccess(false), 4000);
    return () => clearTimeout(t);
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        {showSuccess && (
          <div className="rounded-md border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200">
            Přihlášení proběhlo úspěšně.
          </div>
        )}
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200">
          Přihlášení proběhlo úspěšně.
        </div>
        <SailboatLoading message="Načítám data…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showSuccess && (
        <div
          className="rounded-md border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200"
          role="status"
        >
          Přihlášení proběhlo úspěšně.
        </div>
      )}
      <HomeContent
        parentName={data.parent.name}
        userEmail={data.userEmail ?? undefined}
        childrenList={data.children}
      />
    </div>
  );
}
