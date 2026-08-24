import { buildAbsurdissimesShortcuts } from './les-absurdissimes.shortcuts';

describe('LesAbsurdissimesShortcuts', () => {
  it('returns an array', () => {
    expect(
      Array.isArray(
        buildAbsurdissimesShortcuts({
          metadata: {},
          currentPlayerId: 1,
          started: true,
        }),
      ),
    ).toBe(true);
  });
});

