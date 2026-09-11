/** Encodes identity fields without relying on JSON object/array semantics. */
export function encodeStableIdentity(parts: readonly unknown[]): string {
  return parts
    .map((part) => {
      const value =
        part === null
          ? 'null:'
          : typeof part === 'string'
            ? `string:${part}`
            : typeof part === 'number'
              ? `number:${String(part)}`
              : typeof part === 'boolean'
                ? `boolean:${String(part)}`
                : `value:${String(part)}`;
      return `${value.length}:${value}`;
    })
    .join('|');
}
