import { buildCatPattesShortcuts } from '../cat-pattes.shortcuts';

describe('CatPattesShortcuts', () => {
  it('returns an array of hints', () => {
    const shortcuts = buildCatPattesShortcuts();
    expect(Array.isArray(shortcuts)).toBe(true);
  });
});
