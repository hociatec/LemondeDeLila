import type { GameRuntime } from '../../core/application/contracts/game-runtime.interface';
import {
  StateGameRng,
  SystemGameClock,
  type GameExecutionContext,
} from '../../core/application/contracts/game-execution-context.model';
import type { GameSingleActionDto } from '../../core/application/contracts/game-action.model';
import type { GameStateEntity } from '../../core/application/contracts/game-state.model';
import type { PlayerStateEntity } from '../../core/application/contracts/game-state.model';
import { DeclarativeChoiceRuntime } from './choices/declarative-choice-runtime';
import { DeclarativeActionController } from './actions/declarative-action-controller';
import { DeclarativeLifecycle } from './lifecycle/declarative-lifecycle';
import type {
  CompiledGameDefinition,
  DeclarativeState,
  GameActionShape,
  GameActionMap,
} from './definitions/game-definition';
import { GameContext } from './game-rule-context';
import {
  initializeGameComponents,
  installGameComponents,
} from './definitions/component-kit';
import { standardTurn } from './kits/turn-kit';
import { createDeclarativeState } from './state/declarative-state.factory';
import { migrateDeclarativeState } from './content/game-state-migration';
import { assertValidGameSession } from './state/game-session-contracts';
import { DeclarativeGameQueries } from './projection/declarative-game-queries';

export class DeclarativeGameRuntime<
  TState extends object,
  TActions extends GameActionMap<TState>,
>
  extends DeclarativeGameQueries<TState, TActions>
  implements GameRuntime
{
  readonly gameType: string;
  readonly displayName: string;
  readonly category: string;
  readonly subcategory?: string;
  readonly description?: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  protected readonly choices: DeclarativeChoiceRuntime<TState, TActions>;
  private readonly actions: DeclarativeActionController<TState, TActions>;
  private readonly lifecycle: DeclarativeLifecycle<TState, TActions>;

  constructor(
    protected readonly definition: CompiledGameDefinition<TState, TActions>,
  ) {
    super();
    this.gameType = definition.id;
    this.displayName = definition.displayName;
    this.category = definition.category;
    this.subcategory = definition.subcategory;
    this.description = definition.description;
    this.minPlayers = definition.players.min;
    this.maxPlayers = definition.players.max;
    this.choices = new DeclarativeChoiceRuntime(definition);
    this.actions = new DeclarativeActionController(definition, this.choices);
    this.lifecycle = new DeclarativeLifecycle(definition);
  }

  hydrateInitialState(
    baseState: GameStateEntity,
    execution?: GameExecutionContext,
  ): GameStateEntity {
    const runtime = this.createRuntime(baseState, execution?.clock);
    const context = this.context(runtime, null, execution);
    installGameComponents(
      this.definition.components ?? [],
      runtime.players ?? [],
      context,
    );
    initializeGameComponents(
      this.definition.initialization,
      runtime.players ?? [],
      context,
    );
    runtime.game = this.definition.setup
      ? this.definition.setup({
          players: runtime.players ?? [],
          ctx: context,
        })
      : ({} as TState);
    this.lifecycle.enterInitialPhase(runtime, context);
    if (runtime.engine.configuration.complete) {
      context.match.start();
      context.runBeforeCurrentTurnHook();
      this.lifecycle.stabilize(runtime, context);
    }
    this.recordContextEvents(runtime, null, 'engine.setup', context);
    context.assertValidKits();
    assertValidGameSession(runtime, this.definition.components ?? []);
    return runtime;
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
    execution?: GameExecutionContext,
  ): GameStateEntity {
    let runtime = this.runtimeState(state);
    for (const action of actions) {
      runtime = this.applyOne(runtime, action, execution);
    }
    return runtime;
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    const runtime = this.runtimeState(state);
    return this.actions.validate(runtime, action, actorId, (id) =>
      this.context(runtime, id),
    );
  }

  validateActor(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
    actorId: number | null,
  ): boolean {
    const runtime = this.runtimeState(state);
    return this.actions.validateActor(runtime, actions, actorId, (id) =>
      this.context(runtime, id),
    );
  }

  private applyOne(
    runtime: DeclarativeState<TState>,
    action: GameSingleActionDto,
    execution?: GameExecutionContext,
  ): DeclarativeState<TState> {
    const actorId = Number(action.meta?.actorId);
    const actor = this.requireActor(
      runtime,
      Number.isFinite(actorId) ? actorId : null,
    );
    const context = this.context(runtime, actor.id, execution);
    this.actions.execute(runtime, actor, action, context);
    this.lifecycle.stabilize(runtime, context);
    this.recordContextEvents(runtime, actor.id, action.type, context);
    context.assertValidKits();
    assertValidGameSession(runtime, this.definition.components ?? []);
    return runtime;
  }

  private createRuntime(
    base: GameStateEntity,
    clock = new SystemGameClock(),
  ): DeclarativeState<TState> {
    const turn = (this.definition.turn ?? standardTurn()).initialize(
      base.players ?? [],
    );
    const phase =
      this.definition.initialPhase ??
      Object.keys(this.definition.phases ?? {})[0] ??
      'playing';
    return createDeclarativeState<TState>(
      base,
      phase,
      turn,
      clock,
      this.definition.stateVersion,
      this.definition.contentVersion,
      this.definition.rulesVersion,
      this.definition.config,
    );
  }

  protected context(
    runtime: DeclarativeState<TState>,
    actorId: number | null,
    execution?: Pick<GameExecutionContext, 'clock' | 'commandId'>,
  ): GameContext<TState> {
    const actor =
      (runtime.players ?? []).find((player) => player.id === actorId) ?? null;
    return new GameContext(
      runtime,
      actor,
      {
        actorId,
        commandId: execution?.commandId ?? null,
        rng: new StateGameRng(runtime),
        clock: execution?.clock ?? new SystemGameClock(),
      },
      this.definition.turn ?? standardTurn(),
      this.definition.phases ?? {},
      this.definition.lifecycle,
      this.definition.components ?? [],
      this.definition.effects ?? {},
    );
  }

  protected runtimeState(state: GameStateEntity): DeclarativeState<TState> {
    return migrateDeclarativeState(
      state,
      this.definition.id,
      this.definition.stateVersion,
      this.definition.contentVersion,
      this.definition.rulesVersion,
      this.definition.migrations,
      this.definition.contentMigrations,
      this.definition.config,
    );
  }

  protected actionDefinition(type: string): GameActionShape<TState> {
    return this.actions.actionDefinition(type);
  }

  protected requireActor(
    runtime: DeclarativeState<TState>,
    actorId: number | null,
  ): PlayerStateEntity {
    return this.actions.requireActor(runtime, actorId);
  }

  protected isActionAvailable(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    type: string,
    context: GameContext<TState>,
  ): boolean {
    return this.actions.isAvailable(runtime, actor, type, context, (id) =>
      this.context(runtime, id),
    );
  }

  private recordContextEvents(
    runtime: DeclarativeState<TState>,
    actorId: number | null,
    actionType: string,
    context: GameContext<TState>,
  ): void {
    const events = context.consumeEvents();
    const engine = runtime.engine;
    engine.pendingEvents = [
      ...(engine.pendingEvents ?? []),
      ...events.map((event) => ({
        ...event,
        actorId,
        occurredAtMs: context.clock.nowMs(),
        data: {
          actionType,
          ...(context.commandId ? { commandId: context.commandId } : {}),
          ...event.data,
        },
      })),
    ];
  }
}
