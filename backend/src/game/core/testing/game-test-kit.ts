import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../application/contracts/game-action.model';
import { FixedGameClock } from '../application/contracts/game-execution-context.model';
import type {
  GameStateEntity,
  PlayerStateEntity,
} from '../application/contracts/game-state.model';
import { DeclarativeGameRuntime } from '../../engine/runtime/declarative-game.runtime';
import type {
  CompiledGameDefinition,
  GameActionDefinition,
  GameActionMap,
} from '../../engine/runtime/definitions/game-definition';
import type { MatchResult } from '../../engine/runtime/kits/match-kit';
import { GameCommandExecutorService } from '../application/services/game-command-executor.service';
import { GameEngineService } from '../application/services/game-engine.service';
import { GameExecutionScopeService } from '../application/services/game-execution-scope.service';
import { InMemoryGameSessionStore } from '../infrastructure/persistence/memory/in-memory-game-session.store';

type ActionInput<TAction> =
  TAction extends GameActionDefinition<infer _TState, infer TInput>
    ? TInput
    : never;

type EngineActionType = 'game.configure' | 'choice.resolve' | 'choice.timeout';

type DriverActionInput<TActions, TType> = TType extends keyof TActions
  ? ActionInput<TActions[TType]>
  : Record<string, unknown>;

const DEFAULT_NAMES = ['alice', 'bob', 'charlie', 'diana', 'eve', 'frank'];

