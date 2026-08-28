import type { GameExecutionContext } from '../models/game-execution-context.model';
import type { PlayerStateEntity } from '../models/game-state.model';
import type { EventVisibility } from '../models/game-event.model';
import {
  createCardsKitState,
  GameCardsController,
  type CardSetsDefinition,
  type DeckDefinition,
  type HandsDefinition,
} from './cards-kit';
import {
  createInventoryKitState,
  GameInventoryController,
  type InventoryDefinition,
} from './inventory-kit';
import {
  createEconomyKitState,
  GameEconomyController,
  type MarketDefinition,
} from './economy-kit';
import {
  createOwnershipKitState,
  GameOwnershipController,
  type OwnershipDefinition,
} from './ownership-kit';
import { GameRankingController } from './ranking-kit';
import type { DeclarativeState } from './game-definition';
import { GameChoiceController } from './game-choice-controller';
import { createMovementKitState, GameMovementController } from './movement-kit';
import {
  createPawnKitState,
  GamePawnController,
  type PawnSetDefinition,
} from './pawn-kit';
import type { TurnPolicy } from './turn-kit';
import {
  createDiceKitState,
  GameDiceController,
  type DiceDefinition,
} from './dice-kit';
import {
  createGridKitState,
  GameGridController,
  type GridDefinition,
} from './grid-kit';
import { createQuizKitState, GameQuizController } from './quiz-kit';
import { GameMatchController } from './match-kit';
import { GameRoundController } from './round-kit';
import {
  GameCountersController,
  GameResourcesController,
  GameScoreController,
  GameStatusController,
} from './player-values-kit';
import {
  GameConfigurationError,
  GameRuleViolationError,
} from '../../domain/errors/game-domain.errors';
import type { GameLifecycleHooks } from './game-lifecycle-hooks';
import { GameConfigurationController } from './configuration-kit';
import {
  resetGameComponents,
  type GameComponentDefinition,
} from './component-kit';
import type { QuizDefinition } from './quiz-kit';
import { GameEffectEngineController } from './effect-engine';
import type { GameEffectResolverShape } from './effects-kit';
import {
  GameSubmissionController,
  GameSubmissionFlowController,
  GameJudgeController,
  GameVotingController,
} from './submission-kit';
import {
  ENGINE_EVENT_VISIBILITY,
  type EngineEventMap,
  type EngineEventType,
  isEngineEventType,
} from './engine-event-registry';
import { GameSchedulerController } from './scheduler-kit';
import type { PhaseConfiguration } from './phase-kit';
import type { PlayerMap } from './game-identifiers';

export type EventDataMap = Record<string, object>;
export type { EngineEventMap } from './engine-event-registry';
export type { EventVisibility } from '../models/game-event.model';

export type DomainEvent<TEvents extends EventDataMap = EventDataMap> = {
  [TType in keyof TEvents & string]: {
    type: TType;
    data: TEvents[TType];
    visibility: EventVisibility;
  };
}[keyof TEvents & string];

type EngineVisibilityArguments<TType extends EngineEventType> =
  (typeof ENGINE_EVENT_VISIBILITY)[TType] extends 'dynamic'
    ? [visibility: EventVisibility]
    : [visibility?: EventVisibility];

function resolveEngineVisibility(
  type: EngineEventType,
  visibility?: EventVisibility,
): EventVisibility {
  if (visibility) return visibility;
  const policy = ENGINE_EVENT_VISIBILITY[type];
  if (policy === 'public' || policy === 'internal') return { kind: policy };
  throw new GameConfigurationError(
    `L'événement ${type} requiert une visibilité explicite`,
  );
}

