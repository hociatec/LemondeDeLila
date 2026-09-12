/** Stable text ordering independent of the host locale. */
export function compareCanonicalText(left: unknown, right: unknown): number {
  const a = canonicalText(left).normalize('NFKC');
  const b = canonicalText(right).normalize('NFKC');
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (typeof value === 'bigint') return String(value);
  return JSON.stringify(value) ?? '';
}