export class GameTestKit<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object,
> {
  private readonly adapter: DeclarativeGameRuntime<TState, TActions>;
  private readonly execution = new GameExecutionScopeService();
  private readonly executor = new GameCommandExecutorService(this.execution);
  private readonly sessionStore = new InMemoryGameSessionStore();
  private readonly engine = new GameEngineService(
    this.sessionStore,
    this.sessionStore,
  );
  private readonly clock = new FixedGameClock(1_700_000_000_000);
  private playerNames = DEFAULT_NAMES.slice(0, 2);
  private randomSeed = 1;
  private current: GameStateEntity | null = null;

  constructor(
    private readonly definition: CompiledGameDefinition<
      TState,
      TActions,
      TViewExtension
    >,
  ) {
    this.adapter = new DeclarativeGameRuntime(definition);
  }

  players(countOrNames: number | readonly string[]): this {
    this.ensureNotStarted();
    this.playerNames =
      typeof countOrNames === 'number'
        ? Array.from(
            { length: countOrNames },
            (_, index) => DEFAULT_NAMES[index] ?? `player-${index + 1}`,
          )
        : [...countOrNames];
    return this;
  }

  seed(seed: number): this {
    this.ensureNotStarted();
    this.randomSeed = seed >>> 0;
    return this;
  }

  async start(): Promise<this> {
    this.ensureNotStarted();
    const base = this.baseState();
    const context = this.execution.create(base, null, this.clock);
    const initial = this.execution.run(context, () =>
      this.adapter.hydrateInitialState(base, context),
    );
    this.current = initial;
    await this.engine.restoreInternalState(1, this.definition.id, initial);
    return this;
  }

  as(
    player: string | number,
  ): GameActorTestDriver<TState, TActions, TViewExtension> {
    return new GameActorTestDriver(this, this.playerId(player));
  }

  player(player: string | number): PlayerStateEntity & { hand: unknown[] } {
    const playerId = this.playerId(player);
    const found = this.requireState().players?.find(
      (candidate) => candidate.id === playerId,
    );
    if (!found)
      throw new Error(`Joueur de test introuvable: ${String(player)}`);
    return { ...structuredClone(found), hand: this.inspect.hand(playerId) };
  }

  resource(player: string | number, resourceId: string): number {
    const state = this.requireState() as GameStateEntity & {
      engine?: {
        playerValues?: {
          scores?: Record<string, number>;
          resources?: Record<string, Record<string, number>>;
        };
      };
    };
    return (
      state.engine?.playerValues?.resources?.[resourceId]?.[
        String(this.playerId(player))
      ] ?? 0
    );
  }

  inventory(player: string | number, inventoryId: string): unknown[] {
    const state = this.requireState() as GameStateEntity & {
      engine?: {
        kits?: {
          inventory?: {
            byPlayer?: Record<string, Record<string, unknown[]>>;
          };
        };
      };
    };
    return structuredClone(
      state.engine?.kits?.inventory?.byPlayer?.[inventoryId]?.[
        String(this.playerId(player))
      ] ?? [],
    );
  }

  view(
    player: string | number,
  ): TViewExtension & Omit<GameStateWithActions, 'game'> {
    const playerId = this.playerId(player);
    const exposed = this.adapter.exposeStateForUser(
      this.requireState(),
      playerId,
    );
    const { game, ...genericView } = exposed;
    return structuredClone({
      ...(game as TViewExtension),
      ...genericView,
    });
  }

  readonly inspect = {
    hand: <TCard = unknown>(
      player: string | number,
      handId?: string,
    ): TCard[] => {
      const playerId = this.playerId(player);
      const cards = this.cardsState();
      const hands = handId
        ? cards.hands?.[handId]
        : Object.values(cards.hands ?? {})[0];
      return structuredClone(hands?.[String(playerId)] ?? []) as TCard[];
    },
    deckCount: (deckId?: string): number => {
      const decks = this.cardsState().decks ?? {};
      return (deckId ? decks[deckId] : Object.values(decks)[0])?.length ?? 0;
    },
    discardCount: (deckId?: string): number => {
      const discards = this.cardsState().discards ?? {};
      return (
        (deckId ? discards[deckId] : Object.values(discards)[0])?.length ?? 0
      );
    },
    positions: (trackId?: string): Record<string, number> => {
      const state = this.requireState() as GameStateEntity & {
        engine?: {
          kits?: {
            movement?: {
              positions?: Record<string, Record<string, number>>;
            };
          };
        };
      };
      const tracks = state.engine?.kits?.movement?.positions ?? {};
      return structuredClone(
        trackId ? (tracks[trackId] ?? {}) : (Object.values(tracks)[0] ?? {}),
      );
    },
    scores: (): Record<string, number> => {
      const state = this.requireState() as GameStateEntity & {
        engine?: { playerValues?: { scores?: Record<string, number> } };
      };
      return structuredClone(state.engine?.playerValues?.scores ?? {});
    },
    lastRoll: (diceSetId?: string): number | null => {
      const state = this.requireState() as GameStateEntity & {
        engine?: {
          kits?: {
            dice?: {
              rolls?: Record<string, { setId?: string; total?: number }>;
            };
          };
        };
      };
      const rolls = Object.values(state.engine?.kits?.dice?.rolls ?? {});
      const roll = diceSetId
        ? rolls.filter((candidate) => candidate.setId === diceSetId).at(-1)
        : rolls.at(-1);
      return roll?.total ?? null;
    },
    setupComplete: (): boolean => this.requireState().phase !== 'setup',
  };

  state(): GameStateEntity & { game: TState } {
    return structuredClone(this.requireState()) as GameStateEntity & {
      game: TState;
    };
  }

  async replay(): Promise<GameStateEntity> {
    const replayed = await this.engine.replay(1, this.definition.id);
    if (!replayed) throw new Error('Aucune timeline à rejouer');
    return replayed;
  }

  result(): MatchResult | null {
    const state = this.requireState() as GameStateEntity & {
      engine?: { match?: { result?: MatchResult | null } };
    };
    return structuredClone(state.engine?.match?.result ?? null);
  }

  advanceTime(milliseconds: number): this {
    this.clock.advanceBy(milliseconds);
    return this;
  }

  readonly availableActions = (playerId: number): string[] =>
    this.adapter
      .getAvailableActions(this.requireState(), playerId)
      .map((action) => action.type);

  async execute<K extends keyof TActions & string>(
    playerId: number,
    type: K,
    payload: ActionInput<TActions[K]>,
  ): Promise<this> {
    const previous = this.requireState();
    const action = {
      type,
      payload: payload as Record<string, unknown>,
      meta: { actorId: playerId },
    } satisfies GameSingleActionDto;
    const next = this.executor.execute({
      handler: this.adapter,
      state: previous,
      actions: [action],
      actorId: playerId,
      clock: this.clock,
    });
    const result = await this.engine.compareAndSetInternalState(
      1,
      this.definition.id,
      Number(previous.version ?? 1),
      next,
    );
    if (!result.committed)
      throw new Error('Conflit inattendu dans GameTestKit');
    this.current = result.state;
    return this;
  }

  choose(player: string | number, value: unknown): Promise<this> {
    return this.executeEngineAction(this.playerId(player), 'choice.resolve', {
      value,
    });
  }

  async executeEngineAction(
    playerId: number,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<this> {
    const previous = this.requireState();
    const next = this.executor.execute({
      handler: this.adapter,
      state: previous,
      actions: [{ type, payload, meta: { actorId: playerId } }],
      actorId: playerId,
      clock: this.clock,
    });
    const result = await this.engine.compareAndSetInternalState(
      1,
      this.definition.id,
      Number(previous.version ?? 1),
      next,
    );
    if (!result.committed)
      throw new Error('Conflit inattendu dans GameTestKit');
    this.current = result.state;
    return this;
  }

  private baseState(): GameStateEntity {
    const players = this.playerNames.map((username, index) => ({
      id: index + 1,
      username,
    }));
    if (
      players.length < this.definition.players.min ||
      players.length > this.definition.players.max
    ) {
      throw new Error(
        `Nombre de joueurs hors limites pour ${this.definition.id}: ${players.length}`,
      );
    }
    return {
      version: 1,
      status: 'started',
      phase: 'setup',
      log: [],
      players,
      pending: null,
      metadata: {
        gameType: this.definition.id,
        roomId: 1,
        roomRunId: 1,
        roomStartedAt: this.clock.nowIso(),
        rng: { seed: this.randomSeed, counter: 0 },
      },
    };
  }

  private cardsState(): {
    decks?: Record<string, unknown[]>;
    discards?: Record<string, unknown[]>;
    hands?: Record<string, Record<string, unknown[]>>;
  } {
    const state = this.requireState() as GameStateEntity & {
      engine?: {
        kits?: {
          cards?: {
            decks?: Record<string, unknown[]>;
            discards?: Record<string, unknown[]>;
            hands?: Record<string, Record<string, unknown[]>>;
          };
        };
      };
    };
    return state.engine?.kits?.cards ?? {};
  }

  private playerId(player: string | number): number {
    if (typeof player === 'number') return player;
    const found = this.requireState().players?.find(
      (candidate) => candidate.username === player,
    );
    if (!found) throw new Error(`Joueur de test introuvable: ${player}`);
    return found.id;
  }

  private requireState(): GameStateEntity {
    if (!this.current) throw new Error('Appelez start() avant de jouer');
    return this.current;
  }

  private ensureNotStarted(): void {
    if (this.current) throw new Error('La partie de test est déjà démarrée');
  }
}

export class GameActorTestDriver<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object,
> {
  constructor(
    private readonly game: GameTestKit<TState, TActions, TViewExtension>,
    private readonly playerId: number,
  ) {}

  do<K extends (keyof TActions & string) | EngineActionType>(
    type: K,
    payload: DriverActionInput<TActions, K>,
  ): Promise<GameTestKit<TState, TActions, TViewExtension>> {
    if (type === 'game.configure' || type.startsWith('choice.')) {
      return this.game.executeEngineAction(
        this.playerId,
        type,
        payload as Record<string, unknown>,
      );
    }
    return this.game.execute(
      this.playerId,
      type,
      payload as ActionInput<TActions[keyof TActions & string]>,
    );
  }

  expectAction(type: keyof TActions & string): this {
    if (!this.game.availableActions(this.playerId).includes(type)) {
      throw new Error(`Action attendue mais indisponible: ${type}`);
    }
    return this;
  }
}

export function testGame<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object,
>(
  definition: CompiledGameDefinition<TState, TActions, TViewExtension>,
): GameTestKit<TState, TActions, TViewExtension> {
  return new GameTestKit(definition);
}