export class GameContext<TState extends object> {
  readonly random: GameExecutionContext['rng'];
  readonly clock: GameExecutionContext['clock'];
  readonly commandId: string | null;
  readonly ranking = new GameRankingController();
  readonly choice: GameChoiceController;
  readonly match: GameMatchController;
  readonly round: GameRoundController;
  readonly score: GameScoreController;
  readonly resources: GameResourcesController;
  readonly counters: GameCountersController;
  readonly status: GameStatusController;
  readonly config: GameConfigurationController;
  readonly submissions: GameSubmissionController;
  readonly submissionFlow: GameSubmissionFlowController;
  readonly judge: GameJudgeController;
  readonly voting: GameVotingController;
  readonly scheduler: GameSchedulerController;
  readonly effects: GameEffectEngineController<TState>;
  private cardsController?: GameCardsController;
  private inventoryController?: GameInventoryController;
  private economyController?: GameEconomyController;
  private ownershipController?: GameOwnershipController;
  private movementController?: GameMovementController;
  private pawnController?: GamePawnController;
  private diceController?: GameDiceController;
  private gridController?: GameGridController;
  private quizController?: GameQuizController;
  private emitDomainEvent: (
    type: string,
    data: Record<string, unknown>,
    visibility?: EventVisibility,
  ) => void = () => {};
  readonly events = {
    emit: (
      type: string,
      data: Record<string, unknown> = {},
      visibility: EventVisibility = { kind: 'public' },
    ) => this.eventsBuffer.push({ type, data, visibility }),
    engine: <TType extends keyof EngineEventMap>(
      type: TType,
      data: EngineEventMap[TType],
      ...[visibility]: EngineVisibilityArguments<TType>
    ) => {
      this.eventsBuffer.push({
        type,
        data,
        visibility: resolveEngineVisibility(type, visibility),
      });
    },
    message: (key: string, params: Record<string, unknown> = {}) => {
      const normalizedKey = key.trim();
      if (!normalizedKey) return;
      this.eventsBuffer.push({
        type: 'game.message',
        data: { key: normalizedKey, params: structuredClone(params) },
        visibility: { kind: 'public' },
      });
      this.runtime.log.push({
        key: normalizedKey,
        params: structuredClone(params),
        timestamp: this.clock.nowIso(),
      });
    },
    latestMessage: () => {
      const entry = this.runtime.log.at(-1);
      return entry == null ? null : structuredClone(entry);
    },
    messages: () => structuredClone(this.runtime.log),
  };
  readonly reject = (
    code: string,
    details: Readonly<Record<string, unknown>> = {},
    message = 'Règle de jeu non respectée',
  ): never => {
    throw new GameRuleViolationError(code, details, message);
  };
  readonly players = {
    all: () => [...(this.runtime.players ?? [])],
    byId: <TValue>(
      select: (player: PlayerStateEntity, index: number) => TValue,
    ): PlayerMap<TValue> =>
      Object.fromEntries(
        (this.runtime.players ?? []).map((player, index) => [
          player.id,
          select(player, index),
        ]),
      ),
    active: () =>
      (this.runtime.players ?? []).filter(
        (player) => this.match.playerStatus(player.id) === 'active',
      ),
    remaining: () => this.match.activePlayers(),
    get: (playerId: number) =>
      this.runtime.players?.find((player) => player.id === playerId) ?? null,
    others: (playerId = this.actor?.id ?? null) =>
      (this.runtime.players ?? []).filter((player) => player.id !== playerId),
    otherIds: (playerId = this.actor?.id ?? null) =>
      (this.runtime.players ?? [])
        .filter((player) => player.id !== playerId)
        .map((player) => player.id),
    count: () => this.runtime.players?.length ?? 0,
    current: () =>
      this.runtime.players?.find(
        (player) => player.id === this.runtime.turn?.currentPlayerId,
      ) ?? null,
    next: () => this.adjacentPlayer(1),
    previous: () => this.adjacentPlayer(-1),
    after: (playerId: number, offset = 1) =>
      this.playerAtOffset(playerId, offset),
    before: (playerId: number, offset = 1) =>
      this.playerAtOffset(playerId, -offset),
    randomOther: (playerId = this.actor?.id ?? null) =>
      this.random.pick(
        (this.runtime.players ?? []).filter((player) => player.id !== playerId),
      ) ?? null,
  };
  readonly turn = {
    is: (playerId: number) => this.runtime.turn?.currentPlayerId === playerId,
    number: () => this.runtime.turn?.turnNumber ?? 0,
    direction: () => this.runtime.turn?.direction ?? 1,
    end: () => this.endTurn(),
    complete: (options: { waiting?: boolean } = {}) =>
      this.completeTurn(options),
    reverse: () => this.reverseTurn(),
    skip: (playerId?: number, count = 1) =>
      playerId == null
        ? this.skipNextPlayer()
        : this.scheduleSkippedTurns(playerId, count),
    skipCount: (playerId: number) =>
      this.runtime.engine.playerValues.scheduledSkips[String(playerId)] ?? 0,
    cancelSkip: (playerId: number, count = 1) =>
      this.cancelScheduledSkips(playerId, count),
    extra: (count = 1, playerId?: number) => this.addExtraTurn(count, playerId),
    extraCount: (playerId?: number) => this.extraTurnCount(playerId),
    clearExtra: (playerId?: number) => this.clearExtraTurns(playerId),
    replaceUpcoming: (playerId: number, replacementId: number) =>
      this.scheduleTurnReplacement(playerId, replacementId),
    swapUpcoming: (firstPlayerId: number, secondPlayerId: number) => {
      this.scheduleTurnReplacement(firstPlayerId, secondPlayerId);
      this.scheduleTurnReplacement(secondPlayerId, firstPlayerId);
    },
    replacementFor: (playerId: number) =>
      this.runtime.turn?.scheduledTurnReplacements?.[String(playerId)] ?? null,
    spend: (points = 1) => this.spendActionPoints(points),
    remaining: () => this.runtime.turn?.actionPointsRemaining ?? null,
    to: (playerId: number) => this.moveTurnTo(playerId),
    waitForAll: (sessionId: string) => this.waitForAll(sessionId),
    waitingSession: () => this.runtime.turn?.simultaneousSessionId ?? null,
    waitingPlayers: (sessionId?: string) => this.waitingPlayers(sessionId),
    completeWaiting: (sessionId?: string) => this.completeWaiting(sessionId),
    flags: {
      get: <TValue>(key: string): TValue | null =>
        (this.runtime.engine.playerValues.turnFlags[key] as
          TValue | undefined) ?? null,
      set: (key: string, value: unknown = true) => {
        this.runtime.engine.playerValues.turnFlags[key] =
          structuredClone(value);
      },
      consume: (key: string): boolean => {
        if (!(key in this.runtime.engine.playerValues.turnFlags)) return false;
        delete this.runtime.engine.playerValues.turnFlags[key];
        return true;
      },
      clear: () => {
        this.runtime.engine.playerValues.turnFlags = {};
      },
    },
  };
  readonly phase = {
    current: () => this.runtime.phase,
    is: (phaseId: string) => this.runtime.phase === phaseId,
    transitionTo: (phaseId: string) => this.transitionTo(phaseId),
  };
  private readonly eventsBuffer: DomainEvent[] = [];

