import { createLamaServiceForTest } from '../../tests/lama-test-harness';

describe('LamaService setup', () => {
  it('does not assign setup ownership to a bot (prefers first human)', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 2, direction: 1 },
      players: [
        { id: 2, username: 'Bot', isBot: true },
        { id: 1, username: 'Human' },
      ],
      log: [],
      metadata: {},
    } as any);

    expect(Number(state?.metadata?.ownerPlayerId ?? 0)).toBe(1);
    expect(Number(state?.turn?.currentPlayerId ?? 0)).toBe(1);

    const exposedHuman: any = service.exposeStateForUser(state, 1);
    const exposedBot: any = service.exposeStateForUser(state, 2);
    expect(exposedHuman.pending).not.toBeNull();
    expect(Number(exposedHuman.pending?.playerId ?? 0)).toBe(1);
    expect(exposedBot.pending).toBeNull();
  });

  it('ignores roomOwnerId if it points to a bot (still prefers a human owner)', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 2, direction: 1 },
      players: [
        { id: 2, username: 'Bot', isBot: true },
        { id: 1, username: 'Human' },
      ],
      log: [],
      metadata: { roomOwnerId: 2 },
    } as any);

    expect(Number(state?.metadata?.ownerPlayerId ?? 0)).toBe(1);
    expect(Number(state?.turn?.currentPlayerId ?? 0)).toBe(1);
  });

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
      metadata: {
        roomId: 12,
        roomRunId: 34,
        gameType: 'lama',
      },
    } as any);

    expect(String(state.status)).toBe('started');
    expect(String(state.phase)).toBe('setup');
    expect(Number(state.metadata?.roomRunId ?? 0)).toBe(34);
    expect(Boolean(state?.pending?.blocking)).toBe(true);
    const exposed: any = service.exposeStateForUser(state, 1);
    expect(String(exposed?.pending?.type ?? '')).toBe('config_prompt');
    expect(
      (exposed?.pending?.data?.fields ?? []).some(
        (field: any) => field?.key === 'allowDrawAfterFirstQuit',
      ),
    ).toBe(false);
    expect(
      (exposed?.actions ?? []).some((a: any) => a?.type === 'lama_set_config'),
    ).toBe(true);

    const started: any = service.applyActions(state, [
      {
        type: 'lama_set_config',
        payload: {
          loseAtScore: 40,
          roundPauseSeconds: 2,
          allowPlayAfterDraw: 'true',
          startingHandSize: 5,
          copiesPerCardValue: 9,
          returnTokenFromRound: 3,
        },
        meta: { actorId: 1 },
      } as any,
    ]);
    expect(String(started.phase)).toBe('round');
    expect(Number(started.metadata?.roundPauseSeconds ?? -1)).toBe(2);
    expect(Number(started.metadata?.loseAtScore ?? 0)).toBe(40);
    expect(Boolean(started.metadata?.allowPlayAfterDraw)).toBe(true);
    expect(Number(started.metadata?.startingHandSize ?? 0)).toBe(5);
    expect(Number(started.metadata?.copiesPerCardValue ?? 0)).toBe(9);
    expect(started.metadata?.allowDrawAfterFirstQuit).toBeUndefined();
    expect(Number(started.metadata?.returnTokenFromRound ?? 0)).toBe(3);
    expect((started.metadata?.handsByPlayerId?.['1'] ?? []).length).toBe(5);
    expect((started.metadata?.handsByPlayerId?.['2'] ?? []).length).toBe(5);
    expect((started.metadata?.deck ?? []).length).toBe(52);
    expect((started.metadata?.discard ?? []).length).toBeGreaterThan(0);
    expect(Number(started.metadata?.roomRunId ?? 0)).toBe(34);

    const currentPlayerId = Number(started.turn?.currentPlayerId ?? 0);
    const handBefore = (
      started.metadata?.handsByPlayerId?.[String(currentPlayerId)] ?? []
    ).length;
    const deckBefore = (started.metadata?.deck ?? []).length;
    const afterFirstAction: any = service.applyActions(started, [
      {
        type: 'draw',
        payload: {},
        meta: { actorId: currentPlayerId },
      } as any,
    ]);
    expect(String(afterFirstAction.phase)).toBe('round');
    expect(Number(afterFirstAction.metadata?.roomRunId ?? 0)).toBe(34);
    expect((afterFirstAction.metadata?.deck ?? []).length).toBe(deckBefore - 1);
    expect(
      afterFirstAction.metadata?.handsByPlayerId?.[String(currentPlayerId)] ??
        [],
    ).toHaveLength(handBefore + 1);
  });

  it('rejects conflicting setup when deck is too small for players and starting hand', async () => {
    const { service } = createLamaServiceForTest();

    const state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Owner' },
        { id: 2, username: 'B' },
        { id: 3, username: 'C' },
        { id: 4, username: 'D' },
      ],
      log: [],
      metadata: {},
    } as any);

    const after: any = service.applyActions(state, [
      {
        type: 'lama_set_config',
        payload: {
          loseAtScore: 40,
          roundPauseSeconds: 2,
          allowPlayAfterDraw: 'true',
          startingHandSize: 6,
          copiesPerCardValue: 3,
          returnTokenFromRound: 2,
        },
        meta: { actorId: 1 },
      } as any,
    ]);

    // 4 players * 6 cards + 1 discard > 7 * 3 deck cards => invalid combo, stay in setup.
    expect(String(after.phase)).toBe('setup');
    expect(String(after.metadata?.step ?? '')).toBe('setup_config');
    const messages = (after.log ?? []).map((l: any) =>
      String(l?.message ?? ''),
    );
    expect(
      messages.some((m: string) => m.includes('configuration invalide')),
    ).toBe(true);
  });
});
