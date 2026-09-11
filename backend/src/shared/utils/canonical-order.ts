/** Stable text ordering independent of the host locale. */
export function compareCanonicalText(left: unknown, right: unknown): number {
  const a = String(left ?? '').normalize('NFKC');
  const b = String(right ?? '').normalize('NFKC');
  return a < b ? -1 : a > b ? 1 : 0;
}
