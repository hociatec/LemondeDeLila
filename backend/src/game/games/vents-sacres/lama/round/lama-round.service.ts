import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { LamaCardValue, LamaMetadata } from '../model/lama.model';
import { lamaCardLabel, lamaCardScore, LAMA_VALUE } from '../model/lama.model';
import { RandomService } from '../../../../modules/random/services/random.service';
import { LamaLogService } from '../logging/lama-log.service';

@Injectable()
export class LamaRoundService {
  constructor(
    private readonly random: RandomService,
    private readonly logger: LamaLogService,
  ) {}

  startNewRound(state: GameStateEntity, starterIndex: number): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;

    const baseDeck = this.buildDeck();
    const rngMeta = typeof meta.rng === 'object' && meta.rng ? { ...(meta.rng as any) } : {};
    const shuffled = this.random.shuffle(rngMeta, baseDeck);
    meta.rng = shuffled.meta;
    const deck = shuffled.values as LamaCardValue[];

    const handsByPlayerId: Record<string, LamaCardValue[]> = {};
    const droppedOutByPlayerId: Record<string, boolean> = {};
    for (const p of players) {
      if (!p?.id) continue;
      handsByPlayerId[String(p.id)] = [];
      droppedOutByPlayerId[String(p.id)] = false;
    }

    for (let i = 0; i < 6; i += 1) {
      for (const p of players) {
        if (!p?.id) continue;
        const card = deck.pop();
        if (!card) continue;
        handsByPlayerId[String(p.id)].push(card);
      }
    }

    const firstDiscard = deck.pop() ?? 1;
    const discard: LamaCardValue[] = [firstDiscard as LamaCardValue];

    const starterPlayerId = players[starterIndex]?.id ?? players[0]?.id ?? null;
    const log = this.logger.append(
      state.log,
      `Début de la manche ${meta.roundNumber}. Défausse: ${lamaCardLabel(
        firstDiscard as LamaCardValue,
      )}.`,
    );

    const nextMeta: LamaMetadata & { winnerPlayerId?: number | null } = {
      ...meta,
      deck,
      discard,
      handsByPlayerId,
      droppedOutByPlayerId,
      step: 'turn_choice',
      turnTracker: { playerId: starterPlayerId, drawn: false, played: false },
      endedRoundNumber: null,
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
      winnerId: null,
      winnerPlayerId: null,
      suppressTurnAnnouncement: true,
    };

