import { buildLaGrandeMineDeBarbakShortcuts } from '../la-grande-mine-de-barbak.shortcuts';

describe('LaGrandeMineDeBarbak shortcuts', () => {
  it('returns an array', () => {
    const shortcuts = buildLaGrandeMineDeBarbakShortcuts();
    expect(Array.isArray(shortcuts)).toBe(true);
  });
});

