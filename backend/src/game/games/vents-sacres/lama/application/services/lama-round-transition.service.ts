import type {
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import type { LamaMetadata } from '../../model/lama.model';
import { createPendingState } from '../../../../../application/services/pending-action.service';
import { LamaLogService } from './lama-log.service';
import { LamaRoundRules } from './lama-round.rules';
import { LamaSharedService } from './lama-shared.service';

export class LamaRoundTransitionService {
  constructor(
    private readonly logger: LamaLogService,
    private readonly shared: LamaSharedService,
    private readonly rules: LamaRoundRules,
  ) {}

  finish(
    state: GameStateEntity,
    startNewRound: (
      state: GameStateEntity,
      starterIndex: number,
    ) => GameStateEntity,
  ): GameStateEntity {
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    const players = Array.isArray(state.players) ? state.players : [];

    const scores = meta.scoresByPlayerId ?? {};
    const loseAt = Number(meta.loseAtScore ?? 40);
    const previousEliminated = meta.eliminatedByPlayerId ?? {};
    const eliminatedByPlayerId = this.rules.buildEliminatedByScore(
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
        `${this.shared.playerLabel(players, pid)} est éliminé${p?.isBot ? '' : '(e)'} (${score} jetons).`,
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
    const starter = this.rules.findNextSurvivorStarterIndex(
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

    return startNewRound(
      { ...state, metadata: updatedMeta, round: nextRound, log },
      starter,
    );
  }
}
