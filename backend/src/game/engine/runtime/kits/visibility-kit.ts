export type VisibilityRule =
  | { kind: 'public' }
  | { kind: 'hidden' }
  | { kind: 'private-by-player' }
  | { kind: 'hidden-until'; revealed: boolean }
  | { kind: 'count-only' };

export function publicField(): VisibilityRule {
  return { kind: 'public' };
}

export function hidden(): VisibilityRule {
  return { kind: 'hidden' };
}

export function privateByPlayer(): VisibilityRule {
  return { kind: 'private-by-player' };
}

export function privateToOwner(): VisibilityRule {
  return privateByPlayer();
}

export function hiddenUntil(revealed: boolean): VisibilityRule {
  return { kind: 'hidden-until', revealed };
}

export function countOnly(): VisibilityRule {
  return { kind: 'count-only' };
}

export function publicFields<TState extends object, TKey extends keyof TState>(
  state: TState,
  keys: readonly TKey[],
): Pick<TState, TKey> {
  return Object.fromEntries(
    keys.map((key) => [key, structuredClone(state[key])]),
  ) as Pick<TState, TKey>;
}

export function projectVisibility(
  state: Record<string, unknown>,
  rules: Record<string, VisibilityRule>,
  viewerPlayerId: number | null,
): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const [key, rule] of Object.entries(rules)) {
    const value = state[key];
    if (rule.kind === 'hidden') continue;
    if (rule.kind === 'hidden-until' && !rule.revealed) continue;
    if (rule.kind === 'count-only') {
      projected[key] = count(value);
      continue;
    }
    if (rule.kind === 'private-by-player') {
      const byPlayer = asRecord(value);
      projected[key] =
        viewerPlayerId == null
          ? {}
          : { [String(viewerPlayerId)]: byPlayer[String(viewerPlayerId)] };
      continue;
    }
    projected[key] = structuredClone(value);
  }
  return projected;
}

function count(value: unknown): number {
  if (Array.isArray(value) || typeof value === 'string') return value.length;
  return Object.keys(asRecord(value)).length;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
