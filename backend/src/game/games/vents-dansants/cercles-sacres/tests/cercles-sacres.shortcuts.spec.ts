import { buildCerclesSacresShortcuts } from '../cercles-sacres.shortcuts';

describe('CerclesSacresShortcuts', () => {
  it('returns an array of hints', () => {
    const shortcuts = buildCerclesSacresShortcuts();
    expect(Array.isArray(shortcuts)).toBe(true);
  });
});
