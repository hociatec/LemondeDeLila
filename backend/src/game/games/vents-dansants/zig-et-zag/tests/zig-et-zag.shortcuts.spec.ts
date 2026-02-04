import { buildZigEtZagShortcuts } from '../zig-et-zag.shortcuts';

describe('ZigEtZagShortcuts', () => {
  it('returns an array', () => {
    expect(Array.isArray(buildZigEtZagShortcuts())).toBe(true);
  });
});
