import type { GameRuntime } from '../contracts/game-runtime.interface';
import {
  StateGameRng,
  SystemGameClock,
  type GameExecutionContext,
} from '../models/game-execution-context.model';
import type { GameSingleActionDto } from '../models/game-action.model';
import type { GameStateEntity } from '../models/game-state.model';
import type { PlayerStateEntity } from '../models/game-state.model';
import {
  GameActionRejectedError,
  GameActorRequiredError,
  GameUnknownActionError,
} from '../../domain/errors/game-domain.errors';
import { DeclarativeChoiceRuntime } from './declarative-choice-runtime';
import { DeclarativeLifecycle } from './declarative-lifecycle';
import type {
  CompiledGameDefinition,
  DeclarativeState,
  GameActionShape,
  GameActionMap,
} from './game-definition';
import { GameContext } from './game-rule-context';
import {
  initializeGameComponents,
  installGameComponents,
} from './component-kit';
import { standardTurn } from './turn-kit';
import { createDeclarativeState } from './declarative-state.factory';
import { migrateDeclarativeState } from './game-state-migration';
import { assertValidGameSession } from './game-session-contracts';
import {
  canConfigureGame,
  commitGameConfiguration,
  GAME_CONFIGURE_ACTION,
  parseGameConfiguration,
} from './configuration-kit';
import { DeclarativeGameQueries } from './declarative-game-queries';

