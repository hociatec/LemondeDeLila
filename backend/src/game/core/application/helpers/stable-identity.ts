/** Encodes identity fields without relying on JSON object/array semantics. */
export function encodeStableIdentity(parts: readonly unknown[]): string {
  return parts
    .map((part) => {
      const value = encodeIdentityPart(part);
      return `${value.length}:${value}`;
    })
    .join('|');
}

function encodeIdentityPart(part: unknown): string {
  if (part === null) return 'null:';
  if (typeof part === 'string') return `string:${part}`;
  if (typeof part === 'number') return `number:${String(part)}`;
  if (typeof part === 'boolean') return `boolean:${String(part)}`;
  if (typeof part === 'bigint') return `bigint:${String(part)}`;
  if (typeof part === 'undefined') return 'undefined:';
  if (typeof part === 'symbol') return `symbol:${part.description ?? ''}`;
  throw new TypeError('Stable identity accepts primitive values only');
}
