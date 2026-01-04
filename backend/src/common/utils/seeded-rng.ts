export type SeededRngState = {
  seed: number;
  counter: number;
};

function normalizeSeed(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n >>> 0;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deriveSeedFromContext(meta: Record<string, any>): number | null {
  const roomId = meta?.roomId;
  const startedAt = meta?.roomStartedAt;
  const gameType = meta?.gameType;
  if (roomId == null || startedAt == null) return null;
  const input = `${String(gameType ?? '')}|${String(roomId)}|${String(startedAt)}`;
  return fnv1a32(input);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ensureSeededRng(meta: Record<string, any>): SeededRngState {
  const current = meta?.rng ?? null;
  const seed =
    normalizeSeed(current?.seed) ??
    deriveSeedFromContext(meta) ??
    Math.floor(Math.random() * 2 ** 32);
  const counter = Math.max(0, normalizeSeed(current?.counter) ?? 0);
  return { seed, counter };
}

export function nextRngFloat(meta: Record<string, any>): {
  value: number;
  meta: Record<string, any>;
} {
  const rng = ensureSeededRng(meta);
  const generator = mulberry32((rng.seed + rng.counter) >>> 0);
  const value = generator();
  const next: SeededRngState = { seed: rng.seed, counter: rng.counter + 1 };
  return { value, meta: { ...meta, rng: next } };
}

export function nextRngInt(
  meta: Record<string, any>,
  maxExclusive: number,
): { value: number; meta: Record<string, any> } {
  const max = Math.floor(maxExclusive);
  if (!Number.isFinite(max) || max <= 0) {
    return { value: 0, meta };
  }
  const { value: f, meta: updated } = nextRngFloat(meta);
  return { value: Math.floor(f * max), meta: updated };
}