  get cards(): GameCardsController {
    return (this.cardsController ??= new GameCardsController(
      (this.runtime.engine.kits.cards ??= createCardsKitState()),
      this.execution.rng,
      this.emitDomainEvent,
      this.components.filter(
        (
          component,
        ): component is (
          DeckDefinition<unknown> | HandsDefinition | CardSetsDefinition
        ) & {
          readonly scope?: import('./component-kit').GameComponentScope;
        } => component.component.startsWith('cards.'),
      ),
    ));
  }

  get inventory(): GameInventoryController {
    return (this.inventoryController ??= new GameInventoryController(
      (this.runtime.engine.kits.inventory ??= createInventoryKitState()),
      this.execution.rng,
      this.emitDomainEvent,
      this.components.filter(
        (component): component is InventoryDefinition =>
          component.component === 'inventory.set',
      ),
    ));
  }

  get economy(): GameEconomyController {
    return (this.economyController ??= new GameEconomyController(
      (this.runtime.engine.kits.economy ??= createEconomyKitState()),
      this.resources,
      this.inventory,
      this.emitDomainEvent,
      this.components.filter(
        (component): component is MarketDefinition =>
          component.component === 'economy.market',
      ),
    ));
  }

  get ownership(): GameOwnershipController {
    return (this.ownershipController ??= new GameOwnershipController(
      (this.runtime.engine.kits.ownership ??= createOwnershipKitState()),
      this.emitDomainEvent,
      this.components.filter(
        (component): component is OwnershipDefinition =>
          component.component === 'ownership.registry',
      ),
    ));
  }

  get movement(): GameMovementController {
    return (this.movementController ??= new GameMovementController(
      (this.runtime.engine.kits.movement ??= createMovementKitState()),
      this.emitDomainEvent,
      this.components.filter(
        (
          component,
        ): component is import('./movement-kit').TrackDefinition & {
          readonly scope?: import('./component-kit').GameComponentScope;
        } => component.component === 'movement.track',
      ),
      (...effects) => this.effects.schedule(...effects),
    ));
  }

