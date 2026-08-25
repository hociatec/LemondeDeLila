import type {
  GameStateEntity,
  PendingState,
} from '../../../../../core/application/models/game-state.model';
import type { LamaMetadata } from '../../model/lama.model';
import { LamaRoundService } from './lama-round.service';
import { LamaSharedService } from './lama-shared.service';
import { LamaLogService } from './lama-log.service';
import { createPendingState } from '../../../../../core/application/services/pending-action.service';

export class LamaPassService {
  constructor(
    private readonly shared: LamaSharedService,
    private readonly round: LamaRoundService,
    private readonly logger: LamaLogService,
  ) {}

  applyPass(
    state: GameStateEntity,
    meta: LamaMetadata,
    actorId: number,
  ): GameStateEntity {
    if (!meta.allowPlayAfterDraw) return state;
    const tracker = meta.turnTracker ?? {
      playerId: actorId,
      drawn: false,
      played: false,
    };
    if (
      this.shared.asNumberOrNull(tracker.playerId) !== actorId ||
      !this.shared.asBoolean(tracker.drawn) ||
      this.shared.asBoolean(tracker.played)
    ) {
      return state;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const name = this.shared.playerLabel(players, actorId);
    const log = this.logger.append(state.log, `${name} passe.`);

    const nextPlayerId = this.round.findNextActivePlayerId(
      players,
      meta,
      actorId,
    );
    const nextMeta: LamaMetadata = {
      ...meta,
      turnTracker: { playerId: nextPlayerId, drawn: false, played: false },
      suppressTurnAnnouncement: false,
    };

    const nextPending: PendingState = {
      step: 'turn_choice',
      playerId: nextPlayerId,
    };
    const nextState = createPendingState(
      {
        ...state,
        metadata: nextMeta,
        log,
        turnIndex: (state.turnIndex ?? 0) + 1,
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

    if (this.round.isRoundEnded(nextMeta, players)) {
      const winnerId = this.round.findRoundWinnerId(nextMeta, players);
      return this.round.endRound(nextState, winnerId);
    }

    return nextState;
  }
}




