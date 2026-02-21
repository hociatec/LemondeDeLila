import { buildLaGrandeMineDeBarbakShortcuts } from '../la-grande-mine-de-barbak.shortcuts';

describe('LaGrandeMineDeBarbak shortcuts', () => {
  it('returns an array', () => {
    const shortcuts = buildLaGrandeMineDeBarbakShortcuts({
      metadata: {},
      currentPlayerId: 1,
      started: true,
    });
    expect(Array.isArray(shortcuts)).toBe(true);
  });
});
