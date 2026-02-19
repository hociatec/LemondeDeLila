import {
  getPendingChooseTargetActionsForPlayer,
  getPendingDrawActionsForPlayer,
  validatePendingChooseTargetActionForActor,
  validatePendingDrawActionForActor,
} from './pending-actions-rulebook.helper';

describe('pending-actions-rulebook.helper', () => {
  it('handles pending draw actions and validation', () => {
    const pending = { type: 'draw', playerId: '7' };
    expect(
      getPendingDrawActionsForPlayer(pending, 7, {
        samePlayer: (a, b) => Number(a) === Number(b),
      }),
    ).toEqual([{ type: 'draw', payload: {} }]);

    expect(
      validatePendingDrawActionForActor({
        pending,
        actorId: 7,
        actionType: 'draw',
        samePlayer: (a, b) => Number(a) === Number(b),
      }),
    ).toEqual({ ok: true, action: { type: 'draw', payload: {} } });

    expect(
      validatePendingDrawActionForActor({
        pending,
        actorId: 7,
        actionType: 'roll',
        samePlayer: (a, b) => Number(a) === Number(b),
      }),
    ).toEqual({ ok: false, reason: 'wrong_action_type' });
  });

  it('handles pending choose_target actions and validation', () => {
    const pending = {
      type: 'choose_target',
      playerId: 2,
      data: { targets: [{ targetPlayerId: 3 }, { targetPlayerId: 5 }] },
    };

    expect(getPendingChooseTargetActionsForPlayer(pending, 2)).toEqual([
      { type: 'choose_target', payload: { targetPlayerId: 3 } },
      { type: 'choose_target', payload: { targetPlayerId: 5 } },
    ]);

    expect(
      validatePendingChooseTargetActionForActor({
        pending,
        actorId: 2,
        actionType: 'choose_target',
        payload: { targetPlayerId: 5 },
      }),
    ).toEqual({
      ok: true,
      targetPlayerId: 5,
      action: { type: 'choose_target', payload: { targetPlayerId: 5 } },
    });

    expect(
      validatePendingChooseTargetActionForActor({
        pending,
        actorId: 2,
        actionType: 'choose_target',
        payload: { targetPlayerId: 4 },
      }),
    ).toEqual({ ok: false, reason: 'invalid_target', targetPlayerId: 4 });
  });
});

