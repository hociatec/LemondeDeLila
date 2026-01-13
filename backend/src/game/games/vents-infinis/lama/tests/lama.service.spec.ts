import { LamaService } from '../lama.service';
import { LamaPresenter } from '../lama.presenter';
import { RandomService } from '../../../../modules/random/services/random.service';

describe('LamaService', () => {
  it('exposes pending choices only for current player', async () => {
    const service = new LamaService(
      { register: () => {} } as any,
      new RandomService(),
      new LamaPresenter(),
    );

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

    expect(exposedA.pending?.choices?.length ?? 0).toBeGreaterThan(0);
    expect(exposedB.pending).toBeNull();
  });

  it('starts in setup and owner can set losing score to start', async () => {
    const service = new LamaService(
      { register: () => {} } as any,
      new RandomService(),
      new LamaPresenter(),
    );

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

    expect(String(state.status)).toBe('setup');
    const exposed: any = service.exposeStateForUser(state, 1);
    expect(String(exposed?.pending?.type ?? '')).toBe('lama_setup');
    expect((exposed?.actions ?? []).some((a: any) => a?.type === 'lama_set_target')).toBe(true);

    const started: any = service.applyActions(state, [
      { type: 'lama_set_target', payload: { loseAtScore: 40 }, meta: { actorId: 1 } } as any,
    ]);
    expect(String(started.status)).toBe('started');
    expect(Number(started.metadata?.loseAtScore ?? 0)).toBe(40);
    expect((started.metadata?.discard ?? []).length).toBeGreaterThan(0);
  });

  it('suggests a bot action on its turn', async () => {
    const service = new LamaService(
      { register: () => {} } as any,
      new RandomService(),
      new LamaPresenter(),
    );

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
    expect(['lama_play', 'draw', 'lama_return']).toContain(actions[0].type);
  });

  it('declares info shortcuts for panels', async () => {
    const service = new LamaService(
      { register: () => {} } as any,
      new RandomService(),
      new LamaPresenter(),
    );

    const shortcuts = service.getShortcuts({
      metadata: {},
      currentPlayerId: 1,
      started: true,
    });

    expect(
      shortcuts.some(
        (s: any) => s?.type === 'action' && s?.actionType === 'lama_peek_discard',
      ),
    ).toBe(true);
    expect(
      shortcuts.some(
        (s: any) => s?.type === 'action' && s?.actionType === 'lama_peek_deck',
      ),
    ).toBe(true);
  });

  it('includes playable rule (top or next) in pending label', async () => {
    const service = new LamaService(
      { register: () => {} } as any,
      new RandomService(),
      new LamaPresenter(),
    );

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
    expect(String(exposed?.pending?.label ?? '')).toContain(
      'Vous pouvez jouer',
    );
    expect(String(exposed?.pending?.label ?? '')).toContain('Défausse: 6');
    expect(String(exposed?.pending?.label ?? '')).toContain('LAMA');
  });

  it('offers only single-card plays in pending choices', async () => {
    const service = new LamaService(
      { register: () => {} } as any,
      new RandomService(),
      new LamaPresenter(),
    );

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
    expect(choices.some((c: any) => String(c).includes('×'))).toBe(false);
  });

  it('does not offer draw/quit in pending choices (draw is via SPACE)', async () => {
    const service = new LamaService(
      { register: () => {} } as any,
      new RandomService(),
      new LamaPresenter(),
    );

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
    expect(choices.some((c: string) => c.toLowerCase().includes('pioch'))).toBe(false);
    expect(choices.some((c: string) => c.toLowerCase().includes('sort'))).toBe(false);

    const actionTypes = (exposed?.actions ?? []).map((a: any) =>
      String(a?.type ?? '').toLowerCase(),
    );
    expect(actionTypes).toContain('draw');
  });

  it('ends the turn after a draw (only one draw per turn)', async () => {
    const service = new LamaService(
      { register: () => {} } as any,
      new RandomService(),
      new LamaPresenter(),
    );

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

  it('does not allow multiple draws in a single message from the same actor', async () => {
    const service = new LamaService(
      { register: () => {} } as any,
      new RandomService(),
      new LamaPresenter(),
    );

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

  it('scores only distinct remaining card values at end of round', async () => {
    const service = new LamaService(
      { register: () => {} } as any,
      new RandomService(),
      new LamaPresenter(),
    );

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
    expect(String(after.metadata?.step ?? '')).toBe('return_token');
    expect(Number(after.metadata?.pendingReturnPlayerId ?? 0)).toBe(1);
  });
});