export class DeclarativeGameRuntime<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
>
  extends DeclarativeGameQueries<TState, TActions, TPlayerView>
  implements GameRuntime
{
  readonly gameType: string;
  readonly displayName: string;
  readonly category: string;
  readonly subcategory?: string;
  readonly description?: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  protected readonly choices: DeclarativeChoiceRuntime<
    TState,
    TActions,
    TPlayerView
  >;
  private readonly lifecycle: DeclarativeLifecycle<
    TState,
    TActions,
    TPlayerView
  >;

  constructor(
    protected readonly definition: CompiledGameDefinition<
      TState,
      TActions,
      TPlayerView
    >,
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
    const actor = this.requireActor(runtime, actorId);
    const context = this.context(runtime, actor.id);
    if (action.type === GAME_CONFIGURE_ACTION) {
      const configuration = this.requireConfiguration();
      if (
        !canConfigureGame(
          configuration,
          runtime.engine.configuration,
          actor,
          context,
        )
      ) {
        throw new GameActionRejectedError('Configuration indisponible');
      }
      const config = parseGameConfiguration(
        configuration,
        runtime.engine.configuration,
        action.payload ?? {},
      );
      if (
        configuration.validate &&
        !configuration.validate({
          state: runtime.game,
          actor,
          config,
          ctx: context,
        })
      ) {
        throw new GameActionRejectedError('Configuration invalide');
      }
      return {
        ...action,
        payload: config as Record<string, unknown>,
        meta: { ...(action.meta ?? {}), actorId: actor.id },
      };
    }
    if (action.type === 'choice.resolve' || action.type === 'choice.timeout') {
      this.choices.ensureActor(
        runtime,
        actor,
        action.type === 'choice.timeout',
        context.clock.nowMs(),
      );
      return { ...action, meta: { ...(action.meta ?? {}), actorId: actor.id } };
    }
    const definition = this.actionDefinition(action.type);
    const input =
      definition.parseInput?.(action.payload ?? {}) ??
      definition.input.parse(action.payload ?? {});
    this.ensureActionAvailable(runtime, actor, action.type, context, input);
    return {
      ...action,
      payload: input as Record<string, unknown>,
      meta: { ...(action.meta ?? {}), actorId: actor.id },
    };
  }

  validateActor(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
    actorId: number | null,
  ): boolean {
    const runtime = this.runtimeState(state);
    const actor = (runtime.players ?? []).find(
      (player) => player.id === actorId,
    );
    if (!actor) return false;
    if (
      actions.some((action) => action.type === GAME_CONFIGURE_ACTION) &&
      this.definition.config
    ) {
      return canConfigureGame(
        this.definition.config,
        runtime.engine.configuration,
        actor,
        this.context(runtime, actor.id),
      );
    }
    if (runtime.pending?.playerIds?.length) {
      return (
        runtime.pending.playerIds.includes(actor.id) &&
        !(runtime.pending.resolvedPlayerIds ?? []).includes(actor.id)
      );
    }
    if (runtime.pending?.playerId != null) {
      return runtime.pending.playerId === actor.id;
    }
    return (
      (this.definition.turn ?? standardTurn()).kind === 'simultaneous' ||
      runtime.turn?.currentPlayerId === actor.id
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
    if (action.type === GAME_CONFIGURE_ACTION) {
      this.executeConfiguration(runtime, actor, action, context);
    } else if (
      action.type === 'choice.resolve' ||
      action.type === 'choice.timeout'
    ) {
      this.choices.resolve(
        runtime,
        actor,
        action,
        context,
        action.type === 'choice.timeout',
      );
    } else {
      this.executeDefinitionAction(runtime, actor, action, context);
    }
    this.lifecycle.stabilize(runtime, context);
    this.recordContextEvents(runtime, actor.id, action.type, context);
    context.assertValidKits();
    assertValidGameSession(runtime, this.definition.components ?? []);
    return runtime;
  }

  private executeDefinitionAction(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    action: GameSingleActionDto,
    context: GameContext<TState>,
  ): void {
    const definition = this.actionDefinition(action.type);
    const input =
      definition.parseInput?.(action.payload ?? {}) ??
      definition.input.parse(action.payload ?? {});
    this.ensureActionAvailable(runtime, actor, action.type, context, input);
    const schedulerId = action.meta?.schedulerId;
    if (
      typeof schedulerId === 'string' &&
      !context.scheduler.consume(schedulerId)
    ) {
      context.reject('SCHEDULED_ACTION_NOT_DUE', { schedulerId });
    }
    if (!definition.executeInput) {
      throw new GameUnknownActionError(
        `Action non construite avec defineAction: ${action.type}`,
      );
    }
    definition.executeInput({
      state: runtime.game,
      actor,
      input,
      ctx: context,
    });
  }

  private executeConfiguration(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    action: GameSingleActionDto,
    context: GameContext<TState>,
  ): void {
    const definition = this.requireConfiguration();
    if (
      !canConfigureGame(
        definition,
        runtime.engine.configuration,
        actor,
        context,
      )
    ) {
      throw new GameActionRejectedError('Configuration indisponible');
    }
    const config = parseGameConfiguration(
      definition,
      runtime.engine.configuration,
      action.payload ?? {},
    );
    if (
      definition.validate &&
      !definition.validate({
        state: runtime.game,
        actor,
        config,
        ctx: context,
      })
    ) {
      throw new GameActionRejectedError('Configuration invalide');
    }
    commitGameConfiguration(runtime.engine.configuration, config);
    definition.onConfigured?.({
      state: runtime.game,
      actor,
      config,
      ctx: context,
    });
    context.match.start();
    context.runBeforeCurrentTurnHook();
    context.events.engine('game.configured', {
      playerId: actor.id,
      values: structuredClone(config),
    });
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
    const action = this.definition.actions[type];
    if (!action) throw new GameUnknownActionError(`Action inconnue: ${type}`);
    return action;
  }

  private requireConfiguration() {
    if (!this.definition.config) {
      throw new GameUnknownActionError('Configuration absente');
    }
    return this.definition.config;
  }

  protected requireActor(
    runtime: DeclarativeState<TState>,
    actorId: number | null,
  ): PlayerStateEntity {
    const actor = (runtime.players ?? []).find(
      (player) => player.id === actorId,
    );
    if (!actor) throw new GameActorRequiredError();
    return actor;
  }

  private ensureActionAvailable(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    type: string,
    context: GameContext<TState>,
    input: object = {},
  ): void {
    if (
      !this.isActionAvailable(runtime, actor, type, context) ||
      !this.isInputValid(runtime, actor, type, context, input)
    ) {
      throw new GameActionRejectedError(`Action indisponible: ${type}`);
    }
  }

  private isInputValid(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    type: string,
    context: GameContext<TState>,
    input: object,
  ): boolean {
    const action = this.actionDefinition(type);
    if (action.validateInput) {
      return action.validateInput({
        state: runtime.game,
        actor,
        input,
        ctx: context,
      });
    }
    return true;
  }

  protected isActionAvailable(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    type: string,
    context: GameContext<TState>,
  ): boolean {
    if (runtime.pending) return false;
    if (!this.validateActor(runtime, [], actor.id)) return false;
    const phaseActions = this.definition.phases?.[runtime.phase]?.actions;
    if (phaseActions && !phaseActions.includes(type)) return false;
    const action = this.actionDefinition(type);
    return (
      action.available?.({ state: runtime.game, actor, ctx: context }) ?? true
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
