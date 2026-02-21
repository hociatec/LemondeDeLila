import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { LamaCardValue, LamaMetadata } from '../model/lama.model';
import { lamaCardLabel, lamaCardScore, LAMA_VALUE } from '../model/lama.model';
import { RandomService } from '../../../../modules/random/services/random.service';
import { LamaLogService } from '../logging/lama-log.service';
import { LamaSharedService } from '../shared/lama-shared.service';
import { createPendingState } from '../../../../modules/pending-action/services/pending-action.service';

@Injectable()
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

    const baseDeck = this.buildDeck();
    const rngMeta =
      typeof meta.rng === 'object' && meta.rng ? { ...(meta.rng as any) } : {};
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

    for (let i = 0; i < 6; i += 1) {
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
        ? this.shared.playerLabel(players as any[], starterPlayerId)
        : null;
    let log = this.logger.append(
      state.log,
      `Début de la manche ${meta.roundNumber}.`,
    );
    if (starterName) {
      log = this.logger.append(log, `C'est au tour de ${starterName}.`);
    }
    log = this.logger.append(log, `Défausse: ${lamaCardLabel(firstDiscard)}.`);
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

    return createPendingState(
      {
        ...state,
        metadata: nextMeta as any,
        log,
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: starterPlayerId,
          direction: 1,
          label: starterPlayerId
            ? `Tour de ${this.shared.playerLabel(players as any[], starterPlayerId)}`
            : undefined,
        },
      } as GameStateEntity,
      { step: 'turn_choice', playerId: starterPlayerId } as any,
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
      (l) =>
        String((l as any)?.message ?? '') ===
        `Fin de la manche ${roundNumber}.`,
    );
    if (alreadyLoggedEnd) {
      const winnerName =
        winnerPlayerId != null
          ? this.shared.playerLabel(players as any[], winnerPlayerId)
          : null;

      const winnerScore =
        winnerPlayerId != null
          ? Number(scoresByPlayerId[String(winnerPlayerId)] ?? 0)
          : 0;
      const eligible =
        this.shouldPromptReturn(roundNumber, winnerScore) &&
        winnerPlayerId != null
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

      const nextState = createPendingState(
        {
          ...state,
          metadata: nextMeta as any,
          turn: {
            ...(state.turn ?? { direction: 1 }),
            currentPlayerId: eligible.length
              ? eligible[0]
              : (state.turn?.currentPlayerId ?? null),
            direction: 1,
            label: eligible.length
              ? `Rendre des jetons : ${this.shared.playerLabel(players as any[], eligible[0])}`
              : winnerName
                ? `Fin de manche : ${winnerName}`
                : state.turn?.label,
          },
        } as GameStateEntity,
        {
          step: nextMeta.step,
          playerId: nextMeta.pendingReturnPlayerId ?? null,
        } as any,
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
          `${this.shared.playerLabel(players as any[], pid)} prend ${gained} jeton${gained > 1 ? 's' : ''} (pénalité).`,
        );
      }
    }

    const winnerName =
      winnerPlayerId != null
        ? this.shared.playerLabel(players as any[], winnerPlayerId)
        : null;
    if (winnerName) {
      log = this.logger.append(log, `${winnerName} gagne la manche.`);
    }

    const winnerScore =
      winnerPlayerId != null
        ? Number(scoresByPlayerId[String(winnerPlayerId)] ?? 0)
        : 0;
    const eligible =
      this.shouldPromptReturn(roundNumber, winnerScore) &&
      winnerPlayerId != null
        ? [winnerPlayerId]
        : [];
    if (winnerName && eligible.length === 0) {
      log = this.logger.append(log, `${winnerName} n'a rien à rendre.`);
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

    const nextState = createPendingState(
      {
        ...state,
        metadata: nextMeta as any,
        log,
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: eligible.length
            ? eligible[0]
            : (state.turn?.currentPlayerId ?? null),
          direction: 1,
          label: eligible.length
            ? `Rendre des jetons : ${this.shared.playerLabel(players as any[], eligible[0])}`
            : undefined,
        },
      } as GameStateEntity,
      {
        step: nextMeta.step,
        playerId: nextMeta.pendingReturnPlayerId ?? null,
      } as any,
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
        `${this.shared.playerLabel(players as any[], pid)} est éliminé${p?.isBot ? '' : '(e)'} (${score} jetons).`,
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
      log = this.logger.append(log, `Partie terminée.`);
      if (winnerId) {
        log = this.logger.append(
          log,
          `Gagnant : ${this.shared.playerLabel(players as any[], winnerId)}.`,
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
        } as any,
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
      return createPendingState(
        {
          ...state,
          phase: 'round',
          round: nextRound,
          log: pauseLog,
          metadata: updatedMeta as any,
          turn: {
            ...(state.turn ?? { direction: 1 }),
            currentPlayerId:
              meta.ownerPlayerId ?? state.turn?.currentPlayerId ?? null,
            direction: 1,
            label: `Pause avant la manche ${nextRound}`,
          },
        } as GameStateEntity,
        { step: 'round_pause', playerId: meta.ownerPlayerId ?? null } as any,
      );
    }

    return this.startNewRound(
      { ...state, metadata: updatedMeta as any, round: nextRound, log },
      starter,
    );
  }

  isRoundEnded(meta: LamaMetadata, _players: any[]): boolean {
    const hands = meta.handsByPlayerId ?? {};
    const dropped = meta.droppedOutByPlayerId ?? {};
    const ids = Object.keys(hands);
    if (ids.length === 0) return true;
    const someoneEmpty = ids.some((id) => (hands[id] ?? []).length === 0);
    if (someoneEmpty) return true;

    const active = ids.filter((id) => !dropped[id]);
    // Continue the round while the last active player can still act.
    // End only when everyone has dropped out (or someone emptied their hand above).
    if (active.length === 0) return true;
    return false;
  }

  findNextActivePlayerId(
    players: any[],
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

  findRoundWinnerId(meta: LamaMetadata, players: any[]): number | null {
    const empty = this.findEmptyHandWinnerId(meta, players);
    if (empty != null) return empty;

    const hands = meta.handsByPlayerId ?? {};
    const dropped = meta.droppedOutByPlayerId ?? {};
    const ids = Object.keys(hands);
    const active = ids.filter((id) => !dropped[id]);
    if (active.length === 1) return Number(active[0]);
    return null;
  }

  private buildDeck(): LamaCardValue[] {
    const deck: LamaCardValue[] = [];
    for (const v of [1, 2, 3, 4, 5, 6, LAMA_VALUE] as LamaCardValue[]) {
      for (let i = 0; i < 8; i += 1) deck.push(v);
    }
    return deck;
  }

  private findEmptyHandWinnerId(
    meta: LamaMetadata,
    players: any[],
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
  ): boolean {
    if (winnerScore < 1) return false;
    return roundNumber >= 2;
  }

  private buildEliminatedByScore(
    players: any[],
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
    players: any[],
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
