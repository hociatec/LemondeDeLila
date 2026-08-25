import { createLamaServiceForTest } from '../../tests/lama-test-harness';

describe('LamaService presentation', () => {
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
    expect(exposed?.extras?.ui?.panels?.discard?.message).toBe(
      'Carte au-dessus : 6.',
    );
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
    expect(quitMessages.some((m: string) => m.includes('se retire'))).toBe(
      true,
    );
    expect(quitMessages.some((m: string) => m.includes('ne jouera plus'))).toBe(
      true,
    );

    // peek discard (info action)
    const afterPeek: any = service.applyActions(base, [
      { type: 'lama_peek_discard', payload: {}, meta: { actorId: 1 } } as any,
    ]);
    expect(afterPeek.log.length).toBeGreaterThan(base.log.length);
    const peekMessages = afterPeek.log
      .slice(base.log.length)
      .map((l: any) => String(l?.message ?? ''));
    expect(peekMessages.some((m: string) => m.includes('défausse'))).toBe(true);

    // pass (end of turn after draw when allowPlayAfterDraw is enabled)
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
    expect(Boolean(afterPass.metadata?.droppedOutByPlayerId?.['1'])).toBe(
      false,
    );
    expect(Number(afterPass.turn?.currentPlayerId ?? 0)).toBe(2);

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
      {
        type: 'lama_return',
        payload: { value: 10 },
        meta: { actorId: 1 },
      } as any,
    ]);
    expect(afterReturn.log.length).toBeGreaterThan(returnState.log.length);
    const returnMessages = afterReturn.log
      .slice(returnState.log.length)
      .map((l: any) => String(l?.message ?? ''));
    expect(returnMessages.some((m: string) => m.includes('diamant'))).toBe(
      true,
    );
  });

  it('redacts drawn card labels in the log for opponents (only the drawer sees the card)', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
      log: [
        { message: 'A pioche un 5.' },
        { message: 'B pioche un LAMA.' },
        { message: 'B passe.' },
      ],
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

    const exposedA: any = service.exposeStateForUser(state, 1);
    const exposedB: any = service.exposeStateForUser(state, 2);

    const messagesA = (exposedA.log ?? []).map((l: any) =>
      String(l?.message ?? ''),
    );
    const messagesB = (exposedB.log ?? []).map((l: any) =>
      String(l?.message ?? ''),
    );

    expect(messagesA).toContain('A pioche un 5.');
    expect(messagesA).toContain('B pioche une carte.');
    expect(messagesA).not.toContain('B pioche un LAMA.');

    expect(messagesB).toContain('B pioche un LAMA.');
    expect(messagesB).toContain('A pioche une carte.');
    expect(messagesB).not.toContain('A pioche un 5.');
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

    const playActions = (exposed?.actions ?? []).filter(
      (a: any) => a?.type === 'lama_play',
    );
    expect(playActions.length).toBe(3);
    expect(
      playActions.every((a: any) => Number(a?.payload?.count ?? 0) === 1),
    ).toBe(true);
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
    const choices = (exposed?.pending?.choices ?? []).map((c: any) =>
      String(c),
    );
    // The hand list contains only cards.
    expect(
      choices.every((c: string) =>
        ['1', '2', '3', '4', '5', '6', 'LAMA'].includes(c),
      ),
    ).toBe(true);

    const actionTypes = (exposed?.actions ?? []).map((a: any) =>
      String(a?.type ?? '').toLowerCase(),
    );
    expect(actionTypes).toContain('draw');
    expect(actionTypes).toContain('lama_quit');
  });
});
