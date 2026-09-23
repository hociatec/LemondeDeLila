/** Stable diagnostic contract for grammar and semantic authoring failures. */
export class AuthoringError extends Error {
  readonly code = 'GAME_AUTHORING_ERROR';
  readonly presentToClient = 'code' as const;

  constructor(
    readonly path: string,
    readonly expected: string,
    readonly received: unknown,
    reason = expected,
    readonly hint?: string,
  ) {
    super(`${path}: ${reason}`);
    this.name = 'AuthoringError';
  }
}

export function authoringValueAt(value: unknown, path: string): unknown {
  if (path.startsWith('.')) return undefined;
  let current = value;
  const tokens = /(?:^|\.)([^.[\]]+)|\[(\d+|"(?:\\.|[^"\\])*")\]/g;
  let end = 0;
  for (const match of path.matchAll(tokens)) {
    if (match.index !== end) return undefined;
    end = match.index + match[0].length;
    let key = match[1] ?? match[2];
    if (match[2]?.startsWith('"')) {
      try {
        key = String(JSON.parse(match[2]));
      } catch {
        return undefined;
      }
    }
    if (!current || typeof current !== 'object') return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (!descriptor || !('value' in descriptor)) return undefined;
    current = descriptor.value;
  }
  return end === path.length ? current : undefined;
}
