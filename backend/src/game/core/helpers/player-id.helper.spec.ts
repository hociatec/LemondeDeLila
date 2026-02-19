import { toPlayerId } from './player-id.helper';

describe('player-id.helper', () => {
  it('parses finite numbers and numeric strings', () => {
    expect(toPlayerId(7)).toBe(7);
    expect(toPlayerId(' 12 ')).toBe(12);
  });

  it('rejects empty, invalid and non-finite values', () => {
    expect(toPlayerId('')).toBeNull();
    expect(toPlayerId('abc')).toBeNull();
    expect(toPlayerId(NaN)).toBeNull();
    expect(toPlayerId(Infinity)).toBeNull();
  });
});
