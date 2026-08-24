import type {
  GameLogEntry,
  GameStateEntity,
  PendingState,
  PlayerStateEntity,
} from '../../../../../application/models/game-state.model';
import type { LamaCardValue, LamaMetadata } from '../../model/lama.model';
import { lamaCardLabel, lamaCardScore, LAMA_VALUE } from '../../model/lama.model';
import { RandomService } from '../../../../../application/services/random.service';
import { LamaLogService } from './lama-log.service';
import { LamaSharedService } from './lama-shared.service';
import { createPendingState } from '../../../../../application/services/pending-action.service';

export class LamaRoundService {
  constructor(
    private readonly random: RandomService,
    private readonly logger: LamaLogService,
    private readonly shared: LamaSharedService,
  ) {}

  startNewRound(state: GameStateEntity, starterIndex: number): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    const scores = meta.scoresByPlayerId ?? {};
    const loseAt = Number(meta.loseAtScore ?? 40);
    const eliminatedByPlayerId = this.buildEliminatedByScore(
      players,
      scores,
      loseAt,
      meta.eliminatedByPlayerId ?? {},
    );
    const roundPlayers = players.filter(
      (p) => p?.id && !eliminatedByPlayerId[String(p.id)],
    );
    if (roundPlayers.length === 0) {
      return state;
    }

    const startingHandSize = this.resolveStartingHandSize(
      meta.startingHandSize,
    );
    const copiesPerCardValue = this.resolveCopiesPerCardValue(
      meta.copiesPerCardValue,
    );
    const baseDeck = this.buildDeck(copiesPerCardValue);
    const rngMeta =
      typeof meta.rng === 'object' && meta.rng ? { ...meta.rng } : {};
    const shuffled = this.random.shuffle(rngMeta, baseDeck);
    meta.rng = shuffled.meta;
    const deck = shuffled.values;

    const handsByPlayerId: Record<string, LamaCardValue[]> = {};
    const droppedOutByPlayerId: Record<string, boolean> = {};
    for (const p of players) {
      if (!p?.id) continue;
      if (!eliminatedByPlayerId[String(p.id)]) {
        handsByPlayerId[String(p.id)] = [];
      }
      droppedOutByPlayerId[String(p.id)] = Boolean(
        eliminatedByPlayerId[String(p.id)],
      );
    }

    for (let i = 0; i < startingHandSize; i += 1) {
      for (const p of roundPlayers) {
        if (!p?.id) continue;
        const card = deck.pop();
        if (!card) continue;
        handsByPlayerId[String(p.id)].push(card);
      }
    }

    const firstDiscard = deck.pop() ?? 1;
    const discard: LamaCardValue[] = [firstDiscard];

    const normalizedStarterIndex = this.findNextSurvivorStarterIndex(
      players,
      eliminatedByPlayerId,
      Math.max(-1, starterIndex - 1),
    );
    const starterPlayerId =
      players[normalizedStarterIndex]?.id ?? roundPlayers[0]?.id ?? null;
    const starterName =
      starterPlayerId != null
        ? this.shared.playerLabel(players, starterPlayerId)
        : null;
    let log = this.logger.append(
      state.log,
      `DÃ©but de la manche ${meta.roundNumber}.`,
    );
    if (starterName) {
      log = this.logger.append(log, `C'est au tour de ${starterName}.`);
    }
    log = this.logger.append(log, `DÃ©fausse: ${lamaCardLabel(firstDiscard)}.`);
    const nextMeta: LamaMetadata & { winnerPlayerId?: number | null } = {
      ...meta,
      roundStarterIndex: normalizedStarterIndex,
      deck,
      discard,
      handsByPlayerId,
      droppedOutByPlayerId,
      eliminatedByPlayerId,
      step: 'turn_choice',
      turnTracker: { playerId: starterPlayerId, drawn: false, played: false },
      endedRoundNumber: null,
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
      winnerId: null,
      winnerPlayerId: null,
      suppressTurnAnnouncement: false,
    };

