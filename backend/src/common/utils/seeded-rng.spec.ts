import { ensureSeededRng } from './seeded-rng';

describe('seeded-rng', () => {
  it('keeps provided seed/counter', () => {
    const meta: any = { rng: { seed: 123, counter: 7 } };
    expect(ensureSeededRng(meta)).toEqual({ seed: 123, counter: 7 });
  });

  it('derives a deterministic seed from room context', () => {
    const meta: any = {
      roomId: 42,
      roomStartedAt: '2026-01-04T15:00:00.000Z',
      gameType: 'panier-express',
    };
    expect(ensureSeededRng(meta).seed).toBe(ensureSeededRng(meta).seed);
  });

  it('changes derived seed when startedAt changes', () => {
    const base: any = { roomId: 42, gameType: 'panier-express' };
    const a = ensureSeededRng({ ...base, roomStartedAt: 'A' }).seed;
    const b = ensureSeededRng({ ...base, roomStartedAt: 'B' }).seed;
    expect(a).not.toBe(b);
  });

  it('changes derived seed when roomRunId changes', () => {
    const base: any = {
      roomId: 42,
      roomStartedAt: '2026-01-04T15:00:00.000Z',
      gameType: 'panier-express',
    };
    const a = ensureSeededRng({ ...base, roomRunId: 1 }).seed;
    const b = ensureSeededRng({ ...base, roomRunId: 2 }).seed;
    expect(a).not.toBe(b);
  });

  it('falls back to Math.random when context missing', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      expect(ensureSeededRng({} as any).seed).toBe(2 ** 31);
    } finally {
      spy.mockRestore();
    }
  });
});
