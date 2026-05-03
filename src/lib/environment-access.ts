const PRODUCTION_HOSTS = new Set(["app.svetoplavci.cz"]);
const STAGING_HOSTS = new Set(["app-test.svetoplavci.cz", "test-app.svetoplavci.cz"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function normalizeHost(rawHost: string | null | undefined): string {
  return (rawHost ?? "").split(":")[0].trim().toLowerCase();
}

export function isProductionHost(host: string): boolean {
  return PRODUCTION_HOSTS.has(normalizeHost(host));
}

export function isStagingHost(host: string): boolean {
  return STAGING_HOSTS.has(normalizeHost(host));
}

export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(normalizeHost(host));
}

export function isBypassAllowedForHost(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  return isLocalHost(normalized);
}

export function getConfiguredAppHost(): string {
  const configuredUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "";
  if (!configuredUrl) return "";
  try {
    return normalizeHost(new URL(configuredUrl).host);
  } catch {
    return normalizeHost(configuredUrl);
  }
}

export function getStagingAllowedEmailsFromEnv(): Set<string> {
  const raw = process.env.STAGING_ALLOWED_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

