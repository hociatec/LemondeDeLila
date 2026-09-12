/** Decimal integers only; never coerce booleans, objects, prefixes or fractions. */
export function parseStrictInteger(
  value: unknown,
  bounds: { min?: number; max?: number } = {},
): number | null {
  if (!bounds || typeof bounds !== 'object') return null;
  const min = bounds.min ?? Number.MIN_SAFE_INTEGER;
  const max = bounds.max ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max)
    return null;
  if (
    typeof value === 'string' &&
    (value.length > 128 || !/^-?\d+$/.test(value.trim()))
  )
    return null;
  const number = parseStrictNumber(value);
  return number !== null &&
    Number.isSafeInteger(number) &&
    number >= min &&
    number <= max
    ? number
    : null;
}

/** Reject malformed required values without substituting an invented value. */
export function requireStrictInteger(
  value: unknown,
  label: string,
  bounds: { min?: number; max?: number } = {},
): number {
  const parsed = parseStrictInteger(value, bounds);
  if (parsed === null)
    throw new TypeError(`${label} : entier décimal sûr requis`);
  return parsed;
}

/** Finite decimal notation; a string must be consumed in full. */
export function parseStrictNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER
      ? value
      : null;
  }
  if (typeof value !== 'string' || value.length > 128) return null;
  const text = value.trim();
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER
    ? number
    : null;
}
