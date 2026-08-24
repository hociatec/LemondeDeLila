import { createLamaServiceForTest } from '../../tests/lama-test-harness';

describe('LamaService turns', () => {
  it('passes the turn after a draw', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
      metadata: {
        roundNumber: 1,
        roundStarterIndex: 0,
        deck: [6, 5],
        discard: [1],
        handsByPlayerId: { '1': [1], '2': [2] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const after: any = service.applyActions(state, [
      { type: 'draw', payload: {}, meta: { actorId: 1 } } as any,
    ]);

    expect(after.turn.currentPlayerId).toBe(2);
    expect((after.metadata.deck ?? []).length).toBe(1);
    expect((after.metadata.handsByPlayerId?.['1'] ?? []).length).toBe(2);
  });

  it('blocks draw after at least one player has quit the round', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 5,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
      metadata: {
        roundNumber: 1,
        roundStarterIndex: 0,
        deck: [6, 5],
        discard: [1],
        handsByPlayerId: { '1': [2], '2': [3] },
        droppedOutByPlayerId: { '1': false, '2': true },
        scoresByPlayerId: { '1': 0, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const exposed: any = service.exposeStateForUser(state, 1);
    const actionTypes = (exposed?.actions ?? []).map((a: any) =>
      String(a?.type ?? '').toLowerCase(),
    );
    expect(actionTypes).not.toContain('draw');

    const after: any = service.applyActions(state, [
      { type: 'draw', payload: {}, meta: { actorId: 1 } } as any,
    ]);

    expect(after.turnIndex).toBe(state.turnIndex);
    expect((after.metadata?.deck ?? []).length).toBe(
      (state.metadata?.deck ?? []).length,
    );
    expect((after.metadata?.handsByPlayerId?.['1'] ?? []).length).toBe(
      (state.metadata?.handsByPlayerId?.['1'] ?? []).length,
    );
  });

  it('allows draw after another player has quit when configured', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 5,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
      metadata: {
        roundNumber: 1,
        roundStarterIndex: 0,
        allowDrawAfterFirstQuit: true,
        deck: [6, 5],
        discard: [1],
        handsByPlayerId: { '1': [2], '2': [3] },
        droppedOutByPlayerId: { '1': false, '2': true },
        scoresByPlayerId: { '1': 0, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const exposed: any = service.exposeStateForUser(state, 1);
    const actionTypes = (exposed?.actions ?? []).map((a: any) =>
      String(a?.type ?? '').toLowerCase(),
    );
    expect(actionTypes).toContain('draw');

    const after: any = service.applyActions(state, [
      { type: 'draw', payload: {}, meta: { actorId: 1 } } as any,
    ]);

    expect((after.metadata?.deck ?? []).length).toBe(1);
    expect((after.metadata?.handsByPlayerId?.['1'] ?? []).length).toBe(2);
  });

  it('keeps the turn after a draw when allowPlayAfterDraw is configured', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
      metadata: {
        roundNumber: 1,
        roundStarterIndex: 0,
        allowPlayAfterDraw: true,
        turnTracker: { playerId: 1, drawn: false, played: false },
        deck: [6, 5],
        discard: [1],
        handsByPlayerId: { '1': [1], '2': [2] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const after: any = service.applyActions(state, [
      { type: 'draw', payload: {}, meta: { actorId: 1 } } as any,
    ]);

    expect(after.turn.currentPlayerId).toBe(1);
    expect((after.metadata.deck ?? []).length).toBe(1);
    expect((after.metadata.handsByPlayerId?.['1'] ?? []).length).toBe(2);
    expect(Boolean(after.metadata?.turnTracker?.drawn)).toBe(true);

    const exposed: any = service.exposeStateForUser(after, 1);
    const actionTypes = (exposed?.actions ?? []).map((a: any) =>
      String(a?.type ?? '').toLowerCase(),
    );
    // Turn is kept by the same player: draw is blocked, play/quit stay available.
    expect(actionTypes).not.toContain('draw');
    expect(actionTypes).toContain('lama_play');
    expect(actionTypes).toContain('lama_pass');
    expect(actionTypes).toContain('lama_quit');
  });

  it('does not lock draw because of eliminated players', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
        { id: 3, username: 'C' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: { step: 'turn_choice', playerId: 1 },
      metadata: {
        roundNumber: 1,
        roundStarterIndex: 0,
        allowDrawAfterFirstQuit: false,
        allowPlayAfterDraw: false,
        deck: [6, 5],
        discard: [1],
        handsByPlayerId: { '1': [3], '2': [4] }, // player 3 eliminated: not in round hands
        droppedOutByPlayerId: { '1': false, '2': false, '3': true },
        eliminatedByPlayerId: { '3': true },
        scoresByPlayerId: { '1': 0, '2': 0, '3': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const exposed: any = service.exposeStateForUser(state, 1);
    const actionTypes = (exposed?.actions ?? []).map((a: any) =>
      String(a?.type ?? '').toLowerCase(),
    );
    expect(actionTypes).toContain('draw');

    const after: any = service.applyActions(state, [
      { type: 'draw', payload: {}, meta: { actorId: 1 } } as any,
    ]);
    expect((after.metadata?.deck ?? []).length).toBe(1);
    expect((after.metadata?.handsByPlayerId?.['1'] ?? []).length).toBe(2);
  });

  it('does not allow multiple draws in a single message from the same actor', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
      metadata: {
        roundNumber: 1,
        roundStarterIndex: 0,
        deck: [6, 5],
        discard: [1],
        handsByPlayerId: { '1': [1], '2': [2] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const after: any = service.applyActions(state, [
      { type: 'draw', payload: {}, meta: { actorId: 1 } } as any,
      { type: 'draw', payload: {}, meta: { actorId: 1 } } as any,
    ]);

    // Only the first draw applies; second is rejected because it's no longer actor 1's turn.
    expect((after.metadata.deck ?? []).length).toBe(1);
    expect((after.metadata.handsByPlayerId?.['1'] ?? []).length).toBe(2);
    expect(after.turn.currentPlayerId).toBe(2);
  });

  it('passes the turn after playing', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
      metadata: {
        ownerPlayerId: 1,
        loseAtScore: 40,
        roundNumber: 1,
        roundStarterIndex: 0,
        deck: [6, 5],
        discard: [1],
        handsByPlayerId: { '1': [1, 2], '2': [2] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const after: any = service.applyActions(state, [
      {
        type: 'lama_play',
        payload: { value: 1, count: 1 },
        meta: { actorId: 1 },
      } as any,
    ]);

    expect(after.turn.currentPlayerId).toBe(2);
  });
});
