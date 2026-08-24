import { ensureSeededRng } from './seeded-rng';

describe('seeded-rng', () => {
  it('keeps provided seed/counter', () => {
    const meta: Record<string, unknown> = { rng: { seed: 123, counter: 7 } };
    expect(ensureSeededRng(meta)).toEqual({ seed: 123, counter: 7 });
  });

  it('derives a deterministic seed from room context', () => {
    const meta: Record<string, unknown> = {
      roomId: 42,
      roomStartedAt: '2026-01-04T15:00:00.000Z',
      gameType: 'panier-express',
    };
    expect(ensureSeededRng(meta).seed).toBe(ensureSeededRng(meta).seed);
  });

  it('changes derived seed when startedAt changes', () => {
    const base: Record<string, unknown> = {
      roomId: 42,
      gameType: 'panier-express',
    };
    const a = ensureSeededRng({ ...base, roomStartedAt: 'A' }).seed;
    const b = ensureSeededRng({ ...base, roomStartedAt: 'B' }).seed;
    expect(a).not.toBe(b);
  });

  it('changes derived seed when roomRunId changes', () => {
    const base: Record<string, unknown> = {
      roomId: 42,
      roomStartedAt: '2026-01-04T15:00:00.000Z',
      gameType: 'panier-express',
    };
    const a = ensureSeededRng({ ...base, roomRunId: 1 }).seed;
    const b = ensureSeededRng({ ...base, roomRunId: 2 }).seed;
    expect(a).not.toBe(b);
  });

  it('falls back to a valid cryptographic seed when context is missing', () => {
    const seed = ensureSeededRng({}).seed;
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });
});
