import { buildEntreRitesShortcuts } from '../entre-rites.shortcuts';

describe('EntreRitesShortcuts', () => {
  it('returns an array', () => {
    const shortcuts = buildEntreRitesShortcuts({
      metadata: {},
      currentPlayerId: 1,
      started: true,
    });
    expect(Array.isArray(shortcuts)).toBe(true);
  });
});
