export type VisibilityRule =
  | { kind: 'public' }
  | { kind: 'hidden' }
  | { kind: 'private-by-player' };

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

export function projectVisibility(
  state: Record<string, unknown>,
  rules: Record<string, VisibilityRule>,
  viewerPlayerId: number | null,
): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    const rule = rules[key] ?? publicField();
    if (rule.kind === 'hidden') continue;
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

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
