const OPAQUE_FIELD = /(password|token|secret|signature|authorization|cookie)/i;

export function normalizeInputStrings(value: unknown, fieldName = ''): unknown {
  if (typeof value === 'string') {
    return OPAQUE_FIELD.test(fieldName)
      ? value
      : value.normalize('NFKC').trim();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeInputStrings(item, fieldName));
  }
  if (!isPlainRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      normalizeInputStrings(item, key),
    ]),
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}