  get pawns(): GamePawnController {
    return (this.pawnController ??= new GamePawnController(
      (this.runtime.engine.kits.pawns ??= createPawnKitState()),
      this.runtime.players ?? [],
      this.emitDomainEvent,
      this.components.filter(
        (component): component is PawnSetDefinition =>
          component.component === 'pawn.set',
      ),
    ));
  }

  get dice(): GameDiceController {
    return (this.diceController ??= new GameDiceController(
      (this.runtime.engine.kits.dice ??= createDiceKitState()),
      this.execution.rng,
      this.emitDomainEvent,
      this.components.filter(
        (component): component is DiceDefinition =>
          component.component === 'dice.set',
      ),
      () => this.actor?.id ?? this.runtime.turn?.currentPlayerId ?? null,
    ));
  }

  get grid(): GameGridController {
    return (this.gridController ??= new GameGridController(
      (this.runtime.engine.kits.grid ??= createGridKitState()),
      this.components.filter(
        (component): component is GridDefinition =>
          component.component === 'grid.board',
      ),
    ));
  }

  get quiz(): GameQuizController {
    return (this.quizController ??= new GameQuizController(
      (this.runtime.engine.kits.quiz ??= createQuizKitState()),
      this.execution.rng,
      this.components.filter(
        (
          component,
        ): component is QuizDefinition & {
          readonly scope?: import('./component-kit').GameComponentScope;
        } => component.component === 'quiz.bank',
      ),
      this.emitDomainEvent,
      (playerId, amount) => this.score.add(playerId, amount),
    ));
  }

  constructor(
    private readonly runtime: DeclarativeState<TState>,
    readonly actor: PlayerStateEntity | null,
    private readonly execution: GameExecutionContext,
    private readonly turnPolicy: TurnPolicy,
    private readonly phases: Readonly<
      Record<string, PhaseConfiguration<TState>>
    >,
    private readonly lifecycleHooks: GameLifecycleHooks<TState> = {},
    private readonly components: readonly GameComponentDefinition[] = [],
    effectResolvers: Readonly<
      Record<string, GameEffectResolverShape<TState>>
    > = {},
  ) {
    this.random = execution.rng;
    this.clock = execution.clock;
    this.commandId = execution.commandId ?? null;
    const emit = (
      type: string,
      data: Record<string, unknown>,
      visibility?: EventVisibility,
    ) => {
      const projectedVisibility = isEngineEventType(type)
        ? resolveEngineVisibility(type, visibility)
        : (visibility ?? { kind: 'public' });
      this.eventsBuffer.push({
        type,
        data,
        visibility: projectedVisibility,
      });
    };
    this.emitDomainEvent = emit;
    this.match = new GameMatchController(
      this.runtime.engine.match,
      this.runtime.players ?? [],
      () => this.clock.nowMs(),
      emit,
      (status) => {
        this.runtime.status = status;
        if (status === 'finished' || status === 'cancelled') {
          this.status.tick('match');
        }
      },
    );
    this.round = new GameRoundController(
      this.runtime.engine.round,
      this.runtime.players ?? [],
      emit,
      {
        onStart: (roundNumber) => {
          if (roundNumber > 1) {
            resetGameComponents(
              'round',
              this.components,
              this.runtime.players ?? [],
              this,
            );
          }
          this.runRoundHook(this.lifecycleHooks.onRoundStart, roundNumber);
        },
        onEnd: (roundNumber) => {
          this.runRoundHook(this.lifecycleHooks.onRoundEnd, roundNumber);
          this.status.tick('round');
        },
      },
    );
    this.score = new GameScoreController(
      this.runtime.engine.playerValues,
      emit,
    );
    this.resources = new GameResourcesController(
      this.runtime.engine.playerValues,
      emit,
    );
    this.counters = new GameCountersController(
      this.runtime.engine.playerValues,
      emit,
    );
    this.status = new GameStatusController(this.runtime.engine.playerValues);
    this.config = new GameConfigurationController(
      this.runtime.engine.configuration,
    );
    this.submissions = new GameSubmissionController(
      this.runtime.engine.submissions,
      this.runtime.players ?? [],
      emit,
    );
    this.voting = new GameVotingController(
      this.runtime.engine.submissions,
      this.runtime.players ?? [],
      emit,
    );
    this.judge = new GameJudgeController(
      this.runtime.engine.submissions,
      this.runtime.players ?? [],
      emit,
    );
    this.submissionFlow = new GameSubmissionFlowController(
      this.submissions,
      this.voting,
      this.judge,
      {
        waitForAll: (sessionId) => this.turn.waitForAll(sessionId),
        completeWaiting: (sessionId) => this.turn.completeWaiting(sessionId),
      },
    );
    this.scheduler = new GameSchedulerController(
      this.runtime.engine.scheduler,
      () => this.clock.nowMs(),
      emit,
    );
    this.choice = new GameChoiceController(
      () => this.runtime.pending,
      (pending) => {
        this.runtime.pending = pending;
      },
      () => this.clock.nowMs(),
    );
    this.effects = new GameEffectEngineController(
      this.runtime.engine.effects,
      () => this.runtime.game,
      this,
      effectResolvers,
    );
  }

