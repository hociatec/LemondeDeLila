import type { GameRuntime } from '../../../../application/contracts/game-runtime.interface';
import type { GameStateEntity } from '../../../../application/contracts/game-state.model';
import { GameWsStatePresenter } from './game-ws-state.presenter';
import { GameVisibilityService } from '../../../../application/services/game-visibility.service';

describe('GameWsStatePresenter', () => {
  const createPresenter = () =>
    new GameWsStatePresenter(new GameVisibilityService());

  it('publishes only shortcuts whose actions are visible to the viewer', () => {
    const state = {
      status: 'started',
      phase: 'turn',
      turnIndex: 1,
      players: [{ id: 1, username: 'A' }],
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: { roomRunId: 7 },
    } as unknown as GameStateEntity;
    const handler = {
      exposeStateForUser: () => ({
        ...state,
        actions: [{ type: 'play', label: 'Jouer', payload: { card: 3 } }],
      }),
      getShortcuts: () => [
        { key: 'P', type: 'action', actionType: 'play' },
        { key: 'Q', type: 'action', actionType: 'quit' },
        { key: 'S', type: 'interface', id: 'score', label: 'Scores' },
      ],
    } as unknown as GameRuntime;

    const payload = createPresenter().present({
      state,
      handler,
      roomId: 2,
      gameType: 'example',
      version: 1,
      viewerPlayerId: 1,
    });
    const system = payload.system as {
      shortcuts: Array<{ key: string; label?: string }>;
    };
    expect(system.shortcuts.map((shortcut) => shortcut.key)).toEqual([
      'P',
      'S',
    ]);
    expect(system.shortcuts.map((shortcut) => shortcut.label)).toEqual([
      'Jouer',
      'Scores',
    ]);
    expect(payload.runId).toBe(7);
    expect(payload.state).toBeUndefined();
  });

  it('publishes ready-to-render event messages for LAMA', () => {
    const state = {
      status: 'started',
      phase: 'turn',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'Lila' }],
      metadata: {},
    } as unknown as GameStateEntity;
    const exposed = {
      ...state,
      actions: [],
      system: {
        players: { all: [{ id: 1, username: 'Lila' }] },
        events: {
          latestByType: {
            'game.message': {
              id: '2:0',
              type: 'game.message',
              actorId: 1,
              occurredAtMs: 10,
              data: {
                key: 'game.card.played',
                params: {
                  playerId: 1,
                  cardId: 'LAMA',
                  cardLabel: 'LAMA',
                },
              },
            },
            'score.changed': {
              id: '2:1',
              type: 'score.changed',
              data: { playerId: 1, value: 12 },
            },
          },
        },
      },
      kits: {
        score: {
          byPlayer: { '1': 12 },
          leaderboard: [{ playerId: 1, score: 12, rank: 1 }],
        },
      },
    };
    const handler = {
      exposeStateForUser: () => exposed,
      getShortcuts: () => [],
      getDescriptor: () => ({
        presentation: {
          score: {
            label: 'Jetons',
            unit: { singular: 'jeton', plural: 'jetons' },
            changeNarration: 'delta-and-total',
          },
        },
      }),
    } as unknown as GameRuntime;

    const payload = createPresenter().present({
      state,
      handler,
      roomId: 6,
      gameType: 'lama',
      version: 2,
      viewerPlayerId: 1,
    });
    const system = payload.system as {
      events: {
        latestByType: Record<string, { data: { message?: string } }>;
      };
    };
    expect(system.events.latestByType['game.message']?.data.message).toBe(
      'Vous jouez LAMA.',
    );
    expect(system.events.latestByType['score.changed']?.data.message).toBe(
      'Vous avez maintenant 12 jetons.',
    );
    expect((payload.kits as any).score).toMatchObject({
      label: 'Jetons',
      unit: { singular: 'jeton', plural: 'jetons' },
    });
  });

  it('announces the drawn card value only to the player who drew it', () => {
    const state = {
      status: 'started',
      turn: { currentPlayerId: 1 },
      players: [{ id: 1, username: 'Lila' }],
      metadata: {},
    } as unknown as GameStateEntity;
    const handler = {
      exposeStateForUser: () => ({
        system: {
          match: { status: 'started' },
          players: { all: [{ id: 1, username: 'Lila' }] },
          events: {
            latestByType: {
              'card.received': {
                id: '3:1',
                type: 'card.received',
                actorId: 1,
                data: { playerId: 1, card: 'LAMA' },
              },
              'game.message': {
                id: '3:0',
                type: 'game.message',
                data: {
                  key: 'game.card.drawn',
                  params: { playerId: 1, deckId: 'lama' },
                },
              },
            },
          },
        },
        actions: [],
      }),
      getShortcuts: () => [],
    } as unknown as GameRuntime;
    const payload = createPresenter().present({
      state,
      handler,
      roomId: 6,
      gameType: 'lama',
      version: 3,
      viewerPlayerId: 1,
    });
    expect(
      ((payload.system as any).events.latestByType['game.message'] as any).data
        .message,
    ).toBe('Vous piochez LAMA.');
    expect(
      ((payload.system as any).events.latestByType['card.received'] as any).data
        .message,
    ).toBeUndefined();

    const opponentPayload = createPresenter().present({
      state,
      handler: {
        ...handler,
        exposeStateForUser: () => ({
          system: {
            match: { status: 'started' },
            players: {
              all: [
                { id: 1, username: 'Lila' },
                { id: 2, username: 'Mina' },
              ],
            },
            events: {
              latestByType: {
                'card.received': {
                  id: '3:1',
                  type: 'card.received',
                  actorId: 1,
                  data: { playerId: 1 },
                },
                'game.message': {
                  id: '3:0',
                  type: 'game.message',
                  data: {
                    key: 'game.card.drawn',
                    params: { playerId: 1, deckId: 'lama' },
                  },
                },
              },
            },
          },
          actions: [],
        }),
      } as unknown as GameRuntime,
      roomId: 6,
      gameType: 'lama',
      version: 3,
      viewerPlayerId: 2,
    });
    expect(
      (
        (opponentPayload.system as any).events.latestByType[
          'game.message'
        ] as any
      ).data.message,
    ).toBe('Lila pioche une carte.');
  });

  it('announces a player leaving a round through the standard event', () => {
    const state = {
      status: 'started',
      players: [
        { id: 1, username: 'Lila' },
        { id: 2, username: 'Mina' },
      ],
    } as unknown as GameStateEntity;
    const handler = {
      exposeStateForUser: () => ({
        system: {
          match: { status: 'started' },
          players: { all: state.players },
          events: {
            latestByType: {
              'match.started': {
                id: '9:0',
                type: 'match.started',
                data: {},
              },
              'round.player-left': {
                id: '9:1',
                type: 'round.player-left',
                data: { playerId: 2 },
              },
            },
          },
        },
        actions: [],
      }),
      getShortcuts: () => [],
    } as unknown as GameRuntime;

    const payload = createPresenter().present({
      state,
      handler,
      roomId: 6,
      gameType: 'example',
      version: 9,
      viewerPlayerId: 1,
    });

    expect(
      (payload.system as any).events.latestByType['round.player-left'].data
        .message,
    ).toBe('Mina sort de la manche.');
    expect(
      (payload.system as any).events.latestByType['match.started'].data.message,
    ).toBe('La partie démarre, bon jeu !');
  });

  it('presents a LAMA round start as one player-facing narrative', () => {
    const state = {
      status: 'started',
      turn: { currentPlayerId: 1 },
      players: [{ id: 1, username: 'hacene' }],
      metadata: {},
    } as unknown as GameStateEntity;
    const handler = {
      exposeStateForUser: () => ({
        system: {
          match: { status: 'started' },
          players: { all: [{ id: 1, username: 'hacene' }] },
          events: {
            recent: [
              {
                id: '4:4',
                type: 'game.message',
                occurredAtMs: 14,
                sequence: 4,
                data: {
                  key: 'game.round.started',
                  params: {
                    round: 1,
                    firstCardId: 'LAMA',
                    starterPlayerId: 1,
                  },
                },
              },
            ],
            latestByType: {
              'game.message': {
                id: '4:4',
                type: 'game.message',
                occurredAtMs: 14,
                data: {
                  key: 'game.round.started',
                  params: {
                    round: 1,
                    firstCardId: 'LAMA',
                    starterPlayerId: 1,
                  },
                },
              },
              'turn.started': {
                id: '4:3',
                type: 'turn.started',
                occurredAtMs: 13,
                data: { playerId: 1 },
              },
              'card.drawn': {
                id: '4:2',
                type: 'card.drawn',
                actorId: 1,
                occurredAtMs: 12,
                data: { deckId: 'lama' },
              },
              'round.started': {
                id: '4:0',
                type: 'round.started',
                occurredAtMs: 10,
                data: { number: 1 },
              },
            },
          },
        },
        kits: {
          cards: {
            hands: {
              'lama-hands': { byPlayer: { '1': [1, 2, 'LAMA'] } },
            },
          },
        },
        actions: [],
      }),
      getShortcuts: () => [],
    } as unknown as GameRuntime;
    const payload = createPresenter().present({
      state,
      handler,
      roomId: 6,
      gameType: 'lama',
      version: 4,
      viewerPlayerId: 1,
    });
    const events = (payload.system as any).events.latestByType;
    expect(events['game.message'].data.message).toBe(
      "La partie démarre.\nTout le monde reçoit son paquet de cartes.\nVos cartes : 1, 2, LAMA.\nC'est au tour de hacene.",
    );
    expect((payload.system as any).events.recent[0].data.message).toBe(
      events['game.message'].data.message,
    );
    expect(events['card.drawn']?.data.message).toBeUndefined();
    expect(events['turn.started'].data.message).toBeUndefined();
    expect(events['round.started'].data.message).toBeUndefined();
  });

  it('presents a LAMA round transition in its emission order', () => {
    const recent = [
      {
        id: '8:0',
        type: 'round.ended',
        occurredAtMs: 20,
        sequence: 0,
        data: { number: 1 },
      },
      {
        id: '8:1',
        type: 'score.changed',
        occurredAtMs: 20,
        sequence: 1,
        data: {
          playerId: 1,
          previous: 0,
          value: 3,
          delta: 3,
          announce: false,
        },
      },
      {
        id: '8:2',
        type: 'score.changed',
        occurredAtMs: 20,
        sequence: 2,
        data: {
          playerId: 2,
          previous: 0,
          value: 5,
          delta: 5,
          announce: false,
        },
      },
      {
        id: '8:3',
        type: 'game.message',
        occurredAtMs: 20,
        sequence: 3,
        data: {
          key: 'game.round.started',
          params: { round: 2, starterPlayerId: 2 },
        },
      },
    ];
    const handler = {
      exposeStateForUser: () => ({
        system: {
          match: { status: 'started' },
          players: {
            all: [
              { id: 1, username: 'Lila' },
              { id: 2, username: 'Mina' },
            ],
          },
          events: {
            recent,
            latestByType: {
              'round.ended': recent[0],
              'score.changed': recent[2],
              'game.message': recent[3],
            },
          },
        },
        kits: {
          cards: {
            hands: {
              'lama-hands': { byPlayer: { '1': [2, 3, 'LAMA'] } },
            },
          },
        },
        actions: [],
      }),
      getShortcuts: () => [],
      getDescriptor: () => ({
        presentation: {
          score: {
            label: 'Jetons',
            unit: { singular: 'jeton', plural: 'jetons' },
            changeNarration: 'delta-and-total',
          },
        },
      }),
    } as unknown as GameRuntime;
    const payload = createPresenter().present({
      state: {
        status: 'started',
        players: [
          { id: 1, username: 'Lila' },
          { id: 2, username: 'Mina' },
        ],
      } as unknown as GameStateEntity,
      handler,
      roomId: 6,
      gameType: 'lama',
      version: 8,
      viewerPlayerId: 1,
    });
    const messages = (payload.system as any).events.recent
      .map((event: any) => event.data.message)
      .filter(Boolean);
    expect(messages).toEqual([
      'La manche est terminée.',
      "La manche 2 commence.\nTout le monde reçoit son paquet de cartes.\nVos cartes : 2, 3, LAMA.\nC'est au tour de Mina.",
    ]);
  });

  it('publishes a server-driven configuration prompt without legacy rewriting', () => {
    const prompt = {
      type: 'config_prompt',
      label: 'Configuration',
      data: {
        actionType: 'configure',
        fields: [{ key: 'score', label: 'Score', kind: 'number' }],
      },
    };
    const state = {
      status: 'started',
      phase: 'setup',
      turnIndex: 0,
      players: [],
      turn: { currentPlayerId: null, direction: 1 },
      metadata: {},
      pending: prompt,
      actions: [{ type: 'configure', payload: {} }],
    } as unknown as GameStateEntity;
    const handler = {
      exposeStateForUser: () => state,
      getShortcuts: () => [],
    } as unknown as GameRuntime;

    const payload = createPresenter().present({
      state,
      handler,
      roomId: 3,
      gameType: 'example',
      version: 1,
    });
    expect(payload.pending).toEqual(prompt);
  });

  it('preserves an explicit server mapping between pending choices and actions', () => {
    const mappedAction = { type: 'pick_beta', payload: { value: 2 } };
    const state = {
      status: 'started',
      phase: 'turn',
      turnIndex: 1,
      players: [{ id: 1, username: 'A' }],
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: {},
      actions: [{ type: 'unrelated_action', payload: {} }, mappedAction],
      pending: {
        type: 'pick_one',
        playerId: 1,
        choices: ['Beta'],
        data: { choiceActionsByIndex: [mappedAction] },
      },
    } as unknown as GameStateEntity;
    const handler = {
      exposeStateForUser: () => state,
      getShortcuts: () => [],
    } as unknown as GameRuntime;

    const payload = createPresenter().present({
      state,
      handler,
      roomId: 5,
      gameType: 'opaque-game',
      version: 2,
      viewerPlayerId: 1,
    });
    expect((payload.pending as any).data.choiceActionsByIndex).toEqual([
      mappedAction,
    ]);
  });

  it('publishes the generic dice contract', () => {
    const state = {
      status: 'started',
      phase: 'turn',
      turn: { currentPlayerId: null, direction: 1, turnNumber: 3 },
      system: { turn: { number: 3 } },
      players: [],
      actions: [{ type: 'roll', payload: {} }],
      kits: { dice: { total: 5 } },
    } as unknown as GameStateEntity;
    const handler = {
      exposeStateForUser: () => state,
      getShortcuts: () => [],
    } as unknown as GameRuntime;

    const payload = createPresenter().present({
      state,
      handler,
      roomId: 4,
      gameType: 'dice-game',
      version: 8,
    });
    expect((payload.kits as any).dice).toEqual(
      expect.objectContaining({ total: 5, rollActionIndex: 0 }),
    );
    expect(payload.state).toBeUndefined();
  });
});
