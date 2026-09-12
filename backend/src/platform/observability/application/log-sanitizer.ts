const REDACTED = '[REDACTED]';
const MAX_SANITIZED_TEXT_LENGTH = 16_384;
const MAX_JSON_TEXT_INPUT_LENGTH = 262_144;

const SENSITIVE_KEYS = new Set([
  'accessToken',
  'apiKey',
  'action',
  'authorization',
  'body',
  'content',
  'cookie',
  'setCookie',
  'clientSecret',
  'email',
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
  depth = 0,
): unknown {
  if (typeof value === 'string') return sanitizeLogText(value).slice(0, 16_384);
  if (value == null || typeof value !== 'object') return value;
  if (depth >= 16) return '[DEPTH_LIMIT]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, 512)
      .map((item) => sanitizeLogValue(item, seen, depth + 1));
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value).slice(0, 256)) {
    if (key.length > 256) continue;
    Object.defineProperty(sanitized, key, {
      value: isSensitiveKey(key)
        ? REDACTED
        : sanitizeLogValue(nested, seen, depth + 1),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return sanitized;
}

/** Redacts credentials even when a framework supplies an Error or structured value. */
export function sanitizeLogText(value: unknown): string {
  const boundedText =
    typeof value === 'string'
      ? value.slice(0, MAX_JSON_TEXT_INPUT_LENGTH)
      : value;
  if (typeof boundedText === 'string' && /^\s*[[{]/.test(boundedText)) {
    try {
      return JSON.stringify(sanitizeLogValue(JSON.parse(boundedText))).slice(
        0,
        MAX_SANITIZED_TEXT_LENGTH,
      );
    } catch {
      // Non-JSON framework messages still pass through textual redaction.
    }
  }
  const text =
    typeof boundedText === 'string'
      ? boundedText
      : value instanceof Error
        ? (value.stack ?? value.message).slice(0, MAX_JSON_TEXT_INPUT_LENGTH)
        : (JSON.stringify(sanitizeLogValue(value)) ?? String(value));
  return text
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]*@/gi, `$1${REDACTED}@`)
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`)
    .replace(
      /(["']?\b(?:access[-_]?token|api[-_]?key|authorization|cookie|set[-_]?cookie|client[-_]?secret|credentials|password|refresh[-_]?token|secret|token)\b["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)/gi,
      `$1${REDACTED}`,
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
    .replace(/(?<!\w)(?:\+?\d[\d .()-]{7,}\d)(?!\w)/g, REDACTED)
    .slice(0, MAX_SANITIZED_TEXT_LENGTH);
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[-_]/g, '').toLowerCase();
  for (const sensitive of SENSITIVE_KEYS) {
    if (normalized === sensitive.toLowerCase()) return true;
  }
  return false;
}