  get state(): TState {
    return this.runtime.game;
  }

  transitionTo(phase: string): void {
    const phaseNames = Object.keys(this.phases);
    if (phaseNames.length > 0 && !phaseNames.includes(phase)) {
      this.reject('UNKNOWN_PHASE', { phase }, `Phase inconnue: ${phase}`);
    }
    const previous = this.runtime.phase;
    if (previous === phase) return;
    this.phases[previous]?.exit?.({
      state: this.runtime.game,
      ctx: this,
    });
    this.scheduler.cancel(this.phaseTimerId(previous));
    this.runtime.phase = phase;
    this.enterPhase(phase);
    this.events.engine('game.phase.changed', { phase });
  }

  enterCurrentPhase(): void {
    this.enterPhase(this.runtime.phase);
  }

  consumeEvents(): DomainEvent[] {
    return this.eventsBuffer.splice(0);
  }

  assertValidKits(): void {
    const kits = this.runtime.engine.kits;
    if (kits.cards) this.cards.assertValid();
    if (kits.inventory) this.inventory.assertValid();
    if (kits.economy) this.economy.assertValid();
    if (kits.ownership) this.ownership.assertValid();
    if (kits.movement) this.movement.assertValid();
    if (kits.pawns) this.pawns.assertValid();
    if (kits.dice) this.dice.assertValid();
    if (kits.grid) this.grid.assertValid();
    if (kits.quiz) this.quiz.assertValid();
  }

  runBeforeCurrentTurnHook(): void {
    if (this.runtime.engine.match.status !== 'playing') return;
    this.runTurnHook(
      this.lifecycleHooks.beforeTurn,
      this.runtime.turn?.currentPlayerId ?? null,
    );
  }

  private completeTurn(options: { waiting?: boolean }): boolean {
    if (
      options.waiting === true ||
      this.runtime.engine.match.status === 'finished' ||
      this.runtime.pending != null ||
      this.effects.isResolving()
    ) {
      return false;
    }
    this.endTurn();
    return true;
  }

  private enterPhase(phaseId: string): void {
    const phase = this.phases[phaseId];
    phase?.enter?.({ state: this.runtime.game, ctx: this });
    if (!phase?.timeout) return;
    this.scheduler.schedule(this.phaseTimerId(phaseId), {
      afterMs: phase.timeout.afterMs,
      action: phase.timeout.action,
      visibility:
        phase.timeout.visibility ??
        (phase.visibility === 'hidden'
          ? { kind: 'internal' }
          : { kind: 'public' }),
    });
  }

  private phaseTimerId(phaseId: string): string {
    return `engine.phase.${phaseId}`;
  }

