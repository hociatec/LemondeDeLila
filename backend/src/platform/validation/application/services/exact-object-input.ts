export function hasOnlyAllowedKeys(
  value: unknown,
  allowedKeys: readonly string[],
): value is Record<string, unknown> {
  if (
    value == null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    allowedKeys.length > 256
  ) {
    return false;
  }
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}
