export function clampMinuit(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function bounceMinuit(target: number, max: number): number {
  if (target < 0) return 0;
  if (target === max) return max;
  if (target < max) return target;
  const over = target - max;
  return max - over;
}

export function extractMinuitMoveDelta(text: string): number {
  const parse = (raw: string) => {
    const v = raw.trim().toLowerCase();
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const map: Record<string, number> = {
      un: 1,
      une: 1,
      deux: 2,
      trois: 3,
      quatre: 4,
      cinq: 5,
      six: 6,
    };
    return map[v] ?? 0;
  };
  const forward = text.match(
    /avancez?\s+(?:de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+cases?/i,
  );
  if (forward) return parse(forward[1]);
  const backward = text.match(
    /reculez?\s+(?:de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+cases?/i,
  );
  if (backward) return -parse(backward[1]);
  return 0;
}

export function extractMinuitFailureDelta(text: string): number {
  const parse = (raw: string) => {
    const v = raw.trim().toLowerCase();
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const map: Record<string, number> = {
      un: 1,
      une: 1,
      deux: 2,
      trois: 3,
      quatre: 4,
      cinq: 5,
      six: 6,
    };
    return map[v] ?? 0;
  };
  const backward = text.match(
    /sinon[^.]*reculez?\s+(?:de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+cases?/i,
  );
  if (backward) return -parse(backward[1]);
  const forward = text.match(
    /sinon[^.]*avancez?\s+(?:de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+cases?/i,
  );
  if (forward) return parse(forward[1]);
  return 0;
}

export function extractMinuitSkipTurns(text: string): number {
  if (/Passez trois tours/i.test(text)) return 3;
  if (/Passez deux tours/i.test(text)) return 2;
  if (/Passez un tour/i.test(text)) return 1;
  if (/Passez votre tour/i.test(text) || /Passe ton tour/i.test(text)) return 1;
  if (/Vous passez trois tours/i.test(text)) return 3;
  if (/Vous passez deux tours/i.test(text)) return 2;
  if (/Vous passez un tour/i.test(text)) return 1;
  return 0;
}

export function findNextMinuit<T>(
  items: T[],
  start: number,
  predicate: (v: T) => boolean,
): number | null {
  for (let i = start + 1; i < items.length; i += 1) {
    if (predicate(items[i])) return i;
  }
  return null;
}

export function findPrevMinuit<T>(
  items: T[],
  start: number,
  predicate: (v: T) => boolean,
): number | null {
  for (let i = start - 1; i >= 0; i -= 1) {
    if (predicate(items[i])) return i;
  }
  return null;
}

export function findBehindMinuit(
  positions: Record<number, number>,
  playerId: number,
): number | null {
  const entries = Object.entries(positions).map(([id, pos]) => ({
    id: Number(id),
    pos: Number(pos),
  }));
  const ranked = entries
    .filter((e) => Number.isFinite(e.id))
    .sort((a, b) => a.pos - b.pos);
  const idx = ranked.findIndex((e) => e.id === playerId);
  if (idx <= 0) return null;
  return ranked[idx - 1].id;
}

export function asMinuitRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function toMinuitText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function resolveMinuitPawnName(
  meta: {
    pawnChoices?: unknown;
  },
  pawnIdOrLabel: unknown,
): string {
  const rawLabel =
    pawnIdOrLabel === null || pawnIdOrLabel === undefined ? '' : pawnIdOrLabel;
  const preparedLabel =
    typeof rawLabel === 'string' ||
    typeof rawLabel === 'number' ||
    typeof rawLabel === 'boolean'
      ? String(rawLabel)
      : '';
  const value = preparedLabel.trim();
  if (!value) return '';

  const normalized = value.toLowerCase();
  const choices = Array.isArray(meta.pawnChoices) ? meta.pawnChoices : [];
  for (const pawn of choices) {
    const record = asMinuitRecord(pawn);
    const id = String(record.id ?? '').trim();
    const name = String(record.name ?? '').trim();
    if (!id || !name) continue;
    if (id === value || name === value) return name;
    if (id.toLowerCase() === normalized || name.toLowerCase() === normalized) {
      return name;
    }
  }

  const labelName = value.split(':')[0]?.trim();
  return labelName || value;
}

export function lowercaseMinuitFirst(value: string): string {
  const text = String(value ?? '').trim();
  if (!text) return text;
  if (text.length === 1) return text.toLowerCase();
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

export function describeMinuitPawnLabel(args: {
  state: { players?: Array<Record<string, unknown>> };
  meta: { pawns?: Record<string, unknown>; pawnChoices?: unknown };
  playerId: number;
}): string {
  const { state, meta, playerId } = args;
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((entry) => Number(entry?.id) === playerId);
  const pawnId = String(player?.pawn ?? meta.pawns?.[playerId] ?? '').trim();
  const pawn = resolveMinuitPawnName(meta, pawnId);
  if (pawn) return `"${pawn}"`;
  return 'un pion';
}

export function describeMinuitPawnPossessive(args: {
  state: { players?: Array<Record<string, unknown>> };
  meta: { pawns?: Record<string, unknown>; pawnChoices?: unknown };
  playerId: number;
}): string {
  const raw = describeMinuitPawnLabel(args);
  const inner = String(raw ?? '')
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .trim();
  if (!inner) return '"son pion"';
  const stripped = inner
    .replace(/^(le|la|les|un|une)\s+/i, '')
    .replace(/^l['’]\s*/i, '')
    .trim();
  const base = lowercaseMinuitFirst(stripped || inner);
  const feminine = /^(la|une)\s+/i.test(inner);
  const possessive = feminine ? 'sa' : 'son';
  return `"${possessive} ${base}"`;
}
