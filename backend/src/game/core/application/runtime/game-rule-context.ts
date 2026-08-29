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
import { GameTurnController } from './game-turn-controller';
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
import { GameRuleViolationError } from '../../domain/errors/game-domain.errors';
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
import { GameContextEvents, type DomainEvent } from './game-context-events';
import { GameSchedulerController } from './scheduler-kit';
import type { PhaseConfiguration } from './phase-kit';
import type { PlayerMap } from './game-identifiers';

export type { EventDataMap, DomainEvent } from './game-context-events';
export type { EngineEventMap } from './engine-event-registry';
export type { EventVisibility } from '../models/game-event.model';

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
