import {
  FixedGameClock,
  StateGameRng,
} from '../../core/application/models/game-execution-context.model';
import type {
  GameState,
  PlayerState,
} from '../../core/application/models/game-state.model';
import { victoryWhen, when } from './automation/automatic-kit';
import { cards } from './cards/cards-kit';
import { DeclarativeGameRuntime } from './declarative-game.runtime';
import {
  defineAction,
  defineChoice,
} from './definitions/game-definition-builders';
import { defineGame } from './definitions/game-definition';
import { gameInput } from './actions/game-input-schema';
import { defineEffect, gameEffects } from './effects/effects-kit';
import { movement } from './kits/movement-kit';
import { phase } from './kits/phase-kit';

type SampleState = {
  score: number;
  secret: string;
  confirmations: number;
  selectedPlayers: number[];
};

const deck = cards.deck({ id: 'main', cards: ['a', 'b', 'c'], shuffle: true });
const hands = cards.hands({
  id: 'hands',
  deck: 'main',
  initial: 1,
  visibility: 'owner',
});
const track = movement.track({ id: 'main', spaces: 10 });

const sampleGame = defineGame({
  id: 'runtime-contract',
  displayName: 'Runtime Contract',
  category: 'test',
  players: { min: 2, max: 4 },
  components: [deck, hands, track],
  initialPhase: 'setup',
  setup: () => {
    return {
      score: 0,
      secret: 'server-only',
      confirmations: 0,
      selectedPlayers: [],
    };
  },
  phases: {
    setup: phase<SampleState>({
      actions: [],
      next: 'playing',
      autoTransition: () => true,
    }),
    playing: phase<SampleState>({
      terminal: true,
      actions: [
        'score',
        'confirm',
        'selectPlayers',
        'chooseThenComplete',
        'chooseRequiredThenComplete',
      ],
    }),
  },
  actions: {
    score: defineAction<SampleState, { amount: number }>({
      input: gameInput.object({
        amount: gameInput.number({ integer: true, min: 1, max: 3 }),
      }),
      available: ({ state }) => state.score < 5,
      execute: ({ state, input, ctx }) => {
        state.score += input.amount;
        ctx.movement.move('main', ctx.actor?.id ?? 0, input.amount);
        ctx.events.emit('score.changed', { score: state.score });
      },
    }),
    confirm: defineAction<SampleState, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ actor, ctx }) =>
        ctx.choice.confirm({
          id: 'confirm-score',
          player: actor.id,
          timeout: { afterMs: 100, strategy: 'first' },
        }),
    }),
    selectPlayers: defineAction<SampleState, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ actor, ctx }) =>
        ctx.choice.players({
          id: 'select-players',
          player: actor.id,
          options: ctx.players.all().map((player) => player.id),
          min: 1,
          max: 2,
        }),
    }),
    chooseThenComplete: defineAction<SampleState, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ ctx }) =>
        ctx.effects.schedule(
          gameEffects.custom(
            'record-selected-player',
            {},
            gameEffects.target.chosenOpponent('effect-opponent', true),
          ),
          gameEffects.completeTurn(),
        ),
    }),
    chooseRequiredThenComplete: defineAction<
      SampleState,
      Record<string, never>
    >({
      input: gameInput.object({}),
      execute: ({ ctx }) =>
        ctx.effects.schedule(
          gameEffects.custom(
            'record-selected-player',
            {},
            gameEffects.target.chosenOpponent('required-opponent'),
          ),
          gameEffects.completeTurn(),
        ),
    }),
  },
  effects: {
    'record-selected-player': defineEffect<SampleState, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ state, targetPlayerIds }) => {
        state.selectedPlayers = [...targetPlayerIds];
      },
    }),
  },
  choices: {
    'confirm-score': defineChoice<SampleState, boolean>({
      input: gameInput.boolean(),
      resolve: ({ state, value }) => {
        if (value === true) state.confirmations += 1;
      },
    }),
    'select-players': defineChoice<SampleState, number[]>({
      input: gameInput.array(gameInput.playerId(), { min: 1, max: 2 }),
      resolve: ({ state, value }) => {
        state.selectedPlayers = value;
      },
    }),
  },
  automatic: [
    when<SampleState>(
      'cap-score',
      ({ state }) => state.score > 5,
      ({ state }) => {
        state.score = 5;
      },
    ),
  ],
  victory: victoryWhen<SampleState>(({ state, ctx }) =>
    state.score === 5
      ? { winnerPlayerIds: [ctx.actor?.id ?? 0], reason: 'target' }
      : null,
  ),
  viewExtension: ({ state }) => ({ score: state.score }),
  bot: {
    choose: ({ availableActions }) =>
      availableActions.includes('score')
        ? { type: 'score', payload: { amount: 1 } }
        : null,
  },
});