  private endTurn(): void {
    const current = this.runtime.turn ?? this.turnPolicy.initialize([]);
    const endedPlayerId = current.currentPlayerId;
    const endedTurnNumber = current.turnNumber ?? 1;
    this.runTurnHook(this.lifecycleHooks.afterTurn, endedPlayerId);
    this.status.tick('turn', endedPlayerId ?? undefined);
    this.status.tick('global-turn');
    this.runtime.engine.playerValues.turnFlags = {};
    this.effects.clearSource();
    if (this.runtime.engine.match.status === 'finished') {
      this.events.engine('turn.ended', {
        playerId: endedPlayerId,
        turnNumber: endedTurnNumber,
      });
      return;
    }
    const scheduledExtraKey = String(endedPlayerId ?? '');
    const scheduledExtraTurns =
      this.runtime.engine.playerValues.scheduledExtraTurns?.[
        scheduledExtraKey
      ] ?? 0;
    if ((current.extraTurns ?? 0) > 0 || scheduledExtraTurns > 0) {
      if ((current.extraTurns ?? 0) > 0) {
        current.extraTurns = Math.max(0, (current.extraTurns ?? 0) - 1);
      } else {
        this.runtime.engine.playerValues.scheduledExtraTurns ??= {};
        this.runtime.engine.playerValues.scheduledExtraTurns[
          scheduledExtraKey
        ] = scheduledExtraTurns - 1;
      }
      current.turnNumber = (current.turnNumber ?? 1) + 1;
      this.resetActionPoints(current);
      this.runtime.turn = current;
      this.emitTurnTransition(endedPlayerId, endedTurnNumber, current);
      this.runBeforeCurrentTurnHook();
      return;
    }
    if (current.replacedSlotOwnerId != null) {
      current.currentPlayerId = current.replacedSlotOwnerId;
      current.replacedSlotOwnerId = null;
    }
    let nextTurn = this.turnPolicy.advance(current, this.runtime.players ?? []);
    for (
      let checked = 0;
      checked < (this.runtime.players?.length ?? 0);
      checked += 1
    ) {
      const nextPlayerId = nextTurn.currentPlayerId;
      if (nextPlayerId == null) break;
      const remaining =
        this.runtime.engine.playerValues.scheduledSkips[String(nextPlayerId)] ??
        0;
      if (remaining <= 0) break;
      this.runtime.engine.playerValues.scheduledSkips[String(nextPlayerId)] =
        remaining - 1;
      this.events.engine('player.skipped', { playerId: nextPlayerId });
      this.runTurnHook(this.lifecycleHooks.afterTurn, nextPlayerId);
      this.status.tick('turn', nextPlayerId);
      this.status.tick('global-turn');
      nextTurn = this.turnPolicy.advance(nextTurn, this.runtime.players ?? []);
    }
    this.applyScheduledTurnReplacement(nextTurn);
    this.runtime.turn = nextTurn;
    this.emitTurnTransition(endedPlayerId, endedTurnNumber, nextTurn);
    this.runBeforeCurrentTurnHook();
  }

  private skipNextPlayer(): void {
    const skipped = this.turnPolicy.advance(
      this.runtime.turn ?? this.turnPolicy.initialize([]),
      this.runtime.players ?? [],
    ).currentPlayerId;
    this.endTurn();
    this.endTurn();
    if (skipped != null && this.runtime.turn) {
      this.runtime.turn.skippedPlayerIds = [
        ...(this.runtime.turn.skippedPlayerIds ?? []),
        skipped,
      ];
    }
  }

  private addExtraTurn(count: number, playerId?: number): void {
    const targetId = playerId ?? this.runtime.turn?.currentPlayerId;
    if (targetId == null) return;
    if (!this.players.get(targetId)) {
      this.reject(
        'UNKNOWN_PLAYER',
        { playerId: targetId },
        'Joueur absent de la partie',
      );
    }
    const amount = Math.max(1, Math.floor(count));
    if (targetId === this.runtime.turn?.currentPlayerId) {
      this.runtime.turn.extraTurns =
        (this.runtime.turn.extraTurns ?? 0) + amount;
      return;
    }
    const scheduled = (this.runtime.engine.playerValues.scheduledExtraTurns ??=
      {});
    const key = String(targetId);
    scheduled[key] = (scheduled[key] ?? 0) + amount;
  }

  private extraTurnCount(playerId?: number): number {
    const targetId = playerId ?? this.runtime.turn?.currentPlayerId;
    if (targetId == null) return 0;
    const immediate =
      targetId === this.runtime.turn?.currentPlayerId
        ? (this.runtime.turn?.extraTurns ?? 0)
        : 0;
    return (
      immediate +
      (this.runtime.engine.playerValues.scheduledExtraTurns?.[
        String(targetId)
      ] ?? 0)
    );
  }

