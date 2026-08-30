import type { GameSingleActionDto } from '../../../core/application/contracts/game-action.model';
import type { PlayerStateEntity } from '../../../core/application/contracts/game-state.model';
import {
  GameActionRejectedError,
  GameActorRequiredError,
  GameUnknownActionError,
} from '../../../core/domain/errors/game-domain.errors';
import type { DeclarativeChoiceRuntime } from '../choices/declarative-choice-runtime';
import {
  canConfigureGame,
  commitGameConfiguration,
  GAME_CONFIGURE_ACTION,
  parseGameConfiguration,
} from '../configuration/configuration-kit';
import type {
  CompiledGameDefinition,
  DeclarativeState,
  GameActionMap,
  GameActionShape,
} from '../definitions/game-definition';
import type { GameContext } from '../game-rule-context';
import { standardTurn } from '../kits/turn-kit';

type ContextFactory<TState extends object> = (
  actorId: number,
) => GameContext<TState>;

/** Owns validation and execution of author-defined and engine actions. */
export class DeclarativeActionController<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
> {
  constructor(
    private readonly definition: CompiledGameDefinition<
      TState,
      TActions,
      TPlayerView
    >,
    private readonly choices: DeclarativeChoiceRuntime<
      TState,
      TActions,
      TPlayerView
    >,
  ) {}

  validate(
    runtime: DeclarativeState<TState>,
    action: GameSingleActionDto,
    actorId: number | null,
    contextFactory: ContextFactory<TState>,
  ): GameSingleActionDto {
    const actor = this.requireActor(runtime, actorId);
    const context = contextFactory(actor.id);
    if (action.type === GAME_CONFIGURE_ACTION) {
      return this.validateConfiguration(runtime, actor, action, context);
    }
    if (action.type === 'choice.resolve' || action.type === 'choice.timeout') {
      this.choices.ensureActor(
        runtime,
        actor,
        action.type === 'choice.timeout',
        context.clock.nowMs(),
      );
      return this.withActor(action, actor.id);
    }
    const definition = this.actionDefinition(action.type);
    const input =
      definition.parseInput?.(action.payload ?? {}) ??
      definition.input.parse(action.payload ?? {});
    this.ensureAvailable(runtime, actor, action.type, context, input);
    return this.withActor(action, actor.id, input);
  }

  validateActor(
    runtime: DeclarativeState<TState>,
    actions: readonly GameSingleActionDto[],
    actorId: number | null,
    contextFactory: ContextFactory<TState>,
  ): boolean {
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
        contextFactory(actor.id),
      );
    }
    if (runtime.pending?.playerIds?.length) {
      return (
        runtime.pending.playerIds.includes(actor.id) &&
        !(runtime.pending.resolvedPlayerIds ?? []).includes(actor.id)
      );
    }
    if (runtime.pending?.playerId != null)
      return runtime.pending.playerId === actor.id;
    return (
      (this.definition.turn ?? standardTurn()).kind === 'simultaneous' ||
      runtime.turn?.currentPlayerId === actor.id
    );
  }

  execute(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    action: GameSingleActionDto,
    context: GameContext<TState>,
  ): void {
    if (action.type === GAME_CONFIGURE_ACTION) {
      this.executeConfiguration(runtime, actor, action, context);
      return;
    }
    if (action.type === 'choice.resolve' || action.type === 'choice.timeout') {
      this.choices.resolve(
        runtime,
        actor,
        action,
        context,
        action.type === 'choice.timeout',
      );
      return;
    }
    const definition = this.actionDefinition(action.type);
    const input =
      definition.parseInput?.(action.payload ?? {}) ??
      definition.input.parse(action.payload ?? {});
    this.ensureAvailable(runtime, actor, action.type, context, input);
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

  actionDefinition(type: string): GameActionShape<TState> {
    const action = this.definition.actions[type];
    if (!action) throw new GameUnknownActionError(`Action inconnue: ${type}`);
    return action;
  }

  requireActor(
    runtime: DeclarativeState<TState>,
    actorId: number | null,
  ): PlayerStateEntity {
    const actor = (runtime.players ?? []).find(
      (player) => player.id === actorId,
    );
    if (!actor) throw new GameActorRequiredError();
    return actor;
  }

  isAvailable(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    type: string,
    context: GameContext<TState>,
    contextFactory: ContextFactory<TState>,
  ): boolean {
    if (runtime.pending) return false;
    if (!this.validateActor(runtime, [], actor.id, contextFactory))
      return false;
    const phaseActions = this.definition.phases?.[runtime.phase]?.actions;
    if (phaseActions && !phaseActions.includes(type)) return false;
    const action = this.actionDefinition(type);
    return (
      action.available?.({ state: runtime.game, actor, ctx: context }) ?? true
    );
  }

  private ensureAvailable(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    type: string,
    context: GameContext<TState>,
    input: object,
  ): void {
    const available = this.isAvailable(
      runtime,
      actor,
      type,
      context,
      () => context,
    );
    const action = this.actionDefinition(type);
    const inputValid =
      action.validateInput?.({
        state: runtime.game,
        actor,
        input,
        ctx: context,
      }) ?? true;
    if (!available || !inputValid) {
      throw new GameActionRejectedError(`Action indisponible: ${type}`);
    }
  }

  private validateConfiguration(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    action: GameSingleActionDto,
    context: GameContext<TState>,
  ): GameSingleActionDto {
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
      !definition.validate({ state: runtime.game, actor, config, ctx: context })
    ) {
      throw new GameActionRejectedError('Configuration invalide');
    }
    return this.withActor(action, actor.id, config);
  }

  private executeConfiguration(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    action: GameSingleActionDto,
    context: GameContext<TState>,
  ): void {
    const validated = this.validateConfiguration(
      runtime,
      actor,
      action,
      context,
    );
    const definition = this.requireConfiguration();
    const config = validated.payload ?? {};
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

  private requireConfiguration() {
    if (!this.definition.config)
      throw new GameUnknownActionError('Configuration absente');
    return this.definition.config;
  }

  private withActor(
    action: GameSingleActionDto,
    actorId: number,
    payload: unknown = action.payload,
  ): GameSingleActionDto {
    return {
      ...action,
      payload: payload as Record<string, unknown> | undefined,
      meta: { ...(action.meta ?? {}), actorId },
    };
  }
}
