import { createLamaServiceForTest } from '../../tests/lama-test-harness';

describe('LamaService round settlement', () => {
  it('scores only distinct remaining card values at end of round', async () => {
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
        deck: [],
        discard: [1],
        handsByPlayerId: { '1': [1], '2': [3, 3, 4, 4, 7] },
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

    // B keeps 3,4,LAMA => 3+4+10 = 17 (duplicates ignored).
    expect(Number(after.metadata?.scoresByPlayerId?.['2'] ?? 0)).toBe(17);
    // Winner has 0 token, so there is nothing to return: auto-advance to next round.
    expect(Number(after.metadata?.pendingReturnPlayerId ?? 0)).toBe(0);
  });

  it('enters a round pause instead of starting the next round immediately (when configured)', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 10,
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
        loseAtScore: 100,
        roundPauseSeconds: 2,
        roundPauseUntilMs: null,
        roundNumber: 1,
        roundStarterIndex: 0,
        deck: [6],
        discard: [1],
        handsByPlayerId: { '1': [1], '2': [2] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        step: 'return_token',
        pendingReturnQueue: [1],
        pendingReturnPlayerId: 1,
        winnerId: null,
      },
    };

    const after: any = service.applyActions(state, [
      {
        type: 'lama_return',
        payload: { value: 0 },
        meta: { actorId: 1 },
      } as any,
    ]);
    expect(String(after.metadata?.step ?? '')).toBe('round_pause');
    expect(Number(after.round ?? 0)).toBe(2);
    expect(typeof after.metadata?.roundPauseUntilMs).toBe('number');
  });

  it('does not score/end the same round twice (idempotent endRound)', async () => {
    const { service } = createLamaServiceForTest();

    const endedState: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 10,
      lastRoll: null,
      log: [
        { message: 'Fin de la manche 1.' },
        { message: 'Lilas prend 12 jetons (pénalité).' },
        { message: 'Grosminet gagne la manche.' },
      ],
      players: [
        { id: 1, username: 'Lilas' },
        { id: 2, username: 'Grosminet' },
      ],
      turn: { currentPlayerId: 2, direction: 1 },
      pending: { step: 'turn_choice', playerId: 2 },
      metadata: {
        ownerPlayerId: 1,
        loseAtScore: 40,
        roundPauseSeconds: 0,
        roundPauseUntilMs: null,
        roundNumber: 1,
        roundStarterIndex: 0,
        endedRoundNumber: 1,
        deck: [1],
        discard: [6],
        handsByPlayerId: { '1': [1, 2], '2': [5] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 12, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const after: any = service.applyActions(endedState, [
      { type: 'lama_quit', payload: {}, meta: { actorId: 2 } } as any,
    ]);

    // No duplicate "Fin de la manche" or extra penalties.
    const messages = (after.log ?? []).map((l: any) =>
      String(l?.message ?? ''),
    );
    expect(
      messages.filter((m: string) => m === 'Fin de la manche 1.').length,
    ).toBe(1);
    expect(Number(after.metadata?.scoresByPlayerId?.['1'] ?? 0)).toBe(12);
  });

  it('reconciles endRound when log already contains round end (no duplicate messages)', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 3,
      turnIndex: 10,
      lastRoll: null,
      log: [
        { message: 'Fin de la manche 3.' },
        { message: 'Lilas prend 17 jetons (pénalité).' },
        { message: 'Casper gagne la manche.' },
      ],
      players: [
        { id: 1, username: 'Lilas' },
        { id: 2, username: 'Casper' },
      ],
      turn: { currentPlayerId: 2, direction: 1 },
      pending: { step: 'turn_choice', playerId: 2 },
      metadata: {
        ownerPlayerId: 1,
        loseAtScore: 40,
        roundPauseSeconds: 2,
        roundPauseUntilMs: null,
        roundNumber: 3,
        roundStarterIndex: 0,
        endedRoundNumber: null,
        deck: [1],
        discard: [6],
        handsByPlayerId: { '1': [1, 2], '2': [6] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 17, '2': 1 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    // Trigger endRound through a normal action; the service must not append another "Fin de la manche 3."
    // and must reconcile the pending "return_token" for the winner.
    const after: any = service.applyActions(state, [
      { type: 'lama_quit', payload: {}, meta: { actorId: 2 } } as any,
    ]);

    const messages = (after.log ?? []).map((l: any) =>
      String(l?.message ?? ''),
    );
    expect(
      messages.filter((m: string) => m === 'Fin de la manche 3.').length,
    ).toBe(1);
    expect(String(after.metadata?.step ?? '')).toBe('return_token');
    expect(Number(after.metadata?.endedRoundNumber ?? 0)).toBe(3);
  });

  it('auto-skips return_token when winner has 0 token', async () => {
    const { service } = createLamaServiceForTest();

    const base: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Winner' },
        { id: 2, username: 'Loser' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: { step: 'turn_choice', playerId: 1 },
      metadata: {
        ownerPlayerId: 1,
        loseAtScore: 40,
        roundPauseSeconds: 0,
        roundPauseUntilMs: null,
        roundNumber: 1,
        roundStarterIndex: 0,
        endedRoundNumber: null,
        deck: [1],
        discard: [1],
        handsByPlayerId: { '1': [1], '2': [2, 3, 7] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const after: any = service.applyActions(base, [
      { type: 'lama_play', payload: { value: 1 }, meta: { actorId: 1 } } as any,
    ]);

    // Loser gets penalty, Winner stays at 0 => no return_token prompt should happen.
    expect(Number(after.metadata?.scoresByPlayerId?.['2'] ?? 0)).toBe(
      2 + 3 + 10,
    );
    expect(Number(after.metadata?.scoresByPlayerId?.['1'] ?? 0)).toBe(0);
    expect(Number(after.metadata?.pendingReturnPlayerId ?? 0)).toBe(0);
    const messages = (after.log ?? []).map((l: any) =>
      String(l?.message ?? ''),
    );
    expect(messages.some((m: string) => m.includes("n'a rien à rendre"))).toBe(
      true,
    );
  });

  it('n’invite pas au retour de jetons après la première manche', async () => {
    const { service } = createLamaServiceForTest();

    const base: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Winner' },
        { id: 2, username: 'Loser' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: { step: 'turn_choice', playerId: 1 },
      metadata: {
        ownerPlayerId: 1,
        loseAtScore: 40,
        roundPauseSeconds: 0,
        roundPauseUntilMs: null,
        roundNumber: 1,
        roundStarterIndex: 0,
        deck: [],
        discard: [1],
        handsByPlayerId: { '1': [1], '2': [2, 3, 7] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 5, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const after: any = service.applyActions(base, [
      { type: 'lama_play', payload: { value: 1 }, meta: { actorId: 1 } } as any,
    ]);

    expect(Number(after.metadata?.scoresByPlayerId?.['2'] ?? 0)).toBe(
      2 + 3 + 10,
    );
    expect(Number(after.metadata?.scoresByPlayerId?.['1'] ?? 0)).toBe(5);
    expect(String(after.metadata?.step ?? '')).toBe('turn_choice');
    expect(after.metadata?.pendingReturnPlayerId).toBeNull();
  });

  it('invite au retour de jetons des la premiere manche quand configure', async () => {
    const { service } = createLamaServiceForTest();

    const base: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Winner' },
        { id: 2, username: 'Loser' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: { step: 'turn_choice', playerId: 1 },
      metadata: {
        ownerPlayerId: 1,
        loseAtScore: 40,
        roundPauseSeconds: 0,
        roundPauseUntilMs: null,
        returnTokenFromRound: 1,
        roundNumber: 1,
        roundStarterIndex: 0,
        deck: [],
        discard: [1],
        handsByPlayerId: { '1': [1], '2': [2, 3] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 5, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const after: any = service.applyActions(base, [
      { type: 'lama_play', payload: { value: 1 }, meta: { actorId: 1 } } as any,
    ]);

    expect(String(after.metadata?.step ?? '')).toBe('return_token');
    expect(Number(after.metadata?.pendingReturnPlayerId ?? 0)).toBe(1);
  });
});
