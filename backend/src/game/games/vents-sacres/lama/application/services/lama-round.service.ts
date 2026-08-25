import type {
  GameLogEntry,
  GameStateEntity,
  PendingState,
  PlayerStateEntity,
} from '../../../../../core/application/models/game-state.model';
import type { LamaMetadata } from '../../model/lama.model';
import { lamaCardScore } from '../../model/lama.model';
import { RandomService } from '../../../../../core/application/services/random.service';
import { LamaLogService } from './lama-log.service';
import { LamaSharedService } from './lama-shared.service';
import { LamaRoundDealer } from './lama-round.dealer';
import { LamaRoundRules } from './lama-round.rules';
import { LamaRoundTransitionService } from './lama-round-transition.service';
import { createPendingState } from '../../../../../core/application/services/pending-action.service';

export class LamaRoundService {
  constructor(
    random: RandomService,
    private readonly logger: LamaLogService,
    private readonly shared: LamaSharedService,
  ) {
    this.rules = new LamaRoundRules();
    this.dealer = new LamaRoundDealer(random, logger, shared, this.rules);
    this.transition = new LamaRoundTransitionService(
      logger,
      shared,
      this.rules,
    );
  }

  private readonly rules: LamaRoundRules;
  private readonly dealer: LamaRoundDealer;
  private readonly transition: LamaRoundTransitionService;

  startNewRound(state: GameStateEntity, starterIndex: number): GameStateEntity {
    return this.dealer.start(state, starterIndex);
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
        this.rules.shouldPromptReturn(
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
          `${this.shared.playerLabel(players, pid)} prend ${gained} jeton${gained > 1 ? 's' : ''} (pénalité).`,
        );
      }
    }

    const winnerName =
      winnerPlayerId != null
        ? this.shared.playerLabel(players, winnerPlayerId)
        : null;
    if (winnerName) {
      log = this.logger.append(log, `${winnerName} gagne la manche.`);
    }

    const winnerScore =
      winnerPlayerId != null
        ? Number(scoresByPlayerId[String(winnerPlayerId)] ?? 0)
        : 0;
    const eligible =
      this.rules.shouldPromptReturn(
        roundNumber,
        winnerScore,
        meta.returnTokenFromRound,
      ) && winnerPlayerId != null
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
    return this.transition.finish(state, (nextState, starterIndex) =>
      this.startNewRound(nextState, starterIndex),
    );
  }

  isRoundEnded(meta: LamaMetadata, players: PlayerStateEntity[]): boolean {
    return this.rules.isRoundEnded(meta, players);
  }

  findNextActivePlayerId(
    players: PlayerStateEntity[],
    meta: LamaMetadata,
    afterPlayerId: number,
  ): number | null {
    return this.rules.findNextActivePlayerId(players, meta, afterPlayerId);
  }

  findRoundWinnerId(
    meta: LamaMetadata,
    players: PlayerStateEntity[],
  ): number | null {
    return this.rules.findRoundWinnerId(meta, players);
  }
}
