import { appendPendingGameEvent } from '../../core/application/services/game-event-buffer';
import type { GameRuntime } from '../../core/application/ports/game-runtime.port';
import { parseStrictInteger } from '../../../shared/utils/public-api';
import {
  StateGameRng,
  type GameExecutionContext,
} from '../../core/application/models/game-execution-context.model';
import type { GameSingleActionDto } from '../../core/application/models/game-action.model';
import type { GameState } from '../../core/application/models/game-state.model';
import type { PlayerState } from '../../core/application/models/game-state.model';
import { DeclarativeChoiceRuntime } from './choices/declarative-choice-runtime';
import { DeclarativeActionController } from './actions/declarative-action-controller';
import { DeclarativeLifecycle } from './lifecycle/declarative-lifecycle';
import type { CompiledGameDefinition } from './contracts/compiled-game-definition';
import type { DeclarativeState } from './state/declarative-state';
import type {
  GameActionShape,
  GameActionMap,
} from './contracts/author-rule-contracts';
import { GameContext } from './game-rule-context';
import {
  initializeGameComponents,
  installGameComponents,
} from './definitions/component-kit';
import { standardTurn } from './kits/turn-kit';
import { createDeclarativeState } from './state/declarative-state.factory';
import { loadDeclarativeState } from './content/game-state-loader';
import { assertValidGameSession } from './state/game-session-contracts';
import { assertCompiledGameDefinition } from './definitions/compiled-game-definition-brand';
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
    assertCompiledGameDefinition(definition);
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
    baseState: GameState,
    execution?: GameExecutionContext,
  ): GameState {
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
      assertValidGameSession(runtime, this.definition.components ?? []);
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
    state: GameState,
    actions: GameSingleActionDto[],
    execution?: GameExecutionContext,
  ): GameState {
    if (!Array.isArray(actions) || actions.length > 128) {
      throw new Error('Too many declarative game actions');
    }
    let runtime = this.runtimeState(state);
    for (const action of actions) {
      runtime = this.applyOne(runtime, action, execution);
    }
    return runtime;
  }

  validateAction(
    state: GameState,
    action: GameSingleActionDto,
    actorId: number | null,
    execution?: GameExecutionContext,
  ): GameSingleActionDto {
    const runtime = this.runtimeState(state);
    return this.actions.validate(runtime, action, actorId, (id) =>
      this.context(runtime, id, execution),
    );
  }

  validateActor(
    state: GameState,
    actions: GameSingleActionDto[],
    actorId: number | null,
    execution?: GameExecutionContext,
  ): boolean {
    const runtime = this.runtimeState(state);
    return this.actions.validateActor(runtime, actions, actorId, (id) =>
      this.context(runtime, id, execution),
    );
  }

  private applyOne(
    runtime: DeclarativeState<TState>,
    action: GameSingleActionDto,
    execution?: GameExecutionContext,
  ): DeclarativeState<TState> {
    const actorId = parseStrictInteger(action.meta?.actorId);
    const actor = this.requireActor(runtime, actorId);
    const context = this.context(runtime, actor.id, execution);
    this.actions.execute(runtime, actor, action, context);
    this.lifecycle.stabilize(runtime, context);
    this.recordContextEvents(runtime, actor.id, action.type, context);
    context.assertValidKits();
    assertValidGameSession(runtime, this.definition.components ?? []);
    return runtime;
  }

  private createRuntime(
    base: GameState,
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
      this.definition.contentDigest,
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

  protected runtimeState(state: GameState): DeclarativeState<TState> {
    return loadDeclarativeState(
      state,
      this.definition.id,
      this.definition.stateVersion,
      this.definition.contentVersion,
      this.definition.rulesVersion,
      this.definition.content.snapshotMigrations,
      this.definition.contentDigest,
    );
  }

  protected actionDefinition(type: string): GameActionShape<TState> {
    return this.actions.actionDefinition(type);
  }

  protected requireActor(
    runtime: DeclarativeState<TState>,
    actorId: number | null,
  ): PlayerState {
    return this.actions.requireActor(runtime, actorId);
  }

  protected isActionAvailable(
    runtime: DeclarativeState<TState>,
    actor: PlayerState,
    type: string,
    context: GameContext<TState>,
  ): boolean {
    return this.actions.isAvailable(runtime, actor, type, context, (id) =>
      this.context(runtime, id, {
        clock: context.clock,
        commandId: context.commandId,
      }),
    );
  }

  private recordContextEvents(
    runtime: DeclarativeState<TState>,
    actorId: number | null,
    actionType: string,
    context: GameContext<TState>,
  ): void {
    const events = context.consumeEvents();
    for (const event of events) {
      appendPendingGameEvent(runtime, {
        ...event,
        actorId,
        occurredAtMs: context.clock.nowMs(),
        data: {
          actionType,
          ...(context.commandId ? { commandId: context.commandId } : {}),
          ...event.data,
        },
      });
    }
  }
}
import { SystemGameClock } from '@platform/time/public-api';
