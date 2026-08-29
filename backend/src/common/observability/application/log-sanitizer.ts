const REDACTED = '[REDACTED]';

const SENSITIVE_KEYS = new Set([
  'accessToken',
  'action',
  'authorization',
  'body',
  'content',
  'cookie',
  'credentials',
  'password',
  'payload',
  'privateData',
  'refreshToken',
  'secret',
  'text',
  'token',
]);

/** Produces a logging-safe clone without mutating the supplied value. */
export function sanitizeLogValue(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === 'string') return sanitizeLogText(value);
  if (value == null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, seen));
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    sanitized[key] = isSensitiveKey(key)
      ? REDACTED
      : sanitizeLogValue(nested, seen);
  }
  return sanitized;
}

/** Redacts credentials even when a framework already serialized the payload. */
export function sanitizeLogText(value: string): string {
  return value
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`)
    .replace(
      /(["']?(?:accessToken|authorization|cookie|credentials|password|refreshToken|secret|token)["']?\s*[:=]\s*)(["']?)[^\s,;}]+\2/gi,
      `$1${REDACTED}`,
    );
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[-_]/g, '').toLowerCase();
  for (const sensitive of SENSITIVE_KEYS) {
    if (normalized === sensitive.toLowerCase()) return true;
  }
  return false;
}
