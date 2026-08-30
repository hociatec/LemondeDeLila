import type { DeclarativeState } from '../definitions/game-definition';
import type { TurnPolicy } from '../kits/turn-kit';

type TurnState<TState extends object> = NonNullable<
  DeclarativeState<TState>['turn']
>;

type TurnScheduleCallbacks = {
  hasPlayer(playerId: number): boolean;
  reject(
    code: string,
    details: Readonly<Record<string, unknown>>,
    message: string,
  ): never;
  onSkipped(playerId: number): void;
  onReplaced(slotOwnerId: number, replacementPlayerId: number): void;
};

/** Manages deferred skips, extra turns and replacements independently of hooks. */
export class GameTurnSchedule<TState extends object> {
  constructor(
    private readonly runtime: DeclarativeState<TState>,
    private readonly turnPolicy: TurnPolicy,
    private readonly callbacks: TurnScheduleCallbacks,
  ) {}

  addExtra(count: number, playerId?: number): void {
    const targetId = playerId ?? this.runtime.turn?.currentPlayerId;
    if (targetId == null) return;
    this.assertPlayer(targetId);
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

  extraCount(playerId?: number): number {
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

  clearExtra(playerId?: number): void {
    const targetId = playerId ?? this.runtime.turn?.currentPlayerId;
    if (targetId == null) return;
    if (targetId === this.runtime.turn?.currentPlayerId && this.runtime.turn) {
      this.runtime.turn.extraTurns = 0;
    }
    this.runtime.engine.playerValues.scheduledExtraTurns ??= {};
    this.runtime.engine.playerValues.scheduledExtraTurns[String(targetId)] = 0;
  }

  consumeExtra(turn: TurnState<TState>, playerId: number | null): boolean {
    const key = String(playerId ?? '');
    const scheduled =
      this.runtime.engine.playerValues.scheduledExtraTurns?.[key] ?? 0;
    if ((turn.extraTurns ?? 0) <= 0 && scheduled <= 0) return false;
    if ((turn.extraTurns ?? 0) > 0) {
      turn.extraTurns = Math.max(0, (turn.extraTurns ?? 0) - 1);
    } else {
      this.runtime.engine.playerValues.scheduledExtraTurns ??= {};
      this.runtime.engine.playerValues.scheduledExtraTurns[key] = scheduled - 1;
    }
    return true;
  }

  replace(playerId: number, replacementId: number): void {
    this.assertPlayer(playerId);
    this.assertPlayer(replacementId);
    const turn = this.runtime.turn ?? this.turnPolicy.initialize([]);
    (turn.scheduledTurnReplacements ??= {})[String(playerId)] = replacementId;
    this.runtime.turn = turn;
  }

  applyReplacement(turn: TurnState<TState>): void {
    if (turn.replacedSlotOwnerId != null || turn.currentPlayerId == null)
      return;
    const key = String(turn.currentPlayerId);
    const replacementId = turn.scheduledTurnReplacements?.[key];
    if (replacementId == null) return;
    delete turn.scheduledTurnReplacements?.[key];
    turn.replacedSlotOwnerId = turn.currentPlayerId;
    turn.currentPlayerId = replacementId;
    this.callbacks.onReplaced(turn.replacedSlotOwnerId, replacementId);
  }

  skip(playerId: number, count: number): void {
    this.assertPlayer(playerId);
    const key = String(playerId);
    this.runtime.engine.playerValues.scheduledSkips[key] =
      (this.runtime.engine.playerValues.scheduledSkips[key] ?? 0) +
      Math.max(1, Math.floor(count));
  }

  cancelSkip(playerId: number, count: number): number {
    const key = String(playerId);
    const remaining = Math.max(
      0,
      (this.runtime.engine.playerValues.scheduledSkips[key] ?? 0) -
        Math.max(1, Math.floor(count)),
    );
    this.runtime.engine.playerValues.scheduledSkips[key] = remaining;
    return remaining;
  }

  advancePastSkipped(turn: TurnState<TState>): TurnState<TState> {
    let next = turn;
    for (
      let checked = 0;
      checked < (this.runtime.players?.length ?? 0);
      checked += 1
    ) {
      const playerId = next.currentPlayerId;
      if (playerId == null) break;
      const remaining =
        this.runtime.engine.playerValues.scheduledSkips[String(playerId)] ?? 0;
      if (remaining <= 0) break;
      this.runtime.engine.playerValues.scheduledSkips[String(playerId)] =
        remaining - 1;
      this.callbacks.onSkipped(playerId);
      next = this.turnPolicy.advance(next, this.runtime.players ?? []);
    }
    return next;
  }

  private assertPlayer(playerId: number): void {
    if (this.callbacks.hasPlayer(playerId)) return;
    this.callbacks.reject(
      'UNKNOWN_PLAYER',
      { playerId },
      'Joueur absent de la partie',
    );
  }
}
