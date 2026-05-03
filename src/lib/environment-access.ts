import { logSecurityEvent } from "@/src/lib/security-events";

const PRODUCTION_HOSTS = new Set(["app.svetoplavci.cz"]);
const STAGING_HOSTS = new Set(["app-test.svetoplavci.cz", "test-app.svetoplavci.cz"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
let securityConfigWarningShown = false;

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

export function getRequestHost(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const directHost = request.headers.get("host");
  return normalizeHost(forwardedHost || directHost);
}

export function isAuthBypassForcedOn(): boolean {
  return process.env.AUTH_BYPASS === "1";
}

export function isUnsafeBypassConfigurationForHost(host: string): boolean {
  return isAuthBypassForcedOn() && (isProductionHost(host) || isStagingHost(host));
}

export function warnUnsafeBypassConfiguration(host: string): void {
  if (securityConfigWarningShown) return;
  securityConfigWarningShown = true;
  logSecurityEvent("error", {
    event: "unsafe_bypass_configuration",
    message: "Unsafe auth bypass config detected for protected host. Blocking auth bypass dependent access.",
    host,
    details: {
      nodeEnv: process.env.NODE_ENV,
      authBypass: process.env.AUTH_BYPASS,
    },
  });
}
