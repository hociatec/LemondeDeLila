export type SeededRngState = {
  seed: number;
  counter: number;
};

export type SeededRngMetadata = {
  rng?: SeededRngState;
  roomId?: number;
  roomStartedAt?: Date | string | null;
  gameType?: string;
  roomRunId?: number | null;
};

function normalizeSeed(
  value: string | number | null | undefined,
): number | null {
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

function toStablePart(
  value: Date | string | number | null | undefined,
): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint')
    return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return '';
}

function deriveSeedFromContext(meta: SeededRngMetadata): number | null {
  const roomId = meta.roomId;
  const startedAt = meta.roomStartedAt;
  const gameType = meta.gameType;
  const runIdRaw = meta.roomRunId;
  const runId =
    typeof runIdRaw === 'number' ? runIdRaw : Number(runIdRaw ?? NaN);
  if (roomId == null || (startedAt == null && runIdRaw == null)) return null;
  const input = `${toStablePart(gameType)}|${toStablePart(roomId)}|${toStablePart(
    startedAt,
  )}|${Number.isFinite(runId) ? String(runId) : ''}`;
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

export function ensureSeededRng(meta: SeededRngMetadata): SeededRngState {
  const current = meta.rng;
  const seed = normalizeSeed(current?.seed) ?? deriveSeedFromContext(meta);
  if (seed == null) {
    throw new Error(
      'Contexte RNG déterministe absent: fournir rng ou roomId/roomStartedAt.',
    );
  }
  const counter = Math.max(0, normalizeSeed(current?.counter) ?? 0);
  return { seed, counter };
}

export function nextRngFloat<T extends SeededRngMetadata>(
  meta: T,
): {
  value: number;
  meta: T & { rng: SeededRngState };
} {
  const rng = ensureSeededRng(meta);
  const generator = mulberry32((rng.seed + rng.counter) >>> 0);
  const value = generator();
  const next: SeededRngState = { seed: rng.seed, counter: rng.counter + 1 };
  return { value, meta: { ...meta, rng: next } };
}

export function nextRngInt<T extends SeededRngMetadata>(
  meta: T,
  maxExclusive: number,
): { value: number; meta: T | (T & { rng: SeededRngState }) } {
  const max = Math.floor(maxExclusive);
  if (!Number.isFinite(max) || max <= 0) {
    return { value: 0, meta };
  }
  const { value: f, meta: updated } = nextRngFloat(meta);
  return { value: Math.floor(f * max), meta: updated };
}
