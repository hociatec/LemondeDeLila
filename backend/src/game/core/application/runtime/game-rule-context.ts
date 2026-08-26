import type { GameExecutionContext } from '../models/game-execution-context.model';
import type { PlayerStateEntity } from '../models/game-state.model';
import { GameCardsController } from './cards-kit';
import type { DeclarativeState } from './game-definition';
import { GameChoiceController } from './game-choice-controller';
import { GameMovementController } from './movement-kit';
import type { TurnPolicy } from './turn-kit';
import { GameDiceController } from './dice-kit';
import { GameGridController } from './grid-kit';
import { GameQuizController } from './quiz-kit';

export type DomainEvent = {
  type: string;
  data: Record<string, unknown>;
};

export class GameRuleContext<TState extends object> {
  readonly random: GameExecutionContext['rng'];
  readonly clock: GameExecutionContext['clock'];
  readonly cards: GameCardsController;
  readonly movement: GameMovementController;
  readonly dice: GameDiceController;
  readonly grid: GameGridController;
  readonly quiz: GameQuizController;
  readonly choice: GameChoiceController;
  readonly effects = {
    emit: (type: string, data: Record<string, unknown> = {}) =>
      this.effectsBuffer.push({ type, data }),
  };
  readonly events = {
    emit: (type: string, data: Record<string, unknown> = {}) =>
      this.eventsBuffer.push({ type, data }),
  };
  readonly history = {
    add: (message: string) => {
      const normalized = message.trim();
      if (!normalized) return;
      this.runtime.log.push({
        message: normalized,
        timestamp: this.clock.nowIso(),
      });
    },
  };
  readonly players = {
    all: () => [...(this.runtime.players ?? [])],
    get: (playerId: number) =>
      this.runtime.players?.find((player) => player.id === playerId) ?? null,
    current: () =>
      this.runtime.players?.find(
        (player) => player.id === this.runtime.turn?.currentPlayerId,
      ) ?? null,
  };
  readonly turn = {
    is: (playerId: number) => this.runtime.turn?.currentPlayerId === playerId,
    end: () => this.endTurn(),
    reverse: () => this.reverseTurn(),
    skip: () => this.skipNextPlayer(),
    extra: () => this.addExtraTurn(),
    spend: (points = 1) => this.spendActionPoints(points),
    remaining: () => this.runtime.turn?.actionPointsRemaining ?? null,
    to: (playerId: number) => this.moveTurnTo(playerId),
  };
  private readonly eventsBuffer: DomainEvent[] = [];
  private readonly effectsBuffer: DomainEvent[] = [];

  constructor(
    private readonly runtime: DeclarativeState<TState>,
    readonly actor: PlayerStateEntity | null,
    private readonly execution: GameExecutionContext,
    private readonly turnPolicy: TurnPolicy,
  ) {
    this.random = execution.rng;
    this.clock = execution.clock;
    const kits = this.runtime.engine.kits;
    this.cards = new GameCardsController(kits.cards, this.execution.rng);
    this.movement = new GameMovementController(kits.movement);
    this.dice = new GameDiceController(kits.dice, this.execution.rng);
    this.grid = new GameGridController(kits.grid);
    this.quiz = new GameQuizController(kits.quiz, this.execution.rng);
    this.choice = new GameChoiceController(
      () => this.runtime.pending,
      (pending) => {
        this.runtime.pending = pending;
        this.runtime.engine.pending = pending;
      },
      () => this.clock.nowMs(),
    );
  }

  get state(): TState {
    return this.runtime.game;
  }

  replaceState(state: TState): void {
    this.runtime.game = state;
  }

  phase(): string {
    return this.runtime.phase;
  }

  transitionTo(phase: string): void {
    this.runtime.phase = phase;
    this.runtime.engine.phase = phase;
  }

  consumeEvents(): DomainEvent[] {
    return this.eventsBuffer.splice(0);
  }

  consumeEffects(): DomainEvent[] {
    return this.effectsBuffer.splice(0);
  }

  private endTurn(): void {
    const current = this.runtime.turn ?? this.turnPolicy.initialize([]);
    if ((current.extraTurns ?? 0) > 0) {
      current.extraTurns = Math.max(0, (current.extraTurns ?? 0) - 1);
      current.turnNumber = (current.turnNumber ?? 1) + 1;
      this.resetActionPoints(current);
      this.runtime.turn = current;
      this.runtime.engine.turn = current;
      return;
    }
    const nextTurn = this.turnPolicy.advance(
      current,
      this.runtime.players ?? [],
    );
    this.runtime.turn = nextTurn;
    this.runtime.engine.turn = nextTurn;
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

  private addExtraTurn(): void {
    if (!this.runtime.turn) return;
    this.runtime.turn.extraTurns = (this.runtime.turn.extraTurns ?? 0) + 1;
  }

  private spendActionPoints(points: number): number {
    if (this.turnPolicy.kind !== 'action-points' || !this.runtime.turn) {
      throw new Error('Cette partie n’utilise pas de points d’action');
    }
    const amount = Math.max(1, Math.floor(points));
    const remaining = this.runtime.turn.actionPointsRemaining ?? 0;
    if (amount > remaining) throw new Error('Points d’action insuffisants');
    this.runtime.turn.actionPointsRemaining = remaining - amount;
    if (this.runtime.turn.actionPointsRemaining === 0) this.endTurn();
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
    this.runtime.engine.turn = this.runtime.turn;
  }

  private moveTurnTo(playerId: number): void {
    if (
      !(this.runtime.players ?? []).some((player) => player.id === playerId)
    ) {
      throw new Error(`Joueur absent de la partie: ${playerId}`);
    }
    const turn = this.runtime.turn ?? this.turnPolicy.initialize([]);
    turn.currentPlayerId = playerId;
    this.runtime.turn = turn;
    this.runtime.engine.turn = turn;
  }
}
