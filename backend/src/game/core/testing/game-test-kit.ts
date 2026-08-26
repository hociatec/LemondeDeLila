import type { GameSingleActionDto } from '../application/models/game-action.model';
import { FixedGameClock } from '../application/models/game-execution-context.model';
import type {
  GameStateEntity,
  PlayerStateEntity,
} from '../application/models/game-state.model';
import { DeclarativeGameRuntime } from '../application/runtime/declarative-game.runtime';
import type {
  DeclarativeGameDefinition,
  GameActionDefinition,
  GameActionMap,
} from '../application/runtime/game-definition';
import { GameCommandExecutorService } from '../application/services/game-command-executor.service';
import { GameEngineService } from '../application/services/game-engine.service';
import { GameExecutionScopeService } from '../application/services/game-execution-scope.service';

type ActionInput<TAction> =
  TAction extends GameActionDefinition<object, infer TInput> ? TInput : never;

const DEFAULT_NAMES = ['alice', 'bob', 'charlie', 'diana', 'eve', 'frank'];

export class GameTestKit<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
> {
  private readonly adapter: DeclarativeGameRuntime<
    TState,
    TActions,
    TPlayerView
  >;
  private readonly execution = new GameExecutionScopeService();
  private readonly executor = new GameCommandExecutorService(this.execution);
  private readonly engine = new GameEngineService();
  private readonly clock = new FixedGameClock(1_700_000_000_000);
  private playerNames = DEFAULT_NAMES.slice(0, 2);
  private randomSeed = 1;
  private current: GameStateEntity | null = null;

  constructor(
    private readonly definition: DeclarativeGameDefinition<
      TState,
      TActions,
      TPlayerView
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
    this.current = this.execution.run(context, () =>
      this.adapter.hydrateInitialState(base, context),
    );
    await this.engine.restoreInternalState(1, this.definition.id, this.current);
    return this;
  }

  as(
    player: string | number,
  ): GameActorTestDriver<TState, TActions, TPlayerView> {
    return new GameActorTestDriver(this, this.playerId(player));
  }

  player(player: string | number): PlayerStateEntity & { hand: unknown[] } {
    const playerId = this.playerId(player);
    const found = this.requireState().players?.find(
      (candidate) => candidate.id === playerId,
    );
    if (!found)
      throw new Error(`Joueur de test introuvable: ${String(player)}`);
    return { ...structuredClone(found), hand: this.hand(playerId) };
  }

  view(player: string | number): TPlayerView {
    const exposed = this.adapter.exposeStateForUser(
      this.requireState(),
      this.playerId(player),
    );
    return structuredClone(exposed.game as TPlayerView);
  }

  state(): GameStateEntity & { game: TState } {
    return structuredClone(this.requireState()) as GameStateEntity & {
      game: TState;
    };
  }

  replay(): GameStateEntity {
    const replayed = this.engine.replay(1, this.definition.id);
    if (!replayed) throw new Error('Aucune timeline à rejouer');
    return replayed;
  }

  advanceTime(milliseconds: number): this {
    this.clock.advanceBy(milliseconds);
    return this;
  }

  availableActions(playerId: number): string[] {
    return this.adapter
      .getAvailableActions(this.requireState(), playerId)
      .map((action) => action.type);
  }

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

  private async executeEngineAction(
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

  private hand(playerId: number): unknown[] {
    const state = this.requireState() as GameStateEntity & {
      engine?: {
        kits?: {
          cards?: { hands?: Record<string, Record<string, unknown[]>> };
        };
      };
    };
    const allHands = state.engine?.kits?.cards?.hands ?? {};
    const firstHand = Object.values(allHands)[0] ?? {};
    return structuredClone(firstHand[String(playerId)] ?? []);
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
  TPlayerView extends object,
> {
  constructor(
    private readonly game: GameTestKit<TState, TActions, TPlayerView>,
    private readonly playerId: number,
  ) {}

  do<K extends keyof TActions & string>(
    type: K,
    payload: ActionInput<TActions[K]>,
  ): Promise<GameTestKit<TState, TActions, TPlayerView>> {
    return this.game.execute(this.playerId, type, payload);
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
  TPlayerView extends object,
>(
  definition: DeclarativeGameDefinition<TState, TActions, TPlayerView>,
): GameTestKit<TState, TActions, TPlayerView> {
  return new GameTestKit(definition);
}
