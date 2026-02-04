import { buildAbsurdissimesShortcuts } from '../les-absurdissimes.shortcuts';

describe('LesAbsurdissimesShortcuts', () => {
  it('returns an array', () => {
    expect(Array.isArray(buildAbsurdissimesShortcuts())).toBe(true);
  });
});
