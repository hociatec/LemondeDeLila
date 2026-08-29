import type {
  GameActionCandidatePage,
  GameActionCandidateQuery,
  GameRuntimeDescriptor,
} from '../contracts/game-runtime.interface';
import type { GameExecutionContext } from '../models/game-execution-context.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../models/game-action.model';
import type {
  GameStateEntity,
  PendingState,
  PlayerStateEntity,
} from '../models/game-state.model';
import { DeclarativeChoiceRuntime } from './declarative-choice-runtime';
import type {
  CompiledGameDefinition,
  DeclarativeState,
  GameActionMap,
  GameActionShape,
} from './game-definition';
import type { GameContext } from './game-rule-context';
import { projectGameSystemView } from './game-system-view';
import { asRecord } from './runtime-game-action';
import {
  deriveGameShortcuts,
  describeGameDefinition,
} from './runtime-descriptor';
import { randomLegalAction } from './bot-kit';
import { canConfigureGame, GAME_CONFIGURE_ACTION } from './configuration-kit';
import { nextScheduledAction, projectScheduler } from './scheduler-kit';

export abstract class DeclarativeGameQueries<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
> {
  protected abstract readonly definition: CompiledGameDefinition<
    TState,
    TActions,
    TPlayerView
  >;
  protected abstract readonly choices: DeclarativeChoiceRuntime<
    TState,
    TActions,
    TPlayerView
  >;
  protected abstract runtimeState(
    state: GameStateEntity,
  ): DeclarativeState<TState>;
  protected abstract context(
    state: DeclarativeState<TState>,
    actorId: number | null,
    execution?: GameExecutionContext,
  ): GameContext<TState>;
  protected abstract actionDefinition(type: string): GameActionShape<TState>;
  protected abstract requireActor(
    runtime: DeclarativeState<TState>,
    playerId: number | null,
  ): PlayerStateEntity;
  protected abstract isActionAvailable(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    type: string,
    context: GameContext<TState>,
  ): boolean;
  abstract validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    playerId?: number | null,
  ): GameSingleActionDto;

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
    const gameView = this.definition.viewExtension
      ? this.definition.viewExtension({
          state: runtime.game,
          actor,
          ctx: context,
        })
      : ({} as TPlayerView);
    const pending = projectPending(runtime.pending, actor?.id ?? null);
    const system = projectGameSystemView({
      runtime,
      viewerPlayerId: actor?.id ?? null,
      components: this.definition.components,
      hasConfiguration: this.definition.config != null,
      playerValuesVisibility: this.definition.playerValuesVisibility,
    });
    return {
      ...system,
      game: gameView,
      actionCatalog: describeGameDefinition(this.definition).actions,
      timers: projectScheduler(
        runtime.engine.scheduler,
        actor?.id ?? null,
        context.clock.nowMs(),
      ),
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
    choiceId:
      typeof pending.data?.choiceId === 'string'
        ? pending.data.choiceId
        : undefined,
    workflowKind:
      typeof pending.data?.kind === 'string' ? pending.data.kind : undefined,
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
