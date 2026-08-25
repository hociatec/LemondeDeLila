import { createLamaServiceForTest } from '../../tests/lama-test-harness';

describe('LamaService bots and shortcuts', () => {
  it('suggests a bot action on its turn', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Human' },
        { id: 2, username: 'Bot', isBot: true },
      ],
      turn: { currentPlayerId: 2, direction: 1 },
      pending: null,
      metadata: {
        roundNumber: 1,
        roundStarterIndex: 0,
        deck: [1],
        discard: [1],
        handsByPlayerId: { '2': [1, 1] },
        droppedOutByPlayerId: { '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const actions = service.getBotActions(state, 2);
    expect(actions.length).toBeGreaterThan(0);
    expect(['lama_play', 'draw', 'lama_quit', 'lama_return']).toContain(
      actions[0].type,
    );
  });

  it('declares keyboard shortcuts', async () => {
    const { service } = createLamaServiceForTest();

    const shortcuts = service.getShortcuts({
      metadata: {},
      currentPlayerId: 1,
      started: true,
    });

    expect(
      shortcuts.some(
        (s: any) => s?.type === 'interface' && s?.id === 'discard',
      ),
    ).toBe(true);
    expect(
      shortcuts.some((s: any) => s?.type === 'interface' && s?.id === 'hands'),
    ).toBe(true);
    expect(
      shortcuts.some((s: any) => s?.type === 'interface' && s?.id === 'score'),
    ).toBe(true);
    expect(
      shortcuts.some(
        (s: any) =>
          s?.key === 'pressed P' &&
          s?.type === 'action' &&
          s?.actionType === 'lama_quit',
      ),
    ).toBe(true);
    expect(shortcuts.some((s: any) => s?.key === 'pressed Q')).toBe(false);
    expect(
      shortcuts.some(
        (s: any) =>
          s?.key === 'pressed SPACE' &&
          s?.type === 'action' &&
          s?.actionType === 'draw',
      ),
    ).toBe(true);
  });

  it('prevents infinite bot draw loop when turnTracker is serialized as strings', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Human' },
        { id: 2, username: 'Bot', isBot: true },
      ],
      turn: { currentPlayerId: 2, direction: 1 },
      pending: { step: 'turn_choice', playerId: 2 },
      metadata: {
        allowPlayAfterDraw: true,
        step: 'turn_choice',
        deck: [1, 2, 3, 4],
        discard: [1],
        handsByPlayerId: { '2': [5, 6] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        // Simule une sérialisation "string" (cause typique de mismatch strict).
        turnTracker: { playerId: '2', drawn: 'true', played: 'false' },
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        roundNumber: 1,
        roundStarterIndex: 0,
        winnerId: null,
      },
    };

    // Le bot ne doit pas re-piocher indéfiniment : il doit se retirer de la manche après avoir déjà pioché.
    const actions = service.getBotActions(state, 2);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('lama_pass');
  });

  it('prevents multiple consecutive draws even if turnTracker becomes desynced', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Human' },
        { id: 2, username: 'Bot', isBot: true },
      ],
      turn: { currentPlayerId: 2, direction: 1 },
      pending: { step: 'turn_choice', playerId: 2 },
      metadata: {
        step: 'turn_choice',
        allowPlayAfterDraw: true,
        roundNumber: 1,
        roundStarterIndex: 0,
        deck: [1, 7], // top draw is LAMA => keeps the turn when discard is 6
        discard: [6],
        handsByPlayerId: { '1': [1], '2': [1, 2, 3, 4, 5] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        turnTracker: { playerId: 2, drawn: false, played: false },
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const afterFirst: any = service.applyActions(state, [
      { type: 'draw', payload: {}, meta: { actorId: 2 } } as any,
    ]);
    expect(afterFirst.turn.currentPlayerId).toBe(2);
    const deckAfterFirst = (afterFirst.metadata.deck ?? []).length;
    const handAfterFirst = (afterFirst.metadata.handsByPlayerId?.['2'] ?? [])
      .length;

    // Simule un bug externe: tracker du tour ne correspond plus au joueur courant.
    const desynced: any = {
      ...afterFirst,
      metadata: {
        ...afterFirst.metadata,
        turnTracker: { playerId: 1, drawn: false, played: false },
      },
    };

    const afterSecond: any = service.applyActions(desynced, [
      { type: 'draw', payload: {}, meta: { actorId: 2 } } as any,
    ]);

    // La 2e pioche doit être ignorée (même si turnTracker est incohérent).
    expect((afterSecond.metadata.deck ?? []).length).toBe(deckAfterFirst);
    expect((afterSecond.metadata.handsByPlayerId?.['2'] ?? []).length).toBe(
      handAfterFirst,
    );
    const messages = (afterSecond.log ?? []).map((l: any) =>
      String(l?.message ?? ''),
    );
    expect(
      messages.filter((m: string) => (m ?? '').startsWith('Bot pioche '))
        .length,
    ).toBe(1);
  });

  it('logs "doit piocher" before a bot draw (no double draw)', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Human' },
        { id: 2, username: 'Bot', isBot: true },
      ],
      turn: { currentPlayerId: 2, direction: 1 },
      pending: { step: 'turn_choice', playerId: 2 },
      metadata: {
        step: 'turn_choice',
        allowPlayAfterDraw: true,
        roundNumber: 1,
        roundStarterIndex: 0,
        deck: [2, 3, 4],
        discard: [1],
        handsByPlayerId: { '1': [1], '2': [5, 6] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        turnTracker: { playerId: 2, drawn: false, played: false },
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const after: any = service.applyActions(state, [
      { type: 'draw', payload: {}, meta: { actorId: 2 } } as any,
    ]);

    const messages = (after.log ?? []).map((l: any) =>
      String(l?.message ?? ''),
    );
    expect(messages.some((m: string) => m.includes('doit piocher'))).toBe(true);
    expect(
      messages.filter((m: string) => (m ?? '').startsWith('Bot pioche '))
        .length,
    ).toBe(1);
  });

  it('prevents a bot from drawing multiple times while still on its turn', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Human' },
        { id: 2, username: 'Bot', isBot: true },
      ],
      turn: { currentPlayerId: 2, direction: 1 },
      pending: { step: 'turn_choice', playerId: 2 },
      metadata: {
        step: 'turn_choice',
        allowPlayAfterDraw: true,
        roundNumber: 1,
        roundStarterIndex: 0,
        deck: [1, 7], // ensures the bot can keep the turn after drawing (draws a LAMA)
        discard: [6],
        handsByPlayerId: { '1': [1], '2': [2, 3, 4, 5, 6] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        turnTracker: { playerId: 2, drawn: false, played: false },
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const afterFirst: any = service.applyActions(state, [
      { type: 'draw', payload: {}, meta: { actorId: 2 } } as any,
    ]);
    expect(afterFirst.turn.currentPlayerId).toBe(2);
    expect(Boolean(afterFirst.metadata?.turnTracker?.drawn)).toBe(true);
    const deckAfterFirst = (afterFirst.metadata.deck ?? []).length;
    const handAfterFirst = (afterFirst.metadata.handsByPlayerId?.['2'] ?? [])
      .length;

    const afterSecond: any = service.applyActions(afterFirst, [
      { type: 'draw', payload: {}, meta: { actorId: 2 } } as any,
    ]);

    // Second draw is ignored (one draw per turn), even if turn is kept.
    expect((afterSecond.metadata.deck ?? []).length).toBe(deckAfterFirst);
    expect((afterSecond.metadata.handsByPlayerId?.['2'] ?? []).length).toBe(
      handAfterFirst,
    );
    const messages = (afterSecond.log ?? []).map((l: any) =>
      String(l?.message ?? ''),
    );
    expect(
      messages.filter((m: string) => (m ?? '').startsWith('Bot pioche '))
        .length,
    ).toBe(1);
  });
});