    const nextPending: PendingState = {
      step: 'turn_choice',
      playerId: starterPlayerId,
    };
    return createPendingState(
      {
        ...state,
        metadata: nextMeta,
        log,
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: starterPlayerId,
          direction: 1,
          label: starterPlayerId
            ? `Tour de ${this.shared.playerLabel(players, starterPlayerId)}`
            : undefined,
        },
      },
      nextPending,
    );
  }

  endRound(
    state: GameStateEntity,
    winnerPlayerId: number | null,
  ): GameStateEntity {
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    const roundNumber = Number(meta.roundNumber ?? 1);
    if (Number(meta.endedRoundNumber ?? null) === roundNumber) {
      return state;
    }
    const players = Array.isArray(state.players) ? state.players : [];
    const handsByPlayerId = meta.handsByPlayerId ?? {};
    const scoresByPlayerId = { ...(meta.scoresByPlayerId ?? {}) };

    let log = Array.isArray(state.log) ? [...state.log] : [];

    const alreadyLoggedEnd = log.some(
      (l: GameLogEntry) =>
        String(l.message ?? '') === `Fin de la manche ${roundNumber}.`,
    );
    if (alreadyLoggedEnd) {
      const winnerName =
        winnerPlayerId != null
          ? this.shared.playerLabel(players, winnerPlayerId)
          : null;

      const winnerScore =
        winnerPlayerId != null
          ? Number(scoresByPlayerId[String(winnerPlayerId)] ?? 0)
          : 0;
      const eligible =
        this.shouldPromptReturn(
          roundNumber,
          winnerScore,
          meta.returnTokenFromRound,
        ) && winnerPlayerId != null
          ? [winnerPlayerId]
          : [];

      const nextMeta: LamaMetadata = {
        ...meta,
        scoresByPlayerId,
        endedRoundNumber: roundNumber,
        step: eligible.length ? 'return_token' : 'turn_choice',
        pendingReturnQueue: eligible,
        pendingReturnPlayerId: eligible.length ? eligible[0] : null,
        suppressTurnAnnouncement: false,
      };

      const nextPending: PendingState = {
        step: nextMeta.step,
        playerId: nextMeta.pendingReturnPlayerId ?? null,
      };
      const nextState = createPendingState(
        {
          ...state,
          metadata: nextMeta,
          turn: {
            ...(state.turn ?? { direction: 1 }),
            currentPlayerId: eligible.length
              ? eligible[0]
              : (state.turn?.currentPlayerId ?? null),
            direction: 1,
            label: eligible.length
              ? `Rendre des jetons : ${this.shared.playerLabel(players, eligible[0])}`
              : winnerName
                ? `Fin de manche : ${winnerName}`
                : state.turn?.label,
          },
        },
        nextPending,
      );

      if (eligible.length) {
        return nextState;
      }

      return this.finishRoundAndMaybeStartNext(nextState);
    }

    log = this.logger.append(log, `Fin de la manche ${roundNumber}.`);

    for (const p of players) {
      if (!p?.id) continue;
      const pid = p.id;
      const hand = handsByPlayerId[String(pid)] ?? [];
      const unique = [...new Set(hand)];
      const gained = unique.reduce((sum, v) => sum + lamaCardScore(v), 0);
      scoresByPlayerId[String(pid)] =
        Number(scoresByPlayerId[String(pid)] ?? 0) + gained;
      if (gained > 0) {
        log = this.logger.append(
          log,
          `${this.shared.playerLabel(players as PlayerStateEntity[], pid)} prend ${gained} jeton${gained > 1 ? 's' : ''} (pÃ©nalitÃ©).`,
        );
      }
    }

    const winnerName =
      winnerPlayerId != null
        ? this.shared.playerLabel(players as PlayerStateEntity[], winnerPlayerId)
        : null;
    if (winnerName) {
      log = this.logger.append(log, `${winnerName} gagne la manche.`);
    }

    const winnerScore =
      winnerPlayerId != null
        ? Number(scoresByPlayerId[String(winnerPlayerId)] ?? 0)
        : 0;
    const eligible =
      this.shouldPromptReturn(
        roundNumber,
        winnerScore,
        meta.returnTokenFromRound,
      ) && winnerPlayerId != null
        ? [winnerPlayerId]
        : [];
    if (winnerName && eligible.length === 0) {
      log = this.logger.append(log, `${winnerName} n'a rien Ã  rendre.`);
    }
    const nextMeta: LamaMetadata = {
      ...meta,
      scoresByPlayerId,
      endedRoundNumber: roundNumber,
      step: eligible.length ? 'return_token' : 'turn_choice',
      pendingReturnQueue: eligible,
      pendingReturnPlayerId: eligible.length ? eligible[0] : null,
      suppressTurnAnnouncement: false,
    };

    const nextPending: PendingState = {
      step: nextMeta.step,
      playerId: nextMeta.pendingReturnPlayerId ?? null,
    };
    const nextState = createPendingState(
      {
        ...state,
        metadata: nextMeta,
        log,
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: eligible.length
            ? eligible[0]
            : (state.turn?.currentPlayerId ?? null),
          direction: 1,
          label: eligible.length
            ? `Rendre des jetons : ${this.shared.playerLabel(players, eligible[0])}`
            : undefined,
        },
      },
      nextPending,
    );

    if (eligible.length) {
      return nextState;
    }

    return this.finishRoundAndMaybeStartNext(nextState);
  }

  finishRoundAndMaybeStartNext(state: GameStateEntity): GameStateEntity {
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    const players = Array.isArray(state.players) ? state.players : [];

    const scores = meta.scoresByPlayerId ?? {};
    const loseAt = Number(meta.loseAtScore ?? 40);
    const previousEliminated = meta.eliminatedByPlayerId ?? {};
    const eliminatedByPlayerId = this.buildEliminatedByScore(
      players,
      scores,
      loseAt,
      previousEliminated,
    );
    const newlyEliminated = players.filter(
      (p) =>
        p?.id &&
        !previousEliminated[String(p.id)] &&
        eliminatedByPlayerId[String(p.id)],
    );
    const survivors = players.filter(
      (p) => p?.id && !eliminatedByPlayerId[String(p.id)],
    );

    let log = state.log;
    for (const p of newlyEliminated) {
      const pid = p.id;
      const score = Number(scores[String(pid)] ?? 0);
      log = this.logger.append(
        log,
        `${this.shared.playerLabel(players as PlayerStateEntity[], pid)} est Ã©liminÃ©${p?.isBot ? '' : '(e)'} (${score} jetons).`,
      );
    }

    if (survivors.length <= 1) {
      let winnerId: number | null = null;
      if (survivors.length === 1) {
        winnerId = survivors[0]?.id ?? null;
      } else {
        let best = Number.POSITIVE_INFINITY;
        for (const p of players) {
          const pid = p?.id;
          if (!pid) continue;
          const s = Number(scores[String(pid)] ?? 0);
          if (s < best) {
            best = s;
            winnerId = pid;
          }
        }
      }
      log = this.logger.append(log, `Partie terminÃ©e.`);
      if (winnerId) {
        log = this.logger.append(
          log,
          `Gagnant : ${this.shared.playerLabel(players, winnerId)}.`,
        );
      }
      return {
        ...state,
        status: 'finished',
        log,
        metadata: {
          ...meta,
          eliminatedByPlayerId,
          winnerId,
          winnerPlayerId: winnerId,
        },
      };
    }

    const nextRound = Number(meta.roundNumber ?? 1) + 1;
    const starter = this.findNextSurvivorStarterIndex(
      players,
      eliminatedByPlayerId,
      Number(meta.roundStarterIndex ?? 0),
    );
    const pauseSeconds = Number(meta.roundPauseSeconds ?? 0);
    const pauseMs = Number.isFinite(pauseSeconds)
      ? Math.max(0, Math.floor(pauseSeconds) * 1000)
      : 0;
    const updatedMeta: LamaMetadata & { winnerPlayerId?: number | null } = {
      ...meta,
      roundNumber: nextRound,
      roundStarterIndex: starter,
      endedRoundNumber: null,
      step: pauseMs > 0 ? 'round_pause' : 'turn_choice',
      roundPauseUntilMs: pauseMs > 0 ? Date.now() + pauseMs : null,
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
      eliminatedByPlayerId,
      winnerId: null,
      winnerPlayerId: null,
      suppressTurnAnnouncement: false,
    };

    if (pauseMs > 0) {
      const pauseLog = this.logger.append(
        log,
        `Pause ${Math.floor(pauseMs / 1000)}s avant la manche ${nextRound}.`,
      );
      const nextPending: PendingState = {
        step: 'round_pause',
        playerId: meta.ownerPlayerId ?? null,
      };
      return createPendingState(
        {
          ...state,
          phase: 'round',
          round: nextRound,
          log: pauseLog,
          metadata: updatedMeta,
          turn: {
            ...(state.turn ?? { direction: 1 }),
            currentPlayerId:
              meta.ownerPlayerId ?? state.turn?.currentPlayerId ?? null,
            direction: 1,
            label: `Pause avant la manche ${nextRound}`,
          },
        },
        nextPending,
      );
    }

    return this.startNewRound(
      { ...state, metadata: updatedMeta, round: nextRound, log },
      starter,
    );
  }

  isRoundEnded(meta: LamaMetadata, _players: PlayerStateEntity[]): boolean {
    const hands = meta.handsByPlayerId ?? {};
    const dropped = meta.droppedOutByPlayerId ?? {};
    const ids = Object.keys(hands);
    if (ids.length === 0) return true;
    const someoneEmpty = ids.some((id) => (hands[id] ?? []).length === 0);
    if (someoneEmpty) return true;

    const active = ids.filter((id) => !dropped[id]);
    if (active.length === 0) return true;
    return false;
  }

  findNextActivePlayerId(
    players: PlayerStateEntity[],
    meta: LamaMetadata,
    afterPlayerId: number,
  ): number | null {
    const ids = players
      .map((p) => p?.id)
      .filter((id) => typeof id === 'number');
    if (!ids.length) return null;
    const start = Math.max(0, ids.indexOf(afterPlayerId));
    const dropped = meta.droppedOutByPlayerId ?? {};
    for (let step = 1; step <= ids.length; step += 1) {
      const pid = ids[(start + step) % ids.length];
      if (!dropped[String(pid)]) return pid;
    }
    return ids[start] ?? null;
  }

  findRoundWinnerId(
    meta: LamaMetadata,
    players: PlayerStateEntity[],
  ): number | null {
    const empty = this.findEmptyHandWinnerId(meta, players);
    if (empty != null) return empty;

    const hands = meta.handsByPlayerId ?? {};
    const dropped = meta.droppedOutByPlayerId ?? {};
    const ids = Object.keys(hands);
    const active = ids.filter((id) => !dropped[id]);
    if (active.length === 1) return Number(active[0]);
    return null;
  }

  private buildDeck(copiesPerCardValue: number): LamaCardValue[] {
    const deck: LamaCardValue[] = [];
    for (const v of [1, 2, 3, 4, 5, 6, LAMA_VALUE] as LamaCardValue[]) {
      for (let i = 0; i < copiesPerCardValue; i += 1) deck.push(v);
    }
    return deck;
  }

  private findEmptyHandWinnerId(
    meta: LamaMetadata,
    players: PlayerStateEntity[],
  ): number | null {
    const hands = meta.handsByPlayerId ?? {};
    const ids = players
      .map((p) => p?.id)
      .filter((id) => typeof id === 'number');
    for (const pid of ids) {
      const hand = hands[String(pid)] ?? [];
      if (hand.length === 0) return pid;
    }
    return null;
  }

  private shouldPromptReturn(
    roundNumber: number,
    winnerScore: number,
    returnTokenFromRound: number | null | undefined,
  ): boolean {
    if (winnerScore < 1) return false;
    return (
      roundNumber >= this.resolveReturnTokenFromRound(returnTokenFromRound)
    );
  }

  private resolveStartingHandSize(value: number | null | undefined): number {
    const parsed = Number(value ?? 6);
    if (!Number.isFinite(parsed)) return 6;
    const rounded = Math.floor(parsed);
    if (rounded < 1 || rounded > 20) return 6;
    return rounded;
  }

  private resolveCopiesPerCardValue(value: number | null | undefined): number {
    const parsed = Number(value ?? 8);
    if (!Number.isFinite(parsed)) return 8;
    const rounded = Math.floor(parsed);
    if (rounded < 1 || rounded > 20) return 8;
    return rounded;
  }

  private resolveReturnTokenFromRound(
    value: number | null | undefined,
  ): number {
    const parsed = Number(value ?? 2);
    if (!Number.isFinite(parsed)) return 2;
    const rounded = Math.floor(parsed);
    if (rounded < 1 || rounded > 50) return 2;
    return rounded;
  }

  private buildEliminatedByScore(
    players: PlayerStateEntity[],
    scoresByPlayerId: Record<string, number>,
    loseAtScore: number,
    previous: Record<string, boolean>,
  ): Record<string, boolean> {
    const out: Record<string, boolean> = { ...(previous ?? {}) };
    for (const p of players) {
      const pid = p?.id;
      if (!pid) continue;
      const score = Number(scoresByPlayerId[String(pid)] ?? 0);
      out[String(pid)] = score >= loseAtScore;
    }
    return out;
  }

  private findNextSurvivorStarterIndex(
    players: PlayerStateEntity[],
    eliminatedByPlayerId: Record<string, boolean>,
    afterIndex: number,
  ): number {
    if (!Array.isArray(players) || players.length === 0) {
      return 0;
    }

    const length = players.length;
    const start = Number.isFinite(afterIndex) ? afterIndex : -1;
    for (let step = 1; step <= length; step += 1) {
      const idx = (((start + step) % length) + length) % length;
      const pid = players[idx]?.id;
      if (!pid) continue;
      if (!eliminatedByPlayerId[String(pid)]) {
        return idx;
      }
    }

    return 0;
  }
}