  private clearExtraTurns(playerId?: number): void {
    const targetId = playerId ?? this.runtime.turn?.currentPlayerId;
    if (targetId == null) return;
    if (targetId === this.runtime.turn?.currentPlayerId && this.runtime.turn) {
      this.runtime.turn.extraTurns = 0;
    }
    this.runtime.engine.playerValues.scheduledExtraTurns ??= {};
    this.runtime.engine.playerValues.scheduledExtraTurns[String(targetId)] = 0;
  }

  private scheduleTurnReplacement(
    playerId: number,
    replacementId: number,
  ): void {
    if (!this.players.get(playerId) || !this.players.get(replacementId)) {
      this.reject(
        'UNKNOWN_PLAYER',
        { playerId, replacementId },
        'Joueur absent de la partie',
      );
    }
    const turn = this.runtime.turn ?? this.turnPolicy.initialize([]);
    (turn.scheduledTurnReplacements ??= {})[String(playerId)] = replacementId;
    this.runtime.turn = turn;
  }

  private applyScheduledTurnReplacement(
    turn: NonNullable<DeclarativeState<TState>['turn']>,
  ): void {
    if (turn.replacedSlotOwnerId != null || turn.currentPlayerId == null)
      return;
    const key = String(turn.currentPlayerId);
    const replacementId = turn.scheduledTurnReplacements?.[key];
    if (replacementId == null) return;
    delete turn.scheduledTurnReplacements?.[key];
    turn.replacedSlotOwnerId = turn.currentPlayerId;
    turn.currentPlayerId = replacementId;
    this.events.engine('turn.replaced', {
      slotOwnerId: turn.replacedSlotOwnerId,
      replacementPlayerId: replacementId,
    });
  }

  private scheduleSkippedTurns(playerId: number, count: number): void {
    if (!this.players.get(playerId)) {
      this.reject('UNKNOWN_PLAYER', { playerId }, 'Joueur absent de la partie');
    }
    const key = String(playerId);
    this.runtime.engine.playerValues.scheduledSkips[key] =
      (this.runtime.engine.playerValues.scheduledSkips[key] ?? 0) +
      Math.max(1, Math.floor(count));
  }

  private cancelScheduledSkips(playerId: number, count: number): number {
    const key = String(playerId);
    const remaining = Math.max(
      0,
      (this.runtime.engine.playerValues.scheduledSkips[key] ?? 0) -
        Math.max(1, Math.floor(count)),
    );
    this.runtime.engine.playerValues.scheduledSkips[key] = remaining;
    return remaining;
  }

  private spendActionPoints(points: number): number {
    const turn = this.runtime.turn;
    if (this.turnPolicy.kind !== 'action-points') {
      this.reject(
        'ACTION_POINTS_DISABLED',
        {},
        'Cette partie n’utilise pas de points d’action',
      );
    }
    if (!turn) {
      return this.reject('TURN_NOT_INITIALIZED', {}, 'Tour non initialisé');
    }
    const amount = Math.max(1, Math.floor(points));
    const remaining = turn.actionPointsRemaining ?? 0;
    if (amount > remaining) {
      this.reject(
        'ACTION_POINTS_INSUFFICIENT',
        { requested: amount, remaining },
        'Points d’action insuffisants',
      );
    }
    turn.actionPointsRemaining = remaining - amount;
    if (turn.actionPointsRemaining === 0) this.endTurn();
    return this.runtime.turn?.actionPointsRemaining ?? 0;
  }

  private resetActionPoints(
    turn: NonNullable<DeclarativeState<TState>['turn']>,
  ): void {
    if (this.turnPolicy.kind === 'action-points') {
      turn.actionPointsRemaining = this.turnPolicy.actionPoints ?? 1;
    }
  }

  private reverseTurn(): void {
    if (!this.runtime.turn) return;
    this.runtime.turn.direction = this.runtime.turn.direction === 1 ? -1 : 1;
  }

