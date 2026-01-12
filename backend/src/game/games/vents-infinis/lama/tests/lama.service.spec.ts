import { LamaService } from '../lama.service';
import { LamaPresenter } from '../lama.presenter';
import { RandomService } from '../../../../modules/random/services/random.service';
import { interfaceShortcut } from '../../../../engine/shortcuts/shortcut-utils';

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
    expect(['lama_play', 'draw', 'lama_quit', 'lama_return']).toContain(
      actions[0].type,
    );
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
      shortcuts.some((s: any) => s?.type === 'interface' && s?.id === 'hand'),
    ).toBe(true);
    expect(
      shortcuts.some((s: any) => s?.type === 'interface' && s?.id === 'score'),
    ).toBe(true);
    expect(
      shortcuts.some((s: any) => s?.type === 'interface' && s?.id === 'play'),
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
});
