const SECRET_KEYS = /api[-_]?key|authorization|secret|token|pin/i;

export function scrubForLogs(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.startsWith("sk-") || value.startsWith("AIza") || value.length > 24) {
      return "[redacted]";
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(scrubForLogs);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.test(key) ? "[redacted]" : scrubForLogs(nested);
    }
    return out;
  }
  return value;
}

export function logError(message: string, extra?: Record<string, unknown>): void {
  if (extra) {
    console.error(message, scrubForLogs(extra));
    return;
  }
  console.error(message);
}
