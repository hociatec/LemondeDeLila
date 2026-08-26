import type { GameRuntime } from '../contracts/game-runtime.interface';
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
  PlayerStateEntity,
} from '../models/game-state.model';
import {
  GameActionRejectedError,
  GameActorRequiredError,
  GameUnknownActionError,
} from '../../domain/errors/game-domain.errors';
import { createCardsKitState } from './cards-kit';
import { DeclarativeChoiceRuntime } from './declarative-choice-runtime';
import { DeclarativeLifecycle } from './declarative-lifecycle';
import type {
  DeclarativeGameDefinition,
  DeclarativeState,
  GameActionMap,
} from './game-definition';
import { isGamePlayerProjection } from './game-definition';
import { GameRuleContext } from './game-rule-context';
import { createMovementKitState } from './movement-kit';
import { createDiceKitState } from './dice-kit';
import { createGridKitState } from './grid-kit';
import { projectGameKits } from './game-kit-view';
import { createQuizKitState } from './quiz-kit';
import { installGameComponents } from './component-kit';
import { standardTurn, type TurnPolicy } from './turn-kit';

const CHOICE_RESOLVE = 'choice.resolve';
const CHOICE_TIMEOUT = 'choice.timeout';

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
    const runtime = this.createRuntime(baseState);
    const context = this.context(runtime, null, execution?.clock);
    installGameComponents(
      this.definition.components ?? [],
      runtime.players ?? [],
      context,
    );
    runtime.game = this.definition.setup({
      players: runtime.players ?? [],
      ctx: context,
    });
    this.lifecycle.enterInitialPhase(runtime, context);
    this.lifecycle.stabilize(runtime, context);
    return runtime;
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
    execution?: GameExecutionContext,
  ): GameStateEntity {
    let runtime = structuredClone(state) as DeclarativeState<TState>;
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
    const runtime = state as DeclarativeState<TState>;
    const actor = this.requireActor(runtime, actorId);
    const context = this.context(runtime, actor.id);
    if (action.type === CHOICE_RESOLVE || action.type === CHOICE_TIMEOUT) {
      this.choices.ensureActor(
        runtime,
        actor,
        action.type === CHOICE_TIMEOUT,
        context.clock.nowMs(),
      );
      return { ...action, meta: { ...(action.meta ?? {}), actorId: actor.id } };
    }
    const definition = this.actionDefinition(action.type);
    const input = definition.input.parse(action.payload ?? {});
    this.ensureActionAvailable(runtime, actor, action.type, context, input);
    return {
      ...action,
      payload: input as Record<string, unknown>,
      meta: { ...(action.meta ?? {}), actorId: actor.id },
    };
  }

  validateActor(
    state: GameStateEntity,
    _actions: GameSingleActionDto[],
    actorId: number | null,
  ): boolean {
    const runtime = state as DeclarativeState<TState>;
    const actor = (runtime.players ?? []).find(
      (player) => player.id === actorId,
    );
    if (!actor) return false;
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
    const runtime = state as DeclarativeState<TState>;
    const actor = (runtime.players ?? []).find(
      (player) => player.id === playerId,
    );
    if (!actor || String(runtime.status).toLowerCase() === 'finished')
      return [];
    if (runtime.pending) return this.choices.actions(runtime, actor);
    const context = this.context(runtime, actor.id);
    return Object.entries(this.definition.actions).flatMap(
      ([type, definition]) => {
        if (!this.isActionAvailable(runtime, actor, type, context)) return [];
        const inputs = definition.availableInputs?.({
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

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const runtime = state as DeclarativeState<TState>;
    const actor =
      (runtime.players ?? []).find((player) => player.id === userId) ?? null;
    const context = this.context(runtime, actor?.id ?? null);
    const projected = this.definition.view({
      state: runtime.game,
      actor,
      ctx: context,
    });
    const projection = isGamePlayerProjection(projected)
      ? projected
      : { game: projected, extras: undefined, board: undefined };
    const {
      engine: _engine,
      game: _game,
      metadata: _metadata,
      ...publicState
    } = runtime;
    const pending =
      runtime.pending?.playerId == null ||
      runtime.pending.playerId === actor?.id
        ? runtime.pending
        : runtime.pending
          ? {
              type: runtime.pending.type,
              label: runtime.pending.label,
              playerId: runtime.pending.playerId,
              blocking: runtime.pending.blocking,
            }
          : null;
    return {
      ...publicState,
      game: projection.game,
      extras: {
        ...(publicState.extras ?? {}),
        ...projectGameKits(
          runtime.engine.kits,
          actor?.id ?? null,
          runtime.turn?.turnNumber ?? 0,
        ),
        ...(projection.extras ?? {}),
      },
      board: projection.board ?? publicState.board,
      metadata: {},
      actions: this.getAvailableActions(runtime, userId),
      pending,
    };
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null {
    const runtime = state as DeclarativeState<TState>;
    const actor = (runtime.players ?? []).find(
      (player) => player.id === botPlayerId && player.isBot,
    );
    if (!actor) return null;
    const pending = this.choices.actions(runtime, actor);
    if (pending.length > 0) return [pending[0]];
    const available = this.getAvailableActions(runtime, botPlayerId);
    if (!this.definition.bot || available.length === 0) return null;
    const decisionRuntime = structuredClone(runtime);
    const decisionActor = this.requireActor(decisionRuntime, botPlayerId);
    const context = this.context(decisionRuntime, botPlayerId);
    const selected = this.definition.bot.choose({
      state: decisionRuntime.game,
      actor: decisionActor,
      availableActions: available.map((action) => action.type),
      ctx: context,
    });
    if (!selected) return null;
    return [
      this.validateAction(
        runtime,
        { ...selected, meta: { actorId: botPlayerId } },
        botPlayerId,
      ),
    ];
  }

  getAutomaticActions(state: GameStateEntity) {
    const runtime = state as DeclarativeState<TState>;
    const data = asRecord(runtime.pending?.data);
    const deadlineMs = Number(data.deadlineMs);
    if (!runtime.pending || !Number.isFinite(deadlineMs)) return null;
    const actorId = runtime.pending.playerId ?? null;
    const choiceId = typeof data.choiceId === 'string' ? data.choiceId : '';
    return {
      key: `choice-timeout:${choiceId}:${deadlineMs}`,
      executeAtMs: deadlineMs,
      actions: [{ type: CHOICE_TIMEOUT, payload: {}, meta: { actorId } }],
    };
  }

  getShortcuts() {
    return [...structuredClone(this.definition.shortcuts ?? [])];
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
    const context = this.context(runtime, actor.id, execution?.clock);
    if (action.type === CHOICE_RESOLVE || action.type === CHOICE_TIMEOUT) {
      this.choices.resolve(
        runtime,
        actor,
        action,
        context,
        action.type === CHOICE_TIMEOUT,
      );
    } else {
      this.executeDefinitionAction(runtime, actor, action, context);
    }
    this.lifecycle.stabilize(runtime, context);
    this.recordContextEvents(runtime, actor.id, action.type, context);
    return runtime;
  }

  private executeDefinitionAction(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    action: GameSingleActionDto,
    context: GameRuleContext<TState>,
  ): void {
    const definition = this.actionDefinition(action.type);
    const input = definition.input.parse(action.payload ?? {});
    this.ensureActionAvailable(runtime, actor, action.type, context, input);
    const next = definition.execute({
      state: runtime.game,
      actor,
      input,
      ctx: context,
    });
    if (next) context.replaceState(next);
  }

  private createRuntime(base: GameStateEntity): DeclarativeState<TState> {
    const players = structuredClone(base.players ?? []);
    const turn = this.turnPolicy().initialize(players);
    const phase =
      this.definition.initialPhase ??
      Object.keys(this.definition.phases ?? {})[0] ??
      'playing';
    const metadata = base.metadata ?? {};
    return {
      ...structuredClone(base),
      status: base.status || 'started',
      phase,
      players,
      turn,
      pending: null,
      game: {} as TState,
      engine: {
        version: Number(base.version ?? 1),
        status: base.status || 'started',
        players,
        turn,
        phase,
        pending: null,
        rng: metadata.rng ?? { seed: 0, counter: 0 },
        eventSequence: 0,
        kits: {
          cards: createCardsKitState(),
          movement: createMovementKitState(),
          dice: createDiceKitState(),
          grid: createGridKitState(),
          quiz: createQuizKitState(),
        },
      },
    };
  }

  private context(
    runtime: DeclarativeState<TState>,
    actorId: number | null,
    clock = new SystemGameClock(),
  ): GameRuleContext<TState> {
    const actor =
      (runtime.players ?? []).find((player) => player.id === actorId) ?? null;
    return new GameRuleContext(
      runtime,
      actor,
      { actorId, rng: new StateGameRng(runtime), clock },
      this.turnPolicy(),
    );
  }

  private turnPolicy(): TurnPolicy {
    return this.definition.turn ?? standardTurn();
  }

  private actionDefinition(type: string) {
    const action = this.definition.actions[type];
    if (!action) throw new GameUnknownActionError(`Action inconnue: ${type}`);
    return action;
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
    context: GameRuleContext<TState>,
    input?: unknown,
  ): void {
    if (
      !this.isActionAvailable(runtime, actor, type, context) ||
      !this.isEnumeratedInput(runtime, actor, type, context, input)
    ) {
      throw new GameActionRejectedError(`Action indisponible: ${type}`);
    }
  }

  private isEnumeratedInput(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    type: string,
    context: GameRuleContext<TState>,
    input: unknown,
  ): boolean {
    const enumerate = this.actionDefinition(type).availableInputs;
    if (!enumerate) return true;
    return enumerate({ state: runtime.game, actor, ctx: context }).some(
      (candidate) => JSON.stringify(candidate) === JSON.stringify(input),
    );
  }

  private isActionAvailable(
    runtime: DeclarativeState<TState>,
    actor: PlayerStateEntity,
    type: string,
    context: GameRuleContext<TState>,
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
    actorId: number,
    actionType: string,
    context: GameRuleContext<TState>,
  ): void {
    const events = [...context.consumeEffects(), ...context.consumeEvents()];
    const engine = runtime.engine;
    engine.pendingEvents = [
      ...(engine.pendingEvents ?? []),
      ...events.map((event) => ({
        ...event,
        actorId,
        occurredAtMs: context.clock.nowMs(),
        data: { actionType, ...event.data },
      })),
    ];
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
