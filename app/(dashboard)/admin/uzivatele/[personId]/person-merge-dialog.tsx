"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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

import { formatPersonDisplayName } from "../format";

export type PersonMergeOption = {
  id: string;
  displayName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  nickname: string | null;
  identifier: string | null;
  plus4uId: string | null;
  isActive: boolean;
  roles: { role: string }[];
  sourceRecords: {
    sourceType: string;
    primaryEmail: string | null;
    organizationIdent: string | null;
    sourcePersonId: string | null;
    sourceRecordId: string | null;
  }[];
  loginLinks: {
    status: string;
    identity: { normalizedValue: string };
  }[];
};

function optionSearchText(person: PersonMergeOption): string {
  return [
    person.displayName,
    person.firstName,
    person.middleName,
    person.lastName,
    person.nickname,
    person.identifier,
    person.plus4uId,
    ...person.roles.map((role) => role.role),
    ...person.sourceRecords.flatMap((record) => [
      record.sourceType,
      record.primaryEmail,
      record.organizationIdent,
      record.sourcePersonId,
      record.sourceRecordId,
    ]),
    ...person.loginLinks.map((link) => link.identity.normalizedValue),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function optionMeta(person: PersonMergeOption): string {
  const email =
    person.loginLinks.find((link) => link.status === "approved")?.identity
      .normalizedValue ??
    person.sourceRecords.find((record) => record.primaryEmail)?.primaryEmail;
  const source = person.sourceRecords[0];
  return [
    person.roles.map((role) => role.role).join(", "),
    email,
    source?.sourceType,
    source?.organizationIdent ? `org ${source.organizationIdent}` : null,
    person.plus4uId ? `Plus4U ${person.plus4uId}` : null,
    person.identifier ? `ID ${person.identifier}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

export function PersonMergeDialog({
  currentPersonId,
  people,
}: {
  currentPersonId: string;
  people: PersonMergeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primaryPersonId, setPrimaryPersonId] = useState(currentPersonId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isSaving || isPending;
  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return people
      .filter((person) => person.id !== currentPersonId)
      .filter((person) => !query || optionSearchText(person).includes(query))
      .slice(0, 80);
  }, [currentPersonId, people, search]);

  const selectedPeople = useMemo(
    () =>
      uniqueIds([currentPersonId, ...selectedIds])
        .map((id) => peopleById.get(id))
        .filter((person): person is PersonMergeOption => Boolean(person)),
    [currentPersonId, peopleById, selectedIds],
  );

  function togglePerson(personId: string) {
    if (selectedIds.includes(personId)) {
      const nextSelectedIds = selectedIds.filter((id) => id !== personId);
      setSelectedIds(nextSelectedIds);
      if (primaryPersonId === personId) setPrimaryPersonId(currentPersonId);
      return;
    }
    setSelectedIds([...selectedIds, personId]);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    setError(null);
    if (nextOpen) {
      setSearch("");
      setSelectedIds([]);
      setPrimaryPersonId(currentPersonId);
      setReason("");
    }
  }

  async function handleSubmit() {
    setError(null);
    setIsSaving(true);
    const mergedPersonIds = uniqueIds([currentPersonId, ...selectedIds]).filter(
      (id) => id !== primaryPersonId,
    );

    try {
      const response = await fetch("/api/admin/person-merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryPersonId, mergedPersonIds, reason }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        primaryPersonId?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Sloučení se nepodařilo uložit.");
        return;
      }

      setOpen(false);
      startTransition(() => {
        router.push(
          `/admin/uzivatele/${payload.primaryPersonId ?? primaryPersonId}`,
        );
        router.refresh();
      });
    } finally {
      setIsSaving(false);
    }
  }

  const mergedPersonIds = uniqueIds([currentPersonId, ...selectedIds]).filter(
    (id) => id !== primaryPersonId,
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Sloučit osoby
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Sloučit osoby</DialogTitle>
          <DialogDescription>
            Vyberte duplicitní osoby a jednu primární osobu, do které se
            přesunou zdrojové záznamy, role, login identity, rodinné vazby a
            školní členství. Ostatní osoby zůstanou v historii jako sloučené a
            neaktivní.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">
                Najít duplicitní osobu
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Jméno, e-mail, identifikátor, Plus4U..."
                className="h-10 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
              />
            </label>
            <div className="max-h-96 overflow-y-auto rounded-[12px] border border-[#D6DFF0] bg-white">
              {filteredPeople.map((person) => (
                <label
                  key={person.id}
                  className="flex cursor-pointer items-start gap-2 border-b border-[#EEF2F8] px-3 py-2 last:border-b-0 hover:bg-[#F7FAFF]"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(person.id)}
                    onChange={() => togglePerson(person.id)}
                    className="mt-1 size-4 rounded border-[#D6DFF0] text-[#0E2A5C]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#0E2A5C]">
                      {formatPersonDisplayName(person)}
                    </span>
                    <span className="block text-xs text-[#7F88A0]">
                      {optionMeta(person)}
                    </span>
                  </span>
                </label>
              ))}
              {filteredPeople.length === 0 && (
                <div className="p-3 text-sm text-[#7F88A0]">Žádná shoda</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#4A5A7C]">
                  Primární osoba
                </span>
                <span className="text-xs text-[#7F88A0]">
                  {selectedPeople.length} osob v merge
                </span>
              </div>
              <div className="space-y-2">
                {selectedPeople.map((person) => (
                  <label
                    key={person.id}
                    className="flex cursor-pointer items-start gap-2 rounded-[12px] border border-[#D6DFF0] bg-white p-3"
                  >
                    <input
                      type="radio"
                      name="primaryPersonId"
                      checked={primaryPersonId === person.id}
                      onChange={() => setPrimaryPersonId(person.id)}
                      className="mt-1 size-4 border-[#D6DFF0] text-[#0E2A5C]"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[#0E2A5C]">
                        {formatPersonDisplayName(person)}
                      </span>
                      <span className="block text-xs text-[#7F88A0]">
                        {optionMeta(person)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-[12px] border border-[#D6DFF0] bg-[#F7FAFF] p-3 text-sm text-[#4A5A7C]">
              {mergedPersonIds.length > 0
                ? `Do primární osoby se sloučí ${mergedPersonIds.length} duplicitních osob.`
                : "Vyberte alespoň jednu další osobu ke sloučení."}
            </div>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#4A5A7C]">
                Důvod sloučení
              </span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Např. stejná osoba v Edookit zaměstnanci a CSV rodiči"
                className="w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 py-2 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="mx-4 rounded-[12px] border border-[#C8372D] bg-[#FAEAE9] p-3 text-sm text-[#A42A22]">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isBusy || mergedPersonIds.length === 0 || !reason.trim()}
          >
            {isBusy ? "Slučuji..." : "Sloučit osoby"}
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isBusy}>
              Zavřít
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
