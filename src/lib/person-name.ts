type PersonNameInput = {
  nickname?: string | null;
  displayName?: string | null;
  firstName?: string | null;
};

type ResolvePersonNameOptions = {
  preferFirstName?: boolean;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function resolvePersonName(
  input: PersonNameInput,
  options: ResolvePersonNameOptions = {},
): string {
  const nickname = clean(input.nickname);
  const displayName = clean(input.displayName);
  const firstName = clean(input.firstName);

  if (options.preferFirstName && firstName) return firstName;
  if (nickname) return nickname;
  if (displayName) return displayName;
  if (firstName) return firstName;
  return "Neznámý uživatel";
}

