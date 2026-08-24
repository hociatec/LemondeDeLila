import type {
  GameLogEntry,
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import type { LamaMetadata } from '../../model/lama.model';
import { LamaRoundService } from './lama-round.service';
import { LamaSharedService } from './lama-shared.service';
import { LamaLogService } from './lama-log.service';
import { createPendingState } from '../../../../../application/services/pending-action.service';

export class LamaQuitService {
  constructor(
    private readonly shared: LamaSharedService,
    private readonly round: LamaRoundService,
    private readonly logger: LamaLogService,
  ) {}

  applyQuit(
    state: GameStateEntity,
    meta: LamaMetadata,
    actorId: number,
  ): GameStateEntity {
    const droppedOutByPlayerId = { ...(meta.droppedOutByPlayerId ?? {}) };
    if (droppedOutByPlayerId[String(actorId)]) return state;
    droppedOutByPlayerId[String(actorId)] = true;

    const players = Array.isArray(state.players) ? state.players : [];
    const name = this.shared.playerLabel(players, actorId);
    let log = this.logger.append(state.log, `${name} se retire de la manche.`);
    log = this.logger.append(
      log,
      `${name} ne jouera plus ; ses jetons seront comptés à la fin de la manche.`,
    );

    const nextMeta: LamaMetadata = {
      ...meta,
      droppedOutByPlayerId,
      suppressTurnAnnouncement: false,
    };
    const nextStateBase: GameStateEntity = {
      ...state,
      metadata: nextMeta,
      log,
    };

    const roundNumber = Number(meta.roundNumber ?? 0);
    const alreadyLoggedRoundEnd =
      roundNumber > 0 &&
      Array.isArray(state.log) &&
      state.log.some(
        (l: GameLogEntry) =>
          String(l.message ?? '') === `Fin de la manche ${roundNumber}.`,
      );

    if (alreadyLoggedRoundEnd) {
      const winnerId = this.round.findRoundWinnerId(nextMeta, players);
      return this.round.endRound(nextStateBase, winnerId);
    }

    if (this.round.isRoundEnded(nextMeta, players)) {
      const winnerId = this.round.findRoundWinnerId(nextMeta, players);
      return this.round.endRound(nextStateBase, winnerId);
    }

    const nextPlayerId = this.round.findNextActivePlayerId(
      players,
      nextMeta,
      actorId,
    );
    const nextPending: PendingState = {
      step: 'turn_choice',
      playerId: nextPlayerId,
    };
    return createPendingState(
      {
        ...nextStateBase,
        turnIndex: (state.turnIndex ?? 0) + 1,
        metadata: {
          ...nextMeta,
          turnTracker: { playerId: nextPlayerId, drawn: false, played: false },
        },
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: nextPlayerId,
          direction: 1,
          label: nextPlayerId
            ? `Tour de ${this.shared.playerLabel(players, nextPlayerId)}`
            : undefined,
        },
      },
      nextPending,
    );
  }
}