    return {
      ...state,
      metadata: nextMeta as any,
      log,
      pending: { step: 'turn_choice', playerId: starterPlayerId } as any,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: starterPlayerId,
        direction: 1,
        label: starterPlayerId
          ? `Tour de ${players.find((p) => p?.id === starterPlayerId)?.username ?? `#${starterPlayerId}`}`
          : undefined,
      },
    };
  }

  endRound(state: GameStateEntity, winnerPlayerId: number | null): GameStateEntity {
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    const roundNumber = Number(meta.roundNumber ?? 1);
    if (Number(meta.endedRoundNumber ?? null) === roundNumber) {
      return state;
    }
    const players = Array.isArray(state.players) ? state.players : [];
    const handsByPlayerId = meta.handsByPlayerId ?? {};
    const scoresByPlayerId = { ...(meta.scoresByPlayerId ?? {}) };

    let log = Array.isArray(state.log) ? [...state.log] : [];

    const alreadyLoggedEnd =
      log.some((l) => String((l as any)?.message ?? '') === `Fin de la manche ${roundNumber}.`);
    if (alreadyLoggedEnd) {
      const winnerName =
        winnerPlayerId != null
          ? players.find((p) => p?.id === winnerPlayerId)?.username ?? `#${winnerPlayerId}`
          : null;

      const winnerScore =
        winnerPlayerId != null ? Number(scoresByPlayerId[String(winnerPlayerId)] ?? 0) : 0;
      const eligible =
        this.shouldPromptReturn(roundNumber, winnerScore) ? [winnerPlayerId] : [];

      const nextMeta: LamaMetadata = {
        ...meta,
        scoresByPlayerId,
        endedRoundNumber: roundNumber,
        step: eligible.length ? 'return_token' : 'turn_choice',
        pendingReturnQueue: eligible,
        pendingReturnPlayerId: eligible.length ? eligible[0] : null,
        suppressTurnAnnouncement: true,
      };

      const nextState: GameStateEntity = {
        ...state,
        metadata: nextMeta as any,
        pending: { step: nextMeta.step, playerId: nextMeta.pendingReturnPlayerId ?? null } as any,
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: eligible.length ? eligible[0] : state.turn?.currentPlayerId ?? null,
          direction: 1,
          label: eligible.length
            ? `Rendre des jetons : ${players.find((p) => p?.id === eligible[0])?.username ?? `#${eligible[0]}`}`
            : winnerName
              ? `Fin de manche : ${winnerName}`
              : state.turn?.label,
        },
      };

      if (eligible.length) {
        return nextState;
      }

      return this.finishRoundAndMaybeStartNext(nextState);
    }

    log = this.logger.append(log, `Fin de la manche ${roundNumber}.`);

    for (const p of players) {
      if (!p?.id) continue;
      const pid = p.id;
      const hand = (handsByPlayerId[String(pid)] ?? []) as LamaCardValue[];
      const unique = [...new Set(hand)];
      const gained = unique.reduce((sum, v) => sum + lamaCardScore(v), 0);
      scoresByPlayerId[String(pid)] = Number(scoresByPlayerId[String(pid)] ?? 0) + gained;
      if (gained > 0) {
        log = this.logger.append(
          log,
          `${p.username ?? `#${pid}`} prend ${gained} jeton${gained > 1 ? 's' : ''} (pénalité).`,
        );
      }
    }

    const winnerName =
      winnerPlayerId != null
        ? players.find((p) => p?.id === winnerPlayerId)?.username ?? `#${winnerPlayerId}`
        : null;
    if (winnerName) {
      log = this.logger.append(log, `${winnerName} gagne la manche.`);
    }

    const winnerScore =
      winnerPlayerId != null ? Number(scoresByPlayerId[String(winnerPlayerId)] ?? 0) : 0;
    const eligible =
      this.shouldPromptReturn(roundNumber, winnerScore) ? [winnerPlayerId] : [];
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
      suppressTurnAnnouncement: true,
    };

    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta as any,
      log,
      pending: { step: nextMeta.step, playerId: nextMeta.pendingReturnPlayerId ?? null } as any,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: eligible.length ? eligible[0] : state.turn?.currentPlayerId ?? null,
        direction: 1,
        label: eligible.length
          ? `Rendre des jetons : ${players.find((p) => p?.id === eligible[0])?.username ?? `#${eligible[0]}`}`
          : undefined,
      },
    };

    if (eligible.length) {
      return nextState;
    }

    return this.finishRoundAndMaybeStartNext(nextState);
  }

  finishRoundAndMaybeStartNext(state: GameStateEntity): GameStateEntity {
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    const players = Array.isArray(state.players) ? state.players : [];

    const scores = meta.scoresByPlayerId ?? {};
    const highest = Math.max(0, ...Object.values(scores).map((v) => Number(v ?? 0)));
    const loseAt = Number(meta.loseAtScore ?? 40);
    if (highest >= loseAt) {
      let winnerId: number | null = null;
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
      let log = state.log;
      log = this.logger.append(log, `Partie terminée.`);
      if (winnerId) {
        log = this.logger.append(
          log,
          `Gagnant : ${players.find((p) => p?.id === winnerId)?.username ?? `#${winnerId}`}.`,
        );
      }
      return {
        ...state,
        status: 'finished',
        log,
        metadata: {
          ...meta,
          winnerId,
          winnerPlayerId: winnerId,
        } as any,
      };
    }

    const nextRound = Number(meta.roundNumber ?? 1) + 1;
    const starter = (Number(meta.roundStarterIndex ?? 0) + 1) % Math.max(1, players.length);
    const pauseSeconds = Number(meta.roundPauseSeconds ?? 0);
    const pauseMs = Number.isFinite(pauseSeconds) ? Math.max(0, Math.floor(pauseSeconds) * 1000) : 0;
    const updatedMeta: LamaMetadata & { winnerPlayerId?: number | null } = {
      ...meta,
      roundNumber: nextRound,
      roundStarterIndex: starter,
      endedRoundNumber: null,
      step: pauseMs > 0 ? 'round_pause' : 'turn_choice',
      roundPauseUntilMs: pauseMs > 0 ? Date.now() + pauseMs : null,
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
      winnerId: null,
      winnerPlayerId: null,
      suppressTurnAnnouncement: true,
    };

    if (pauseMs > 0) {
      const log = this.logger.append(
        state.log,
        `Pause ${Math.floor(pauseMs / 1000)}s avant la manche ${nextRound}.`,
      );
      return {
        ...state,
        phase: 'round',
        round: nextRound,
        log,
        metadata: updatedMeta as any,
        pending: { step: 'round_pause', playerId: meta.ownerPlayerId ?? null } as any,
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: meta.ownerPlayerId ?? state.turn?.currentPlayerId ?? null,
          direction: 1,
          label: `Pause avant la manche ${nextRound}`,
        },
      };
    }

    return this.startNewRound({ ...state, metadata: updatedMeta as any, round: nextRound }, starter);
  }

  isRoundEnded(meta: LamaMetadata, players: any[]): boolean {
    const hands = meta.handsByPlayerId ?? {};
    const dropped = meta.droppedOutByPlayerId ?? {};
    const ids = Object.keys(hands);
    if (ids.length === 0) return true;
    const someoneEmpty = ids.some((id) => (hands[id] ?? []).length === 0);
    if (someoneEmpty) return true;

    const active = ids.filter((id) => !dropped[id]);
    if (active.length <= 1) return true;
    const allDropped = active.length === 0;
    if (allDropped) return true;
    return false;
  }

  findNextActivePlayerId(players: any[], meta: LamaMetadata, afterPlayerId: number): number | null {
    const ids = players.map((p) => p?.id).filter((id) => typeof id === 'number') as number[];
    if (!ids.length) return null;
    const start = Math.max(0, ids.indexOf(afterPlayerId));
    const dropped = meta.droppedOutByPlayerId ?? {};
    for (let step = 1; step <= ids.length; step += 1) {
      const pid = ids[(start + step) % ids.length]!;
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

  private findEmptyHandWinnerId(meta: LamaMetadata, players: any[]): number | null {
    const hands = meta.handsByPlayerId ?? {};
    const ids = players.map((p) => p?.id).filter((id) => typeof id === 'number') as number[];
    for (const pid of ids) {
      const hand = (hands[String(pid)] ?? []) as LamaCardValue[];
      if (hand.length === 0) return pid;
    }
    return null;
  }

  private shouldPromptReturn(roundNumber: number, winnerScore: number): boolean {
    if (winnerScore < 1) return false;
    return roundNumber >= 2;
  }
}
