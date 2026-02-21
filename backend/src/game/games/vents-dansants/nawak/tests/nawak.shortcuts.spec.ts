import { buildNawakShortcuts } from '../nawak.shortcuts';

describe('NawakShortcuts', () => {
  it('returns hints array', () => {
    expect(
      Array.isArray(
        buildNawakShortcuts({
          metadata: {},
          currentPlayerId: 1,
          started: true,
        }),
      ),
    ).toBe(true);
  });
});
