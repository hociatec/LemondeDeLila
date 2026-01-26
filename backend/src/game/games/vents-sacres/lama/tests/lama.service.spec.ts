import { createLamaServiceForTest } from './lama-test-harness';

describe('LamaService', () => {
  it('exposes pending choices only for current player', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      log: [],
      metadata: {},
    } as any);

    const exposedA: any = service.exposeStateForUser(state, 1);
    const exposedB: any = service.exposeStateForUser(state, 2);

    expect(exposedA.pending).not.toBeNull();
    expect(Number(exposedA.pending?.playerId ?? 0)).toBe(1);
    expect(exposedB.pending).toBeNull();
  });

  it('starts with a single setup prompt, then starts the first round', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Owner' },
        { id: 2, username: 'B' },
      ],
      log: [],
      metadata: {},
    } as any);

    expect(String(state.status)).toBe('started');
    expect(String(state.phase)).toBe('setup');
    const exposed: any = service.exposeStateForUser(state, 1);
    expect(String(exposed?.pending?.type ?? '')).toBe('config_prompt');
    expect((exposed?.actions ?? []).some((a: any) => a?.type === 'lama_set_config')).toBe(true);

    const started: any = service.applyActions(state, [
      {
        type: 'lama_set_config',
        payload: { loseAtScore: 40, roundPauseSeconds: 2, allowPlayAfterDraw: 'true' },
        meta: { actorId: 1 },
      } as any,
    ]);
    expect(String(started.phase)).toBe('round');
    expect(Number(started.metadata?.roundPauseSeconds ?? -1)).toBe(2);
    expect(Number(started.metadata?.loseAtScore ?? 0)).toBe(40);
    expect(Boolean(started.metadata?.allowPlayAfterDraw)).toBe(true);
    expect((started.metadata?.discard ?? []).length).toBeGreaterThan(0);
  });

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
    expect(['lama_play', 'draw', 'lama_quit', 'lama_return']).toContain(actions[0].type);
  });

  it('declares keyboard shortcuts', async () => {
    const { service } = createLamaServiceForTest();

    const shortcuts = service.getShortcuts({
      metadata: {},
      currentPlayerId: 1,
      started: true,
    });

    expect(shortcuts.some((s: any) => s?.type === 'interface' && s?.id === 'discard')).toBe(true);
    expect(shortcuts.some((s: any) => s?.type === 'interface' && s?.id === 'hands')).toBe(true);
    expect(shortcuts.some((s: any) => s?.type === 'interface' && s?.id === 'score')).toBe(true);
    expect(
      shortcuts.some(
        (s: any) => s?.type === 'action' && s?.actionType === 'lama_quit',
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

    // Le bot ne doit pas re-piocher indéfiniment : il doit passer après avoir déjà pioché.
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
    const handAfterFirst = (afterFirst.metadata.handsByPlayerId?.['2'] ?? []).length;

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
    expect((afterSecond.metadata.handsByPlayerId?.['2'] ?? []).length).toBe(handAfterFirst);
    const messages = (afterSecond.log ?? []).map((l: any) => String(l?.message ?? ''));
    expect(messages.filter((m: string) => m === 'Bot pioche.').length).toBe(1);
  });

  it('includes discard top in pending label', async () => {
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
        deck: [],
        discard: [6],
        handsByPlayerId: { '1': [7], '2': [] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const exposed: any = service.exposeStateForUser(state, 1);
    const label = String(exposed?.pending?.label ?? '');
    expect(label).toContain('Défausse');
    expect(label).toContain('6');
  });

  it('logs every player action (for NVDA announcements)', async () => {
    const { service } = createLamaServiceForTest();

    const base: any = {
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
      pending: { step: 'turn_choice', playerId: 1 },
      metadata: {
        step: 'turn_choice',
        allowPlayAfterDraw: false,
        roundNumber: 1,
        roundStarterIndex: 0,
        deck: [2, 3, 4],
        discard: [1],
        handsByPlayerId: { '1': [1], '2': [1] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        turnTracker: { playerId: 1, drawn: false, played: false },
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    // draw
    const afterDraw: any = service.applyActions(base, [
      { type: 'draw', payload: {}, meta: { actorId: 1 } } as any,
    ]);
    expect(afterDraw.log.length).toBeGreaterThan(base.log.length);
    const drawMessages = afterDraw.log
      .slice(base.log.length)
      .map((l: any) => String(l?.message ?? ''));
    expect(drawMessages.some((m: string) => m.includes('pioche'))).toBe(true);

    // play
    const afterPlay: any = service.applyActions(base, [
      { type: 'lama_play', payload: { value: 1 }, meta: { actorId: 1 } } as any,
    ]);
    expect(afterPlay.log.length).toBeGreaterThan(base.log.length);
    const playMessages = afterPlay.log
      .slice(base.log.length)
      .map((l: any) => String(l?.message ?? ''));
    expect(playMessages.some((m: string) => m.includes('joue'))).toBe(true);

    // quit
    const afterQuit: any = service.applyActions(base, [
      { type: 'lama_quit', payload: {}, meta: { actorId: 1 } } as any,
    ]);
    expect(afterQuit.log.length).toBeGreaterThan(base.log.length);
    const quitMessages = afterQuit.log
      .slice(base.log.length)
      .map((l: any) => String(l?.message ?? ''));
    expect(quitMessages.some((m: string) => m.includes('se retire'))).toBe(true);
    expect(quitMessages.some((m: string) => m.includes('ne jouera plus'))).toBe(true);

    // peek discard (info action)
    const afterPeek: any = service.applyActions(base, [
      { type: 'lama_peek_discard', payload: {}, meta: { actorId: 1 } } as any,
    ]);
    expect(afterPeek.log.length).toBeGreaterThan(base.log.length);
    const peekMessages = afterPeek.log
      .slice(base.log.length)
      .map((l: any) => String(l?.message ?? ''));
    expect(peekMessages.some((m: string) => m.includes('défausse'))).toBe(true);

    // pass (requires allowPlayAfterDraw + drawn=true)
    const passState: any = {
      ...base,
      metadata: {
        ...base.metadata,
        allowPlayAfterDraw: true,
        turnTracker: { playerId: 1, drawn: true, played: false },
      },
    };
    const afterPass: any = service.applyActions(passState, [
      { type: 'lama_pass', payload: {}, meta: { actorId: 1 } } as any,
    ]);
    expect(afterPass.log.length).toBeGreaterThan(passState.log.length);
    const passMessages = afterPass.log
      .slice(passState.log.length)
      .map((l: any) => String(l?.message ?? ''));
    expect(passMessages.some((m: string) => m.includes('passe'))).toBe(true);

    // return token (requires return_token step)
    const returnState: any = {
      ...base,
      metadata: {
        ...base.metadata,
        step: 'return_token',
        pendingReturnQueue: [1],
        pendingReturnPlayerId: 1,
        scoresByPlayerId: { '1': 10, '2': 0 },
      },
      pending: { step: 'return_token', playerId: 1 },
    };
    const afterReturn: any = service.applyActions(returnState, [
      { type: 'lama_return', payload: { value: 10 }, meta: { actorId: 1 } } as any,
    ]);
    expect(afterReturn.log.length).toBeGreaterThan(returnState.log.length);
    const returnMessages = afterReturn.log
      .slice(returnState.log.length)
      .map((l: any) => String(l?.message ?? ''));
    expect(returnMessages.some((m: string) => m.includes('diamant'))).toBe(true);
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

    const messages = (after.log ?? []).map((l: any) => String(l?.message ?? ''));
    expect(messages.some((m: string) => m.includes('doit piocher'))).toBe(true);
    expect(messages.filter((m: string) => m === 'Bot pioche.').length).toBe(1);
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
    const handAfterFirst = (afterFirst.metadata.handsByPlayerId?.['2'] ?? []).length;

    const afterSecond: any = service.applyActions(afterFirst, [
      { type: 'draw', payload: {}, meta: { actorId: 2 } } as any,
    ]);

    // Second draw is ignored (one draw per turn).
    expect((afterSecond.metadata.deck ?? []).length).toBe(deckAfterFirst);
    expect((afterSecond.metadata.handsByPlayerId?.['2'] ?? []).length).toBe(handAfterFirst);
    const messages = (afterSecond.log ?? []).map((l: any) => String(l?.message ?? ''));
    expect(messages.filter((m: string) => m === 'Bot pioche.').length).toBe(1);
  });

  it('offers only single-card plays in pending choices', async () => {
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
        deck: [],
        discard: [1],
        handsByPlayerId: { '1': [1, 1, 1], '2': [] },
        droppedOutByPlayerId: { '1': false, '2': false },
        scoresByPlayerId: { '1': 0, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const exposed: any = service.exposeStateForUser(state, 1);
    const choices = exposed?.pending?.choices ?? [];
    expect(choices).toEqual(['1', '1', '1']);

    const playActions = (exposed?.actions ?? []).filter((a: any) => a?.type === 'lama_play');
    expect(playActions.length).toBe(3);
    expect(playActions.every((a: any) => Number(a?.payload?.count ?? 0) === 1)).toBe(true);
  });

  it('does not offer draw/quit in pending choices (draw is via SPACE)', async () => {
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
        deck: [6],
        discard: [1],
        handsByPlayerId: { '1': [1, 2], '2': [] },
        droppedOutByPlayerId: {},
        scoresByPlayerId: { '1': 0, '2': 0 },
        step: 'turn_choice',
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
        winnerId: null,
      },
    };

    const exposed: any = service.exposeStateForUser(state, 1);
    const choices = (exposed?.pending?.choices ?? []).map((c: any) => String(c));
    // The hand list contains only cards.
    expect(choices.every((c: string) => ['1', '2', '3', '4', '5', '6', 'LAMA'].includes(c))).toBe(true);

    const actionTypes = (exposed?.actions ?? []).map((a: any) =>
      String(a?.type ?? '').toLowerCase(),
    );
    expect(actionTypes).toContain('draw');
    expect(actionTypes).toContain('lama_quit');
  });

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

  it('can keep the turn after a draw when configured', async () => {
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
    // Still your turn, but you can't draw twice.
    expect(actionTypes).not.toContain('draw');
    expect(actionTypes).toContain('lama_play');
    expect(actionTypes).toContain('lama_pass');
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
      { type: 'lama_play', payload: { value: 1, count: 1 }, meta: { actorId: 1 } } as any,
    ]);

    expect(after.turn.currentPlayerId).toBe(2);
  });

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
      { type: 'lama_play', payload: { value: 1, count: 1 }, meta: { actorId: 1 } } as any,
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
      { type: 'lama_return', payload: { value: 0 }, meta: { actorId: 1 } } as any,
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
    const messages = (after.log ?? []).map((l: any) => String(l?.message ?? ''));
    expect(messages.filter((m: string) => m === 'Fin de la manche 1.').length).toBe(1);
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

    const messages = (after.log ?? []).map((l: any) => String(l?.message ?? ''));
    expect(messages.filter((m: string) => m === 'Fin de la manche 3.').length).toBe(1);
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
    expect(Number(after.metadata?.scoresByPlayerId?.['2'] ?? 0)).toBe(2 + 3 + 10);
    expect(Number(after.metadata?.scoresByPlayerId?.['1'] ?? 0)).toBe(0);
    expect(Number(after.metadata?.pendingReturnPlayerId ?? 0)).toBe(0);
    const messages = (after.log ?? []).map((l: any) => String(l?.message ?? ''));
    expect(messages.some((m: string) => m.includes("n'a rien à rendre"))).toBe(true);
  });
});
