import type { PlayerStateEntity } from '../models/game-state.model';
import type { DeclarativeState } from './game-definition';
import type { GameLifecycleHooks } from './game-lifecycle-hooks';
import type { GameContext } from './game-rule-context';
import type { TurnPolicy } from './turn-kit';

export class GameTurnController<TState extends object> {
  constructor(
    private readonly runtime: DeclarativeState<TState>,
    private readonly turnPolicy: TurnPolicy,
    private readonly lifecycleHooks: GameLifecycleHooks<TState>,
    private readonly contextProvider: () => GameContext<TState>,
  ) {}

  readonly api = {
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

  private get context(): GameContext<TState> {
    return this.contextProvider();
  }

  private get status() {
    return this.context.status;
  }
  private get effects() {
    return this.context.effects;
  }
  private get events() {
    return this.context.events;
  }
  private get players() {
    return this.context.players;
  }
  private get submissions() {
    return this.context.submissions;
  }
  private get match() {
    return this.context.match;
  }
  private readonly reject = (
    code: string,
    details: Readonly<Record<string, unknown>> = {},
    message?: string,
  ): never => this.context.reject(code, details, message);

  runBeforeCurrentTurnHook(): void {
    if (this.runtime.engine.match.status !== 'playing') return;
    this.runTurnHook(
      this.lifecycleHooks.beforeTurn,
      this.runtime.turn?.currentPlayerId ?? null,
    );
  }

  completeTurn(options: { waiting?: boolean }): boolean {
    if (
      options.waiting === true ||
      this.runtime.engine.match.status === 'finished' ||
      this.runtime.pending != null ||
      this.context.effects.isResolving()
    ) {
      return false;
    }
    this.endTurn();
    return true;
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

  readonly adjacentPlayer = (offset: 1 | -1): PlayerStateEntity | null => {
    const players = this.match.activePlayers();
    if (players.length === 0) return null;
    const currentId = this.runtime.turn?.currentPlayerId;
    const currentIndex = players.findIndex((player) => player.id === currentId);
    const direction = (this.runtime.turn?.direction ?? 1) * offset;
    const index =
      (Math.max(0, currentIndex) + direction + players.length) % players.length;
    return players[index] ?? null;
  };

  readonly playerAtOffset = (
    playerId: number,
    offset: number,
  ): PlayerStateEntity | null => {
    const players = this.runtime.players ?? [];
    if (players.length === 0) return null;
    const index = players.findIndex((player) => player.id === playerId);
    if (index < 0) return null;
    const normalized =
      (((index + Math.trunc(offset)) % players.length) + players.length) %
      players.length;
    return players[normalized] ?? null;
  };

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
    hook({ state: this.runtime.game, player, ctx: this.context });
  }

  readonly runRoundHook = (
    hook: GameLifecycleHooks<TState>['onRoundStart'],
    roundNumber: number,
  ): void => {
    if (!hook) return;
    hook({ state: this.runtime.game, roundNumber, ctx: this.context });
  };
}
