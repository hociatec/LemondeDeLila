import { buildCatPattesShortcuts } from '../cat-pattes.shortcuts';

describe('CatPattesShortcuts', () => {
  it('declares draw/score/progression shortcuts', () => {
    const shortcuts = buildCatPattesShortcuts({
      metadata: {},
      currentPlayerId: 1,
      started: true,
    });
    expect(Array.isArray(shortcuts)).toBe(true);
    expect(
      shortcuts.some(
        (s: any) =>
          String(s?.type) === 'action' && String(s?.actionType) === 'draw',
      ),
    ).toBe(true);
    expect(
      shortcuts.some(
        (s: any) =>
          String(s?.type) === 'interface' && String(s?.id) === 'score',
      ),
    ).toBe(true);
    expect(
      shortcuts.some(
        (s: any) =>
          String(s?.type) === 'interface' && String(s?.id) === 'position',
      ),
    ).toBe(true);
  });
});