  private moveTurnTo(playerId: number): void {
    if (
      !(this.runtime.players ?? []).some((player) => player.id === playerId)
    ) {
      this.reject(
        'UNKNOWN_PLAYER',
        { playerId },
        `Joueur absent de la partie: ${playerId}`,
      );
    }
    const turn = this.runtime.turn ?? this.turnPolicy.initialize([]);
    turn.currentPlayerId = playerId;
    this.runtime.turn = turn;
    this.events.engine('turn.started', {
      playerId,
      turnNumber: turn.turnNumber ?? 1,
    });
    this.runBeforeCurrentTurnHook();
  }

  private waitForAll(sessionId: string): void {
    if (this.turnPolicy.kind !== 'simultaneous') {
      this.reject(
        'SIMULTANEOUS_TURN_DISABLED',
        { sessionId },
        'Cette partie n’utilise pas de tours simultanés',
      );
    }
    const pendingPlayerIds = this.submissions.pendingPlayers(sessionId);
    const turn =
      this.runtime.turn ??
      this.turnPolicy.initialize(this.runtime.players ?? []);
    turn.currentPlayerId = null;
    turn.simultaneousSessionId = sessionId;
    this.runtime.turn = turn;
    this.events.engine('turn.simultaneous.waiting', {
      sessionId,
      pendingPlayerIds,
      turnNumber: turn.turnNumber ?? 1,
    });
  }

  private waitingPlayers(sessionId?: string): number[] {
    const target =
      sessionId ?? this.runtime.turn?.simultaneousSessionId ?? null;
    return target == null ? [] : this.submissions.pendingPlayers(target);
  }

  private completeWaiting(sessionId?: string): boolean {
    const target =
      sessionId ?? this.runtime.turn?.simultaneousSessionId ?? null;
    if (target == null || this.waitingPlayers(target).length > 0) return false;
    if (
      this.runtime.turn?.simultaneousSessionId != null &&
      this.runtime.turn.simultaneousSessionId !== target
    ) {
      this.reject('SIMULTANEOUS_SESSION_MISMATCH', {
        expected: this.runtime.turn.simultaneousSessionId,
        received: target,
      });
    }
    const turn =
      this.runtime.turn ??
      this.turnPolicy.initialize(this.runtime.players ?? []);
    turn.simultaneousSessionId = null;
    turn.turnNumber = (turn.turnNumber ?? 1) + 1;
    this.runtime.turn = turn;
    this.events.engine('turn.simultaneous.completed', {
      sessionId: target,
      turnNumber: turn.turnNumber,
    });
    return true;
  }

  private adjacentPlayer(offset: 1 | -1): PlayerStateEntity | null {
    const players = this.match.activePlayers();
    if (players.length === 0) return null;
    const currentId = this.runtime.turn?.currentPlayerId;
    const currentIndex = players.findIndex((player) => player.id === currentId);
    const direction = (this.runtime.turn?.direction ?? 1) * offset;
    const index =
      (Math.max(0, currentIndex) + direction + players.length) % players.length;
    return players[index] ?? null;
  }

  private playerAtOffset(
    playerId: number,
    offset: number,
  ): PlayerStateEntity | null {
    const players = this.runtime.players ?? [];
    if (players.length === 0) return null;
    const index = players.findIndex((player) => player.id === playerId);
    if (index < 0) return null;
    const normalized =
      (((index + Math.trunc(offset)) % players.length) + players.length) %
      players.length;
    return players[normalized] ?? null;
  }

  private emitTurnTransition(
    endedPlayerId: number | null,
    endedTurnNumber: number,
    next: NonNullable<DeclarativeState<TState>['turn']>,
  ): void {
    this.events.engine('turn.ended', {
      playerId: endedPlayerId,
      turnNumber: endedTurnNumber,
    });
    this.events.engine('turn.started', {
      playerId: next.currentPlayerId,
      turnNumber: next.turnNumber ?? endedTurnNumber + 1,
    });
  }

  private runTurnHook(
    hook: GameLifecycleHooks<TState>['beforeTurn'],
    playerId: number | null,
  ): void {
    if (!hook) return;
    const player =
      (this.runtime.players ?? []).find(
        (candidate) => candidate.id === playerId,
      ) ?? null;
    hook({ state: this.runtime.game, player, ctx: this });
  }

  private runRoundHook(
    hook: GameLifecycleHooks<TState>['onRoundStart'],
    roundNumber: number,
  ): void {
    if (!hook) return;
    hook({ state: this.runtime.game, roundNumber, ctx: this });
  }
}