describe('DeclarativeGameRuntime', () => {
  const adapter = new DeclarativeGameRuntime(sampleGame);

  it('owns setup, deterministic kits and automatic phase transitions', () => {
    const first = adapter.hydrateInitialState(baseState());
    const second = adapter.hydrateInitialState(baseState());

    expect(normalizeTimestamps(first)).toEqual(normalizeTimestamps(second));
    expect(first.phase).toBe('playing');
    expect(first.turn?.currentPlayerId).toBe(1);
    expect(first).not.toBe(baseState());
  });

  it('validates typed payloads, availability and emits native events', () => {
    const initial = adapter.hydrateInitialState(baseState());
    expect(() =>
      adapter.validateAction(
        initial,
        { type: 'score', payload: { amount: 10 } },
        1,
      ),
    ).toThrow('maximum 3');

    const action = adapter.validateAction(
      initial,
      { type: 'score', payload: { amount: 2 } },
      1,
    );
    const current = apply(adapter, initial, action, 1);
    const engine = current.engine as {
      pendingEvents: Array<{ type: string }>;
    };

    expect(current.game.score).toBe(2);
    expect(engine.pendingEvents.map((event) => event.type)).toContain(
      'score.changed',
    );
    expect(initial).not.toEqual(current);
  });

  it('rejects a handler that leaves a terminal phase without changing the session', () => {
    const definition = defineGame<SampleState>()({
      ...sampleGame,
      phases: {
        setup: { next: 'playing', autoTransition: () => true },
        playing: { terminal: true },
      },
      actions: {
        ...sampleGame.actions,
        rewind: defineAction<SampleState, Record<string, never>>({
          input: gameInput.object({}),
          execute: ({ ctx }) => ctx.transitionTo('setup'),
        }),
      },
    });
    const runtime = new DeclarativeGameRuntime(definition);
    const state = runtime.hydrateInitialState(baseState());
    const before = structuredClone(state);
    const action = runtime.validateAction(
      state,
      { type: 'rewind', payload: {} },
      1,
    );
    expect(() =>
      runtime.applyActions(state, [action], {
        actorId: 1,
        rng: new StateGameRng(state),
        clock: new FixedGameClock(1000),
      }),
    ).toThrow('Transition de phase interdite');
    expect(state).toEqual(before);
  });

  it('blocks normal actions while a confirmation is pending and resolves it', () => {
    let state = runtimeState(adapter.hydrateInitialState(baseState()));
    state = execute(adapter, state, 'confirm', {}, 1);

    expect(adapter.getAvailableActions(state, 2)).toEqual([]);
    expect(adapter.getAvailableActions(state, 1)).toHaveLength(2);
    expect(adapter.exposeStateForUser(state, 1).pending).toMatchObject({
      workflowKind: 'confirm',
      data: {
        choiceActionsByIndex: [
          { type: 'choice.resolve', payload: { value: true } },
          { type: 'choice.resolve', payload: { value: false } },
        ],
      },
    });
    expect(adapter.exposeStateForUser(state, 2).pending?.data).toBeUndefined();
    expect(() =>
      adapter.validateAction(
        state,
        { type: 'score', payload: { amount: 1 } },
        1,
      ),
    ).toThrow('Action indisponible');

    state = execute(adapter, state, 'choice.resolve', { value: true }, 1);
    expect(state.pending).toBeNull();
    expect(state.game.confirmations).toBe(1);
  });

  it('validates multi-player selections and rejects duplicates', () => {
    const pending = execute(
      adapter,
      adapter.hydrateInitialState(baseState()),
      'selectPlayers',
      {},
      1,
    );

    expect(() =>
      execute(adapter, pending, 'choice.resolve', { value: [2, 2] }, 1),
    ).toThrow('Sélection de joueurs invalide');

    const resolved = execute(
      adapter,
      pending,
      'choice.resolve',
      { value: [1, 2] },
      1,
    );
    expect(resolved.game.selectedPlayers).toEqual([1, 2]);
  });

  it('resolves expired choices through the same command API', () => {
    const clock = new FixedGameClock(1_000);
    let state = adapter.hydrateInitialState(baseState());
    state = apply(
      adapter,
      state,
      adapter.validateAction(state, { type: 'confirm', payload: {} }, 1),
      1,
      clock,
    );
    clock.advanceBy(101);

    const timedOut = apply(
      adapter,
      state,
      adapter.validateAction(state, { type: 'choice.timeout' }, 1),
      1,
      clock,
    );
    expect(timedOut.pending).toBeNull();
    expect(timedOut.game.confirmations).toBe(1);
  });

  it('finishes a turn after an optional effect choice times out', () => {
    const clock = new FixedGameClock(1_000);
    let state = runtimeState(adapter.hydrateInitialState(baseState()));
    state = apply(
      adapter,
      state,
      adapter.validateAction(
        state,
        { type: 'chooseThenComplete', payload: {} },
        1,
      ),
      1,
      clock,
    );
    expect(state.pending).toMatchObject({
      playerId: 1,
      data: { choiceId: 'effect-opponent' },
    });
    clock.advanceBy(30_001);

    state = apply(
      adapter,
      state,
      adapter.validateAction(state, { type: 'choice.timeout' }, 1),
      1,
      clock,
    );

    expect(state.pending).toBeNull();
    expect(state.game.selectedPlayers).toEqual([]);
    expect(state.turn).toMatchObject({ currentPlayerId: 2, turnNumber: 2 });
  });

  it('resolves an obligatory effect immediately when only one target exists', () => {
    const state = execute(
      adapter,
      adapter.hydrateInitialState(baseState()),
      'chooseRequiredThenComplete',
      {},
      1,
    );

    expect(state.pending).toBeNull();
    expect(state.game.selectedPlayers).toEqual([2]);
    expect(state.turn).toMatchObject({ currentPlayerId: 2, turnNumber: 2 });
  });

  it('gives bots only commands that remain valid for humans', () => {
    const state = adapter.hydrateInitialState(baseState());
    const command = adapter.getBotActions(state, 1)?.[0];

    expect(command).toEqual({
      type: 'score',
      payload: { amount: 1 },
      meta: { actorId: 1 },
    });
    expect(() => adapter.validateAction(state, command!, 1)).not.toThrow();
  });

  it('versions game extensions for players and spectators without exposing storage', () => {
    const versioned = new DeclarativeGameRuntime(
      defineGame({ ...sampleGame, stateVersion: 7, rulesVersion: '3' }),
    );
    const state = versioned.hydrateInitialState(baseState());
    const before = structuredClone(state);
    for (const viewer of [1, 2, null]) {
      const view = versioned.exposeStateForUser(state, viewer);
      expect(view.gameContract).toEqual({
        stateVersion: 7,
        rulesVersion: '3',
        contentVersion: sampleGame.contentVersion,
      });
      expect(view).not.toHaveProperty('engine');
      expect(view.game).not.toHaveProperty('secret');
    }
    expect(state).toEqual(before);
    expect(() => adapter.exposeStateForUser(state, 1)).toThrow();
  });

  it('projects only the declared player view and finishes on victory', () => {
    let state = adapter.hydrateInitialState(baseState());
    state = execute(adapter, state, 'score', { amount: 3 }, 1);
    state = execute(adapter, state, 'score', { amount: 2 }, 1);

    const view = adapter.exposeStateForUser(state, 1);
    expect(view.game).toEqual({ score: 5 });
    expect(view.game).not.toHaveProperty('secret');
    expect(view.kits).toHaveProperty('cards');
    expect(view).not.toHaveProperty('extras');
    expect(view).not.toHaveProperty('board');
    expect(state.status).toBe('finished');
    expect(adapter.getAvailableActions(state, 1)).toEqual([]);
  });
});

