import {
  A_FOND_LES_BALLONS_PAWNS,
  resolvePawnId,
} from './a-fond-les-ballons.pawns';

describe('a-fond-les-ballons pawns', () => {
  it('resolves pawn ids from id/label/object forms', () => {
    const first = A_FOND_LES_BALLONS_PAWNS[0];
    expect(resolvePawnId(first.id)).toBe(first.id);
    expect(resolvePawnId(first.label)).toBe(first.id);
    expect(resolvePawnId({ id: first.id })).toBe(first.id);
    expect(resolvePawnId({ pawnId: first.id })).toBe(first.id);
    expect(resolvePawnId({ value: first.label })).toBe(first.id);
  });

  it('handles unknown and scalar values safely', () => {
    expect(resolvePawnId(null)).toBeNull();
    expect(resolvePawnId(undefined)).toBeNull();
    expect(resolvePawnId('inconnu')).toBeNull();
    expect(resolvePawnId(1234)).toBeNull();
    expect(resolvePawnId(true)).toBeNull();
    expect(resolvePawnId({})).toBeNull();
  });
});
