import {
  getPendingPawnMoveOptions,
  isPendingPawnMoveForPlayer,
  listPendingPawnMoveActions,
  resolvePendingPawnMove,
} from './pawn-move-selection.helper';

describe('pawn-move-selection.helper', () => {
  it('checks pending player identity', () => {
    const pending = { type: 'choose_pawn', playerId: '7' };
    expect(isPendingPawnMoveForPlayer(pending, 7, 'choose_pawn')).toBe(true);
    expect(isPendingPawnMoveForPlayer(pending, 8, 'choose_pawn')).toBe(false);
  });

  it('returns normalized pending move options', () => {
    const pending = {
      data: {
        moves: [
          { pawnIndex: 0, targetProgress: 6 },
          { pawnIndex: 1, targetProgress: 3 },
        ],
      },
    };
    expect(getPendingPawnMoveOptions(pending)).toEqual([
      { pawnIndex: 0, targetProgress: 6 },
      { pawnIndex: 1, targetProgress: 3 },
    ]);
  });

  it('builds move actions from pending options', () => {
    const pending = {
      data: { moves: [{ pawnIndex: 2, targetProgress: 9 }] },
    };
    expect(listPendingPawnMoveActions(pending, 'move_pawn')).toEqual([
      { type: 'move_pawn', payload: { pawnIndex: 2, targetProgress: 9 } },
    ]);
  });

  it('resolves a valid move payload', () => {
    const pending = {
      data: { moves: [{ pawnIndex: 2, targetProgress: 9 }] },
    };
    expect(resolvePendingPawnMove(pending, { pawnIndex: 2, targetProgress: 9 })).toEqual({
      pawnIndex: 2,
      targetProgress: 9,
    });
    expect(resolvePendingPawnMove(pending, { pawnIndex: 2, targetProgress: 8 })).toBeNull();
  });
});

