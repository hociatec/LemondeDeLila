import {
  getPendingPawnOptions,
  isPendingPawnForPlayer,
  listPendingPawnActions,
  resolvePendingPawnId,
} from './pawn-selection.helper';

describe('pawn-selection.helper', () => {
  it('resolves from pending.data.pawns with pawnId payload', () => {
    const pending = {
      type: 'pick_pawn',
      playerId: 3,
      data: {
        pawns: [{ id: 'Le Lutin', label: 'Le Lutin: Agile' }],
      },
    };
    expect(resolvePendingPawnId(pending, { pawnId: 'Le Lutin' })).toBe(
      'Le Lutin',
    );
  });

  it('builds generic pending pawn actions', () => {
    const pending = {
      type: 'choose_pawn',
      data: { pawns: [{ id: 'A' }, { id: 'B' }] },
    };
    expect(listPendingPawnActions(pending, 'choose_pawn')).toEqual([
      {
        type: 'choose_pawn',
        label: 'A',
        payload: { id: 'A', pawnId: 'A', pawn: 'A', value: 'A' },
      },
      {
        type: 'choose_pawn',
        label: 'B',
        payload: { id: 'B', pawnId: 'B', pawn: 'B', value: 'B' },
      },
    ]);
  });

  it('checks pending player identity', () => {
    const pending = { type: 'choose_pawn', playerId: '7' };
    expect(isPendingPawnForPlayer(pending, 7, 'choose_pawn')).toBe(true);
    expect(isPendingPawnForPlayer(pending, 8, 'choose_pawn')).toBe(false);
  });

  it('returns normalized options', () => {
    const pending = { data: { pawns: [{ id: 'X', label: 'X label' }] } };
    expect(getPendingPawnOptions(pending)).toEqual([
      { id: 'X', label: 'X label' },
    ]);
  });
});
