export function stableContentVersion(gameId: string, data: object): string {
  return `${gameId}@content:${hashString(stableJson(data))}`;
}

function stableJson(value: unknown): string {
  if (value instanceof Map)
    return `map:[${[...value].map(([key, entry]) => `[${stableJson(key)},${stableJson(entry)}]`).join(',')}]`;
  if (value instanceof Set)
    return `set:[${[...value].map(stableJson).join(',')}]`;
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value != null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
