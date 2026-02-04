import { buildNawakShortcuts } from '../nawak.shortcuts';

describe('NawakShortcuts', () => {
  it('returns hints array', () => {
    expect(Array.isArray(buildNawakShortcuts())).toBe(true);
  });
});
