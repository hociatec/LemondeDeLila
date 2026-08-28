import type {
  GameRuntime,
  GameActionCandidatePage,
  GameActionCandidateQuery,
  GameRuntimeDescriptor,
} from '../contracts/game-runtime.interface';
import {
  StateGameRng,
  SystemGameClock,
  type GameExecutionContext,
} from '../models/game-execution-context.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../models/game-action.model';
import type {
  GameStateEntity,
  PendingState,
  PlayerStateEntity,
} from '../models/game-state.model';
import {
  GameActionRejectedError,
  GameActorRequiredError,
  GameUnknownActionError,
} from '../../domain/errors/game-domain.errors';
import { DeclarativeChoiceRuntime } from './declarative-choice-runtime';
import { DeclarativeLifecycle } from './declarative-lifecycle';
import type {
  DeclarativeGameDefinition,
  DeclarativeState,
  GameActionShape,
  GameActionMap,
} from './game-definition';
import { playerView } from './game-definition';
import { GameContext } from './game-rule-context';
import {
  initializeGameComponents,
  installGameComponents,
} from './component-kit';
import { standardTurn, type TurnPolicy } from './turn-kit';
import { projectGameSystemView } from './game-system-view';
import { asRecord } from './runtime-game-action';
import {
  deriveGameShortcuts,
  describeGameDefinition,
} from './runtime-descriptor';
import { createDeclarativeState } from './declarative-state.factory';
import { randomLegalAction } from './bot-kit';
import { migrateDeclarativeState } from './game-state-migration';
import { assertValidGameSession } from './game-session-contracts';
import {
  canConfigureGame,
  commitGameConfiguration,
  GAME_CONFIGURE_ACTION,
  parseGameConfiguration,
} from './configuration-kit';
import { projectSubmissions } from './submission-kit';
import { nextScheduledAction, projectScheduler } from './scheduler-kit';

