import { buildLaGrandeMineShortcuts } from '../la-grande-mine-de-barbak.shortcuts';

describe('LaGrandeMineDeBarbak shortcuts', () => {
  it('returns an array', () => {
    const shortcuts = buildLaGrandeMineShortcuts();
    expect(Array.isArray(shortcuts)).toBe(true);
  });
});
