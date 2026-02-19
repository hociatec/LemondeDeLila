import { buildLesMainsDeLaTerreShortcuts } from '../les-mains-de-la-terre.shortcuts';

describe('LesMainsShortcuts', () => {
  it('retourne un tableau', () => {
    expect(Array.isArray(buildLesMainsDeLaTerreShortcuts())).toBe(true);
  });
});

