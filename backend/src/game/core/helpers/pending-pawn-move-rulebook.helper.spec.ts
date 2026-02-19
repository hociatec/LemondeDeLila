import {
  getPendingPawnMoveActionsForPlayer,
  validatePendingPawnMoveActionForActor,
} from './pending-pawn-move-rulebook.helper';

describe('pending-pawn-move-rulebook.helper', () => {
  it('returns move actions only for the pending player', () => {
    const pending = {
      type: 'choose_pawn',
      playerId: '7',
      data: { moves: [{ pawnIndex: 1, targetProgress: 8 }] },
    };

    expect(getPendingPawnMoveActionsForPlayer(pending, 7)).toEqual([
      { type: 'move_pawn', payload: { pawnIndex: 1, targetProgress: 8 } },
    ]);
    expect(getPendingPawnMoveActionsForPlayer(pending, 8)).toEqual([]);
  });

  it('validates a legal pending move action', () => {
    const pending = {
      type: 'choose_pawn',
      playerId: 3,
      data: { moves: [{ pawnIndex: 2, targetProgress: 6 }] },
    };

    const result = validatePendingPawnMoveActionForActor({
      pending,
      actorId: 3,
      actionType: 'move_pawn',
      payload: { pawnIndex: 2, targetProgress: 6 },
    });

    expect(result).toEqual({
      ok: true,
      move: { pawnIndex: 2, targetProgress: 6 },
      action: { type: 'move_pawn', payload: { pawnIndex: 2, targetProgress: 6 } },
    });
  });

  it('rejects wrong actor, wrong action type, and invalid move', () => {
    const pending = {
      type: 'choose_pawn',
      playerId: 3,
      data: { moves: [{ pawnIndex: 2, targetProgress: 6 }] },
    };

    expect(
      validatePendingPawnMoveActionForActor({
        pending,
        actorId: 4,
        actionType: 'move_pawn',
        payload: { pawnIndex: 2, targetProgress: 6 },
      }),
    ).toEqual({ ok: false, reason: 'not_pending_for_actor' });

    expect(
      validatePendingPawnMoveActionForActor({
        pending,
        actorId: 3,
        actionType: 'roll',
        payload: { pawnIndex: 2, targetProgress: 6 },
      }),
    ).toEqual({ ok: false, reason: 'wrong_action_type' });

    expect(
      validatePendingPawnMoveActionForActor({
        pending,
        actorId: 3,
        actionType: 'move_pawn',
        payload: { pawnIndex: 9, targetProgress: 9 },
      }),
    ).toEqual({ ok: false, reason: 'invalid_move' });
  });
});