function normalizeTimestamps<T>(value: T): T {
  const normalized = structuredClone(value) as Record<string, unknown>;
  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (current == null || typeof current !== 'object') return;
    const record = current as Record<string, unknown>;
    for (const [key, nested] of Object.entries(record)) {
      if (key === 'occurredAtMs' || key === 'startedAtMs') record[key] = 0;
      else visit(nested);
    }
  };
  visit(normalized);
  return normalized as T;
}

type RuntimeState = ReturnType<typeof runtimeState>;

function runtimeState(state: GameState) {
  return state as GameState & {
    game: SampleState;
    engine: Record<string, unknown>;
  };
}

function execute(
  adapter: DeclarativeGameRuntime<SampleState, typeof sampleGame.actions>,
  state: GameState,
  type: string,
  payload: Record<string, unknown>,
  actorId: number,
): RuntimeState {
  const action = adapter.validateAction(state, { type, payload }, actorId);
  return apply(adapter, state, action, actorId);
}

function apply(
  adapter: DeclarativeGameRuntime<SampleState, typeof sampleGame.actions>,
  state: GameState,
  action: {
    type: string;
    payload?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  },
  actorId: number,
  clock = new FixedGameClock(1_000),
): RuntimeState {
  const execution = { actorId, rng: new StateGameRng(state), clock };
  return runtimeState(adapter.applyActions(state, [action], execution));
}

function baseState(): GameState {
  const players: PlayerState[] = [
    { id: 1, username: 'Bot', isBot: true },
    { id: 2, username: 'Alice' },
  ];
  return {
    version: 1,
    status: 'started',
    phase: 'setup',
    log: [],
    players,
    metadata: { rng: { seed: 42, counter: 0 } },
  };
}
