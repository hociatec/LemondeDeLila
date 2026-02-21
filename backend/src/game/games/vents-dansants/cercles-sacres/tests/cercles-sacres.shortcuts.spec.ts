import { buildCerclesSacresShortcuts } from '../cercles-sacres.shortcuts';

describe('CerclesSacresShortcuts', () => {
  it('returns an array of hints', () => {
    const shortcuts = buildCerclesSacresShortcuts({
      metadata: {},
      currentPlayerId: 1,
      started: true,
    });
    expect(Array.isArray(shortcuts)).toBe(true);
  });
});
