"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
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

import { formatPersonDisplayName } from "../uzivatele/format";

export type RelationPersonOption = {
  id: string;
  displayName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  nickname: string | null;
  sourceRecords: { primaryEmail: string | null }[];
  loginLinks: { identity: { normalizedValue: string } }[];
  parentLinks: { childPersonId: string }[];
  childLinks: { parentPersonId: string }[];
};

function optionLabel(person: RelationPersonOption): string {
  const email =
    person.loginLinks[0]?.identity.normalizedValue ??
    person.sourceRecords.find((record) => record.primaryEmail)?.primaryEmail;
  return [formatPersonDisplayName(person), person.nickname, email]
    .filter(Boolean)
    .join(" · ");
}

function optionSearchText(person: RelationPersonOption): string {
  return [
    person.displayName,
    person.firstName,
    person.middleName,
    person.lastName,
    person.nickname,
    ...person.sourceRecords.map((record) => record.primaryEmail),
    ...person.loginLinks.map((link) => link.identity.normalizedValue),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function uniqueIds(ids: string[] | undefined): string[] {
  return Array.from(
    new Set((ids ?? []).map((id) => id.trim()).filter(Boolean)),
  );
}

function PersonMultiSelect({
  label,
  people,
  selectedIds,
  onTogglePerson,
  search,
  onSearchChange,
}: {
  label: string;
  people: RelationPersonOption[];
  selectedIds: string[];
  onTogglePerson: (personId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return people;
    return people.filter((person) => optionSearchText(person).includes(query));
  }, [people, search]);
  const selectedPeople = useMemo(
    () => people.filter((person) => selectedIdSet.has(person.id)),
    [people, selectedIdSet],
  );

  function togglePerson(personId: string) {
    onTogglePerson(personId);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#4A5A7C]">{label}</span>
        <span className="text-xs text-[#7F88A0]">
          {selectedIds.length} vybráno
        </span>
      </div>
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Zúžit seznam..."
        className="h-9 w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
      />
      {selectedPeople.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedPeople.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => togglePerson(person.id)}
              className="rounded-full border border-[#D6DFF0] bg-[#F7FAFF] px-2.5 py-1 text-xs font-semibold text-[#0E2A5C] hover:border-[#C8372D] hover:text-[#C8372D]"
            >
              {formatPersonDisplayName(person)} ×
            </button>
          ))}
        </div>
      )}
      <div className="max-h-64 overflow-y-auto rounded-[12px] border border-[#D6DFF0] bg-white">
        {filteredPeople.map((person) => (
          <label
            key={person.id}
            className="flex cursor-pointer items-start gap-2 border-b border-[#EEF2F8] px-3 py-2 last:border-b-0 hover:bg-[#F7FAFF]"
          >
            <input
              type="checkbox"
              checked={selectedIdSet.has(person.id)}
              onChange={() => togglePerson(person.id)}
              className="mt-1 size-4 rounded border-[#D6DFF0] text-[#0E2A5C]"
            />
            <span className="text-sm text-[#0E2A5C]">
              {optionLabel(person)}
            </span>
          </label>
        ))}
        {filteredPeople.length === 0 && (
          <div className="p-3 text-sm text-[#7F88A0]">Žádná shoda</div>
        )}
      </div>
      <span className="block text-xs text-[#7F88A0]">
        {filteredPeople.length} možností
      </span>
    </div>
  );
}

