import type { GameExecutionContext } from '../../core/application/contracts/game-execution-context.model';
import type { PlayerStateEntity } from '../../core/application/contracts/game-state.model';
import type { EventVisibility } from '../../core/application/contracts/game-event.model';
import { GameCardsController } from './cards/cards-kit';
import { GameInventoryController } from './kits/inventory-kit';
import { GameEconomyController } from './kits/economy-kit';
import { GameOwnershipController } from './kits/ownership-kit';
import { GameRankingController } from './kits/ranking-kit';
import type { DeclarativeState } from './definitions/game-definition';
import { GameChoiceController } from './choices/game-choice-controller';
import { GameMovementController } from './kits/movement-kit';
import { GamePawnController } from './kits/pawn-kit';
import type { TurnPolicy } from './kits/turn-kit';
import { GameTurnController } from './lifecycle/game-turn-controller';
import { GameDiceController } from './kits/dice-kit';
import { GameGridController } from './kits/grid-kit';
import { GameQuizController } from './kits/quiz-kit';
import { GameMatchController } from './kits/match-kit';
import { GameRoundController } from './kits/round-kit';
import {
  GameCountersController,
  GameResourcesController,
  GameScoreController,
  GameStatusController,
} from './kits/player-values-kit';
import { GameRuleViolationError } from '../../core/domain/errors/game-domain.errors';
import type { GameLifecycleHooks } from './lifecycle/game-lifecycle-hooks';
import { GameConfigurationController } from './configuration/configuration-kit';
import {
  resetGameComponents,
  type GameComponentDefinition,
} from './definitions/component-kit';
import { GameEffectEngineController } from './effects/effect-engine';
import type { GameEffectResolverShape } from './effects/effects-kit';
import {
  GameSubmissionController,
  GameSubmissionFlowController,
  GameJudgeController,
  GameVotingController,
} from './submissions/submission-kit';
import {
  GameContextEvents,
  type DomainEvent,
} from './events/game-context-events';
import { GameSchedulerController } from './automation/scheduler-kit';
import type { PhaseConfiguration } from './kits/phase-kit';
import type { PlayerMap } from './game-identifiers';
import { GameContextComponents } from './definitions/game-context-components';

export type { EventDataMap, DomainEvent } from './events/game-context-events';
export type { EngineEventMap } from './events/engine-event-registry';
export type { EventVisibility } from '../../core/application/contracts/game-event.model';

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
  readonly events: GameContextEvents['api'];
  private readonly eventCollector: GameContextEvents;
  readonly turn: GameTurnController<TState>['api'];
  private readonly turnController: GameTurnController<TState>;
  private readonly componentControllers: GameContextComponents<TState>;
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
    next: () => this.turnController.adjacentPlayer(1),
    previous: () => this.turnController.adjacentPlayer(-1),
    after: (playerId: number, offset = 1) =>
      this.turnController.playerAtOffset(playerId, offset),
    before: (playerId: number, offset = 1) =>
      this.turnController.playerAtOffset(playerId, -offset),
    randomOther: (playerId = this.actor?.id ?? null) =>
      this.random.pick(
        (this.runtime.players ?? []).filter((player) => player.id !== playerId),
      ) ?? null,
  };
  readonly phase = {
    current: () => this.runtime.phase,
    is: (phaseId: string) => this.runtime.phase === phaseId,
    transitionTo: (phaseId: string) => this.transitionTo(phaseId),
  };

  get cards(): GameCardsController {
    return this.componentControllers.cards;
  }

  get inventory(): GameInventoryController {
    return this.componentControllers.inventory;
  }

  get economy(): GameEconomyController {
    return this.componentControllers.economy;
  }

  get ownership(): GameOwnershipController {
    return this.componentControllers.ownership;
  }

  get movement(): GameMovementController {
    return this.componentControllers.movement;
  }

  get pawns(): GamePawnController {
    return this.componentControllers.pawns;
  }

  get dice(): GameDiceController {
    return this.componentControllers.dice;
  }

  get grid(): GameGridController {
    return this.componentControllers.grid;
  }

  get quiz(): GameQuizController {
    return this.componentControllers.quiz;
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
    this.eventCollector = new GameContextEvents(this.runtime.log, () =>
      this.clock.nowIso(),
    );
    this.events = this.eventCollector.api;
    this.turnController = new GameTurnController(
      this.runtime,
      this.turnPolicy,
      this.lifecycleHooks,
      () => this,
    );
    this.turn = this.turnController.api;
    const emit = (
      type: string,
      data: Record<string, unknown>,
      visibility?: EventVisibility,
    ) => {
      this.eventCollector.emitDomainEvent(type, data, visibility);
    };
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
          this.turnController.runRoundHook(
            this.lifecycleHooks.onRoundStart,
            roundNumber,
          );
        },
        onEnd: (roundNumber) => {
          this.turnController.runRoundHook(
            this.lifecycleHooks.onRoundEnd,
            roundNumber,
          );
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
    this.componentControllers = new GameContextComponents(
      this.runtime,
      this.execution,
      this.components,
      emit,
      () => this.resources,
      () => this.score,
      (...effects) => this.effects.schedule(...effects),
      () => this.actor?.id ?? this.runtime.turn?.currentPlayerId ?? null,
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
    return this.eventCollector.consume();
  }

  assertValidKits(): void {
    this.componentControllers.assertValid();
  }

  runBeforeCurrentTurnHook(): void {
    this.turnController.runBeforeCurrentTurnHook();
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
}
