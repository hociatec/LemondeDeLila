import { createHash } from 'node:crypto';

/** Canonical JSON for decoded request data; do not retain or log sensitive payloads. */
export function requestFingerprint(
  type: string,
  payload: unknown,
  roles: readonly string[] | null | undefined,
): string {
  if (typeof type !== 'string' || type.length === 0 || type.length > 128) {
    throw new Error('Invalid request type');
  }
  const canonical = JSON.stringify(
    {
      type,
      hasPayload: payload !== undefined,
      payload,
      roles: [...(roles ?? [])]
        .filter((role): role is string => typeof role === 'string')
        .slice(0, 32)
        .map((role) => role.slice(0, 64))
        .sort(),
    },
    (_key, value: unknown): unknown => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return value;
      return Object.fromEntries(
        Object.entries(value).sort(([left], [right]) =>
          left < right ? -1 : left > right ? 1 : 0,
        ),
      );
    },
  );
  if (Buffer.byteLength(canonical, 'utf8') > 1_048_576) {
    throw new Error('Request fingerprint too large');
  }
  return createHash('sha256').update(canonical).digest('hex');
}
