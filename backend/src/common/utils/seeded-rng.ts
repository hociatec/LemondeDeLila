export type SeededRngState = {
  seed: number;
  counter: number;
};

function normalizeSeed(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n >>> 0;
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
    normalizeSeed(current?.seed) ?? Math.floor(Math.random() * 2 ** 32);
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
