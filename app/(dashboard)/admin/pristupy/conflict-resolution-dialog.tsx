"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type AccessConflictCandidate = {
  personId: string;
  displayName: string;
  status: string;
  roles: string[];
};

export type AccessConflictSummary = {
  id: string;
  reason: string;
  createdAt: string;
};

export function ConflictResolutionDialog({
  identityId,
  email,
  conflicts,
  candidates,
}: {
  identityId: string;
  email: string;
  conflicts: AccessConflictSummary[];
  candidates: AccessConflictCandidate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isSaving || isPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);
    const selectedPersonId = String(formData.get("personId") ?? "").trim();
    if (!selectedPersonId) {
      setError("Vyberte jednu osobu, která má mít tento login povolený.");
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/users/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityId, approvedPersonIds: [selectedPersonId] }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Konflikt se nepodařilo uložit.");
        return;
      }

      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="xs" aria-label={`Vyřešit konflikt loginu ${email}`}>
          {conflicts.length} otevřeno
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Vyřešit konflikt loginu</DialogTitle>
          <DialogDescription>Vyberte jednu osobu, která má mít povolený přístup přes {email}.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4">
          <div className="rounded-[12px] border border-[#D6DFF0] bg-[#EEF2F7] p-3 text-sm text-[#4A5A7C]">
            <div className="font-semibold text-[#0E2A5C]">{email}</div>
            <div className="mt-1">
              {conflicts.map((conflict) => (
                <div key={conflict.id}>
                  {conflict.reason} · {new Intl.DateTimeFormat("cs-CZ", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(conflict.createdAt))}
                </div>
              ))}
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-[#0E2A5C]">Kandidáti</legend>
            {candidates.map((candidate) => (
              <label
                key={candidate.personId}
                className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-[#D6DFF0] bg-white p-3 transition hover:bg-[#EEF2F7]"
              >
                <input
                  name="personId"
                  value={candidate.personId}
                  type="radio"
                  defaultChecked={candidate.status === "approved"}
                  className="mt-1 size-4 accent-[#0E2A5C]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[#0E2A5C]">{candidate.displayName}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant={candidate.status === "approved" ? "secondary" : "outline"}>
                      {candidate.status}
                    </Badge>
                    {candidate.roles.length === 0 ? (
                      <Badge variant="outline">bez role</Badge>
                    ) : (
                      candidate.roles.map((role) => (
                        <Badge key={role} variant="outline">
                          {role}
                        </Badge>
                      ))
                    )}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <p className="text-xs text-[#7F88A0]">
            Login identita může být schválená právě pro jednu osobu. Vazbu rodič-dítě řeší rodinné vazby,
            ne druhé schválení stejného loginu.
          </p>

          {error && (
            <div className="rounded-[12px] border border-[#C8372D] bg-[#FAEAE9] p-3 text-sm text-[#A42A22]">
              {error}
            </div>
          )}

          <DialogFooter className="px-0">
            <Button type="submit" disabled={isBusy}>
              {isBusy ? "Ukládám..." : "Uložit řešení"}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isBusy}>
                Zavřít
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
