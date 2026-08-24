import type {
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../application/models/game-action.model';
import type { LamaCardValue, LamaMetadata } from '../../model/lama.model';
import { lamaCardLabel, nextLamaValue } from '../../model/lama.model';
import { LamaRoundService } from './lama-round.service';
import { LamaSharedService } from './lama-shared.service';
import { LamaLogService } from './lama-log.service';
import { createPendingState } from '../../../../../application/services/pending-action.service';
import { requiredInt } from '../../../../../application/helpers/payload-validators.helper';

export class LamaPlayService {
  constructor(
    private readonly shared: LamaSharedService,
    private readonly round: LamaRoundService,
    private readonly logger: LamaLogService,
  ) {}

  applyPlay(
    state: GameStateEntity,
    meta: LamaMetadata,
    actorId: number,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const tracker = meta.turnTracker ?? {
      playerId: actorId,
      drawn: false,
      played: false,
    };
    if (
      this.shared.asNumberOrNull(tracker.playerId) === actorId &&
      this.shared.asBoolean(tracker.played)
    ) {
      return state;
    }

    const rawValue = (() => {
      try {
        return requiredInt(action.payload ?? {}, 'value');
      } catch {
        return 0;
      }
    })();
    const value = (
      rawValue >= 1 && rawValue <= 7 ? rawValue : 0
    ) as LamaCardValue;
    const count = 1;

    const discard = Array.isArray(meta.discard) ? [...meta.discard] : [];
    const top = discard.length ? discard[discard.length - 1] : null;
    if (!top) return state;

    const allowed = new Set<LamaCardValue>([top, nextLamaValue(top)]);
    if (!allowed.has(value)) return state;

    const handsByPlayerId = { ...(meta.handsByPlayerId ?? {}) };
    const hand = [...(handsByPlayerId[String(actorId)] ?? [])];
    const availableCount = hand.filter((v) => v === value).length;
    if (availableCount < count) return state;

    let removed = 0;
    const nextHand: LamaCardValue[] = [];
    for (const v of hand) {
      if (v === value && removed < count) {
        removed += 1;
        continue;
      }
      nextHand.push(v);
    }
    handsByPlayerId[String(actorId)] = nextHand;

    for (let i = 0; i < count; i += 1) {
      discard.push(value);
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const name = this.shared.playerLabel(players, actorId);
    const label = lamaCardLabel(value);
    const log = this.logger.append(state.log, `${name} joue un ${label}.`);

    const nextMeta: LamaMetadata = {
      ...meta,
      handsByPlayerId,
      discard,
      turnTracker: {
        playerId: actorId,
          drawn: tracker.drawn,
        played: true,
      },
      suppressTurnAnnouncement: false,
    };

    if (nextHand.length === 0) {
      const endedState: GameStateEntity = {
        ...state,
        metadata: nextMeta,
        log,
        turnIndex: (state.turnIndex ?? 0) + 1,
      };
      return this.round.endRound(endedState, actorId);
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
    const nextState = createPendingState(
      {
        ...state,
        metadata: {
          ...nextMeta,
          turnTracker: { playerId: nextPlayerId, drawn: false, played: false },
          suppressTurnAnnouncement: false,
        },
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




