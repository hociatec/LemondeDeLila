import { buildEntreRitesShortcuts } from '../entre-rites.shortcuts';

describe('EntreRitesShortcuts', () => {
  it('returns an array', () => {
    const shortcuts = buildEntreRitesShortcuts();
    expect(Array.isArray(shortcuts)).toBe(true);
  });
});
