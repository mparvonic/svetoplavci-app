export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
  }).format(date);
}

export function uniqueText(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

export function formatPersonDisplayName(input: {
  displayName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}): string {
  const firstName = input.firstName?.trim();
  const middleName = input.middleName?.trim();
  const lastName = input.lastName?.trim();
  const structuredName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  if (structuredName) return structuredName;

  return (input.displayName ?? "")
    .replace(/\bRodič s žákem v evidenci\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || "Neznámá osoba";
}