export class DeclarativeGameRuntime<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
> implements GameRuntime {
  readonly gameType: string;
  readonly displayName: string;
  readonly category: string;
  readonly subcategory?: string;
  readonly description?: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  private readonly choices: DeclarativeChoiceRuntime<
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
    readonly definition: DeclarativeGameDefinition<
      TState,
      TActions,
      TPlayerView
    >,
  ) {
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
      this.turnPolicy().kind === 'simultaneous' ||
      runtime.turn?.currentPlayerId === actor.id
    );
  }

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    const runtime = this.runtimeState(state);
    const actor = (runtime.players ?? []).find(
      (player) => player.id === playerId,
    );
    if (!actor || String(runtime.status).toLowerCase() === 'finished')
      return [];
    if (runtime.pending) return this.choices.actions(runtime, actor);
    const context = this.context(runtime, actor.id);
    if (this.definition.config && !runtime.engine.configuration.complete) {
      return canConfigureGame(
        this.definition.config,
        runtime.engine.configuration,
        actor,
        context,
      )
        ? [{ type: GAME_CONFIGURE_ACTION, payload: {} }]
        : [];
    }
    return Object.entries(this.definition.actions).flatMap(
      ([type, definition]) => {
        if (!this.isActionAvailable(runtime, actor, type, context)) return [];
        const inputs = definition.enumerateCandidateInputs
          ? definition.enumerateCandidateInputs({
              state: runtime.game,
              actor,
              ctx: context,
              query: {},
              offset: 0,
              limit: 50,
            })
          : definition.enumerateInputs?.({
              state: runtime.game,
              actor,
              ctx: context,
            });
        return (inputs ?? [{}]).map((payload) => ({
          type,
          payload: payload as Record<string, unknown>,
        }));
      },
    );
  }

  getActionCandidates(
    state: GameStateEntity,
    playerId: number,
    actionType: string,
    options: GameActionCandidateQuery = {},
  ): GameActionCandidatePage {
    const runtime = this.runtimeState(state);
    const actor = this.requireActor(runtime, playerId);
    const context = this.context(runtime, actor.id);
    const definition = this.actionDefinition(actionType);
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    const limit = Math.max(1, Math.min(200, Math.trunc(options.limit ?? 50)));
    if (!this.isActionAvailable(runtime, actor, actionType, context)) {
      return { actionType, items: [], offset, limit, nextOffset: null };
    }
    const requested = limit + 1;
    const candidates = definition.enumerateCandidateInputs
      ? definition.enumerateCandidateInputs({
          state: runtime.game,
          actor,
          ctx: context,
          query: options.query ?? {},
          offset,
          limit: requested,
        })
      : (
          definition.enumerateInputs?.({
            state: runtime.game,
            actor,
            ctx: context,
          }) ?? [{}]
        ).slice(offset, offset + requested);
    const hasMore = candidates.length > limit;
    return {
      actionType,
      items: candidates.slice(0, limit).map((payload) => ({
        type: actionType,
        payload: payload as Record<string, unknown>,
      })),
      offset,
      limit,
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number | null,
  ): GameStateWithActions {
    const runtime = this.runtimeState(state);
    const actor =
      (runtime.players ?? []).find((player) => player.id === userId) ?? null;
    const context = this.context(runtime, actor?.id ?? null);
    const projection = this.definition.view
      ? this.definition.view({ state: runtime.game, actor, ctx: context })
      : playerView({
          game: {} as TPlayerView,
        });
    const {
      engine: _engine,
      game: _game,
      metadata: _metadata,
      ...publicState
    } = runtime;
    const pending = projectPending(runtime.pending, actor?.id ?? null);
    const system = projectGameSystemView({
      runtime,
      viewerPlayerId: actor?.id ?? null,
      components: this.definition.components,
      hasConfiguration: this.definition.config != null,
    });
    return {
      ...publicState,
      phase:
        this.definition.phases?.[runtime.phase]?.visibility === 'hidden'
          ? 'hidden'
          : runtime.phase,
      game: projection.game,
      extras: {
        ...(publicState.extras ?? {}),
        ...system,
        actionCatalog: describeGameDefinition(this.definition).actions,
        submissions: projectSubmissions(
          runtime.engine.submissions,
          actor?.id ?? null,
        ),
        timers: projectScheduler(
          runtime.engine.scheduler,
          actor?.id ?? null,
          context.clock.nowMs(),
        ),
        ...(this.definition.config
          ? {
              configuration: {
                complete: runtime.engine.configuration.complete,
                ownerPlayerId: runtime.engine.configuration.ownerPlayerId,
                values: structuredClone(runtime.engine.configuration.values),
                schema: this.definition.config.input.describe(),
                ui: structuredClone(this.definition.config.ui ?? {}),
              },
            }
          : {}),
        ...(system.match.result
          ? {
              victory: {
                ...system.match.result,
                ranking:
                  system.match.result.ranking ??
                  system.score.leaderboard
                    .reduce<number[][]>((tiers, entry) => {
                      (tiers[entry.rank - 1] ??= []).push(entry.playerId);
                      return tiers;
                    }, [])
                    .filter((tier) => tier.length > 0),
                finalScores: structuredClone(system.scores),
              },
            }
          : {}),
        ...(projection.extras ?? {}),
      },
      board: projection.board ?? publicState.board,
      metadata: {},
      actions: userId == null ? [] : this.getAvailableActions(runtime, userId),
      pending,
    };
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null {
    const runtime = this.runtimeState(state);
    const actor = (runtime.players ?? []).find(
      (player) => player.id === botPlayerId && player.isBot,
    );
    if (!actor) return null;
    const decisionRuntime = structuredClone(runtime);
    const decisionActor = this.requireActor(decisionRuntime, botPlayerId);
    const context = this.context(decisionRuntime, botPlayerId);
    const pending = this.choices.actions(decisionRuntime, decisionActor);
    if (pending.length > 0) {
      const selected = randomLegalAction(pending, context.random);
      return selected ? [selected] : null;
    }
    const available = this.getAvailableActions(runtime, botPlayerId);
    if (available.length === 0) return null;
    if (
      available.length === 1 &&
      available[0]?.type === GAME_CONFIGURE_ACTION
    ) {
      return [
        this.validateAction(
          runtime,
          { type: GAME_CONFIGURE_ACTION, payload: {} },
          botPlayerId,
        ),
      ];
    }
    if (!this.definition.bot) {
      const selected = randomLegalAction(available, context.random);
      return selected
        ? [
            this.validateAction(
              runtime,
              { ...selected, meta: { actorId: botPlayerId } },
              botPlayerId,
            ),
          ]
        : null;
    }
    const selected = this.definition.bot.choose({
      state: decisionRuntime.game,
      actor: decisionActor,
      availableActions: available.map(
        (action) => action.type as keyof TActions & string,
      ),
      legalActions: structuredClone(available),
      ctx: context,
    });
    if (!selected) return null;
    const selectedAction: GameSingleActionDto = {
      type: selected.type,
      ...(selected.payload === undefined
        ? {}
        : { payload: selected.payload as Record<string, unknown> }),
      meta: { actorId: botPlayerId },
    };
    return [this.validateAction(runtime, selectedAction, botPlayerId)];
  }

  getAutomaticActions(state: GameStateEntity) {
    const runtime = this.runtimeState(state);
    const data = asRecord(runtime.pending?.data);
    const rawChoiceDeadline = data.deadlineMs;
    const choiceDeadline =
      typeof rawChoiceDeadline === 'number' &&
      Number.isFinite(rawChoiceDeadline)
        ? rawChoiceDeadline
        : null;
    const unresolvedChoicePlayerId = runtime.pending?.playerIds?.find(
      (playerId) =>
        !(runtime.pending?.resolvedPlayerIds ?? []).includes(playerId),
    );
    const rawChoiceId = data.choiceId;
    const choiceId =
      typeof rawChoiceId === 'string' || typeof rawChoiceId === 'number'
        ? String(rawChoiceId)
        : '';
    const choicePlan =
      runtime.pending && choiceDeadline != null
        ? {
            key: `choice-timeout:${choiceId}:${choiceDeadline}`,
            executeAtMs: choiceDeadline,
            actions: [
              {
                type: 'choice.timeout',
                payload: {},
                meta: {
                  actorId:
                    unresolvedChoicePlayerId ??
                    runtime.pending.playerId ??
                    null,
                },
              },
            ],
          }
        : null;
    const scheduled = nextScheduledAction(runtime.engine.scheduler);
    const scheduledPlan = scheduled?.action
      ? {
          key: `scheduler:${scheduled.id}:${scheduled.dueAtMs}`,
          executeAtMs: scheduled.dueAtMs,
          actions: [
            {
              ...scheduled.action,
              meta: {
                ...(scheduled.action.meta ?? {}),
                actorId:
                  scheduled.action.meta?.actorId ??
                  runtime.turn?.currentPlayerId ??
                  null,
                schedulerId: scheduled.id,
              },
            },
          ],
        }
      : null;
    if (!choicePlan) return scheduledPlan;
    if (!scheduledPlan) return choicePlan;
    return choicePlan.executeAtMs <= scheduledPlan.executeAtMs
      ? choicePlan
      : scheduledPlan;
  }

  getShortcuts() {
    return deriveGameShortcuts(this.definition);
  }

  getDescriptor(): GameRuntimeDescriptor {
    return describeGameDefinition(this.definition);
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
    const turn = this.turnPolicy().initialize(base.players ?? []);
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
      this.definition.rulesVersion,
      this.definition.config,
    );
  }

  private context(
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
      this.turnPolicy(),
      this.definition.phases ?? {},
      this.definition.lifecycle,
      this.definition.components ?? [],
      this.definition.effects ?? {},
    );
  }

  private runtimeState(state: GameStateEntity): DeclarativeState<TState> {
    return migrateDeclarativeState(
      state,
      this.definition.id,
      this.definition.stateVersion,
      this.definition.rulesVersion,
      this.definition.migrations,
      this.definition.config,
    );
  }

  private turnPolicy(): TurnPolicy {
    return this.definition.turn ?? standardTurn();
  }

  private actionDefinition(type: string): GameActionShape<TState> {
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

  private requireActor(
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

  private isActionAvailable(
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

function projectPending(
  pending: PendingState | null | undefined,
  viewerPlayerId: number | null,
): PendingState | null {
  if (!pending) return null;
  const expected =
    viewerPlayerId != null &&
    (pending.playerIds?.length
      ? pending.playerIds.includes(viewerPlayerId) &&
        !(pending.resolvedPlayerIds ?? []).includes(viewerPlayerId)
      : pending.playerId == null || pending.playerId === viewerPlayerId);
  const common: PendingState = {
    type: pending.type,
    label: pending.label,
    playerId: pending.playerId,
    playerIds: pending.playerIds ? [...pending.playerIds] : undefined,
    resolvedPlayerIds: pending.resolvedPlayerIds
      ? [...pending.resolvedPlayerIds]
      : undefined,
    targetPlayerId: pending.targetPlayerId,
    blocking: pending.blocking,
  };
  if (!expected) return common;
  return {
    ...common,
    question: pending.question,
    choices: pending.choices ? [...pending.choices] : undefined,
    data: pending.data ? structuredClone(pending.data) : undefined,
  };
}