export function CreateRelationDialog({
  parentOptions,
  childOptions,
  initialParentIds,
  initialChildIds,
  triggerLabel = "Vyřešit rodinu",
  triggerVariant = "default",
  triggerSize = "default",
}: {
  parentOptions: RelationPersonOption[];
  childOptions: RelationPersonOption[];
  initialParentIds?: string[];
  initialChildIds?: string[];
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
  triggerSize?: "default" | "xs" | "sm";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [parentSearch, setParentSearch] = useState("");
  const [childSearch, setChildSearch] = useState("");
  const [parentPersonIds, setParentPersonIds] = useState(() =>
    uniqueIds(initialParentIds),
  );
  const [childPersonIds, setChildPersonIds] = useState(() =>
    uniqueIds(initialChildIds),
  );
  const isBusy = isSaving || isPending;
  const relationCount = parentPersonIds.length * childPersonIds.length;
  const parentOptionsById = useMemo(
    () => new Map(parentOptions.map((person) => [person.id, person])),
    [parentOptions],
  );
  const childOptionsById = useMemo(
    () => new Map(childOptions.map((person) => [person.id, person])),
    [childOptions],
  );

  function relatedFamilySelection(
    nextParentIds: string[],
    nextChildIds: string[],
  ) {
    const expandedParentIds = new Set(nextParentIds);
    const expandedChildIds = new Set(nextChildIds);
    let didExpand = true;

    while (didExpand) {
      didExpand = false;

      for (const parentId of Array.from(expandedParentIds)) {
        const parent = parentOptionsById.get(parentId);
        parent?.parentLinks.forEach((link) => {
          if (
            !childOptionsById.has(link.childPersonId) ||
            expandedChildIds.has(link.childPersonId)
          )
            return;
          expandedChildIds.add(link.childPersonId);
          didExpand = true;
        });
      }

      for (const childId of Array.from(expandedChildIds)) {
        const child = childOptionsById.get(childId);
        child?.childLinks.forEach((link) => {
          if (
            !parentOptionsById.has(link.parentPersonId) ||
            expandedParentIds.has(link.parentPersonId)
          )
            return;
          expandedParentIds.add(link.parentPersonId);
          didExpand = true;
        });
      }
    }

    return {
      parentIds: Array.from(expandedParentIds),
      childIds: Array.from(expandedChildIds),
    };
  }

  function selectInitialFamily() {
    return relatedFamilySelection(
      uniqueIds(initialParentIds),
      uniqueIds(initialChildIds),
    );
  }

  function toggleParent(parentId: string) {
    if (parentPersonIds.includes(parentId)) {
      setParentPersonIds((ids) => ids.filter((id) => id !== parentId));
      return;
    }
    const expanded = relatedFamilySelection(
      [...parentPersonIds, parentId],
      childPersonIds,
    );
    setParentPersonIds(expanded.parentIds);
    setChildPersonIds(expanded.childIds);
  }

  function toggleChild(childId: string) {
    if (childPersonIds.includes(childId)) {
      setChildPersonIds((ids) => ids.filter((id) => id !== childId));
      return;
    }
    const expanded = relatedFamilySelection(parentPersonIds, [
      ...childPersonIds,
      childId,
    ]);
    setParentPersonIds(expanded.parentIds);
    setChildPersonIds(expanded.childIds);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    setError(null);
    if (nextOpen) {
      setParentSearch("");
      setChildSearch("");
      const initialFamily = selectInitialFamily();
      setParentPersonIds(initialFamily.parentIds);
      setChildPersonIds(initialFamily.childIds);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const reason = String(formData.get("reason") ?? "").trim();

    try {
      const response = await fetch("/api/admin/relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPersonIds, childPersonIds, reason }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Vazbu se nepodařilo uložit.");
        return;
      }

      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size={triggerSize}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Vyřešit rodinné vazby</DialogTitle>
          <DialogDescription>
            Vyberte jednoho nebo více rodičů a jedno nebo více dětí. Uložením
            vzniknou chybějící vazby rodič-dítě se zdrojem manual_admin. Už
            známé aktivní vazby vybrané osoby se doplní do návrhu automaticky.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4">
          <div className="grid gap-3 md:grid-cols-2">
            <PersonMultiSelect
              label="Rodiče"
              people={parentOptions}
              selectedIds={parentPersonIds}
              onTogglePerson={toggleParent}
              search={parentSearch}
              onSearchChange={setParentSearch}
            />
            <PersonMultiSelect
              label="Děti"
              people={childOptions}
              selectedIds={childPersonIds}
              onTogglePerson={toggleChild}
              search={childSearch}
              onSearchChange={setChildSearch}
            />
          </div>

          <div className="rounded-[12px] border border-[#D6DFF0] bg-[#F7FAFF] p-3 text-sm text-[#4A5A7C]">
            {relationCount > 0
              ? `Po uložení se zkontroluje ${relationCount} vazeb. Existující aktivní vazby se nevytvoří znovu.`
              : "Vyberte alespoň jednoho rodiče a jedno dítě."}
          </div>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-[#4A5A7C]">
              Důvod změny
            </span>
            <textarea
              name="reason"
              rows={3}
              required={true}
              maxLength={500}
              placeholder="Např. potvrzeno podle CSV importu / oprava chybějící vazby"
              className="w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 py-2 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
            />
          </label>

          {error && (
            <div className="rounded-[12px] border border-[#C8372D] bg-[#FAEAE9] p-3 text-sm text-[#A42A22]">
              {error}
            </div>
          )}

          <DialogFooter className="px-0">
            <Button type="submit" disabled={isBusy || relationCount === 0}>
              {isBusy ? "Ukládám..." : "Uložit rodinné vazby"}
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

export function DeactivateRelationDialog({
  relationId,
  parentName,
  childName,
}: {
  relationId: string;
  parentName: string;
  childName: string;
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
    const reason = String(formData.get("reason") ?? "").trim();

    try {
      const response = await fetch("/api/admin/relations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationId, isActive: false, reason }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Vazbu se nepodařilo deaktivovat.");
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
        <Button type="button" variant="outline" size="xs">
          Deaktivovat
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deaktivovat vazbu</DialogTitle>
          <DialogDescription>
            Vazba zůstane v historii, jen přestane být aktivní. {parentName}{" "}
            nebude přes tuto vazbu napojen/a na {childName}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[#4A5A7C]">
              Důvod změny
            </span>
            <textarea
              name="reason"
              rows={3}
              required={true}
              maxLength={500}
              placeholder="Např. chybně spárovaný rodič z CSV"
              className="w-full rounded-[12px] border border-[#D6DFF0] bg-white px-3 py-2 text-sm text-[#0E2A5C] outline-none focus:border-[#C8372D] focus:ring-2 focus:ring-[#C8372D]/20"
            />
          </label>

          {error && (
            <div className="rounded-[12px] border border-[#C8372D] bg-[#FAEAE9] p-3 text-sm text-[#A42A22]">
              {error}
            </div>
          )}

          <DialogFooter className="px-0">
            <Button type="submit" variant="destructive" disabled={isBusy}>
              {isBusy ? "Ukládám..." : "Deaktivovat"}
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
