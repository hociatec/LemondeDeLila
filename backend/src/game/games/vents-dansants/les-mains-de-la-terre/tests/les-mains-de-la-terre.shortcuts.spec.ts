import { buildLesMainsShortcuts } from '../les-mains-de-la-terre.shortcuts';

describe('LesMainsShortcuts', () => {
  it('retourne un tableau', () => {
    expect(Array.isArray(buildLesMainsShortcuts())).toBe(true);
  });
});
