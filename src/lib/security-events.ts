type SecurityLevel = "info" | "warn" | "error";

type SecurityEventPayload = {
  event: string;
  message: string;
  host?: string;
  pathname?: string;
  email?: string;
  roles?: string[];
  details?: Record<string, unknown>;
};

const dedupeKeys = new Set<string>();

function writeLog(level: SecurityLevel, payload: SecurityEventPayload): void {
  const body = {
    timestamp: new Date().toISOString(),
    ...payload,
  };
  const line = `[security] ${JSON.stringify(body)}`;
  if (level === "error") {
    console.error(line);
    return;
  }
  console.warn(line);
}

export function logSecurityEvent(level: SecurityLevel, payload: SecurityEventPayload): void {
  writeLog(level, payload);
}

export function logSecurityEventOnce(level: SecurityLevel, dedupeKey: string, payload: SecurityEventPayload): void {
  if (dedupeKeys.has(dedupeKey)) return;
  dedupeKeys.add(dedupeKey);
  writeLog(level, payload);
}
