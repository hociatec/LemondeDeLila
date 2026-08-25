import type {
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import type { LamaCardValue, LamaMetadata } from '../../model/lama.model';
import { lamaCardLabel } from '../../model/lama.model';
import { LamaRoundService } from './lama-round.service';
import { LamaSharedService } from './lama-shared.service';
import { LamaLogService } from './lama-log.service';
import { createPendingState } from '../../../../../application/services/pending-action.service';
import { isLamaDrawLocked } from '../policies/lama-draw.policy';

export class LamaDrawService {
  constructor(
    private readonly shared: LamaSharedService,
    private readonly round: LamaRoundService,
    private readonly logger: LamaLogService,
  ) {}

  applyDraw(
    state: GameStateEntity,
    meta: LamaMetadata,
    actorId: number,
  ): GameStateEntity {
    if (isLamaDrawLocked(meta)) {
      return state;
    }

    const tracker = meta.turnTracker ?? {
      playerId: actorId,
      drawn: false,
      played: false,
    };
    if (
      this.shared.asNumberOrNull(tracker.playerId) === actorId &&
      this.shared.asBoolean(tracker.drawn)
    ) {
      return state;
    }

    const turnIndex = Number(state.turnIndex ?? 0);
    const lastDrawMap = meta.lastDrawTurnIndexByPlayerId ?? null;
    const lastDrawIndex =
      lastDrawMap && typeof lastDrawMap === 'object'
        ? this.shared.asNumberOrNull(lastDrawMap[String(actorId)])
        : null;
    if (lastDrawIndex != null && lastDrawIndex === turnIndex) {
      return state;
    }

    const deck = Array.isArray(meta.deck) ? [...meta.deck] : [];
    if (deck.length <= 0) return state;
    const card = deck.pop() as LamaCardValue;
    const handsByPlayerId = { ...(meta.handsByPlayerId ?? {}) };
    const hand = [...(handsByPlayerId[String(actorId)] ?? [])];
    hand.push(card);
    handsByPlayerId[String(actorId)] = hand;

    const players = Array.isArray(state.players) ? state.players : [];
    const name = this.shared.playerLabel(players, actorId);
    const label = lamaCardLabel(card);
    const log = this.logger.append(state.log, `${name} pioche un ${label}.`);

    const nextMeta: LamaMetadata = {
      ...meta,
      deck,
      handsByPlayerId,
      lastDrawTurnIndexByPlayerId: {
        ...(meta.lastDrawTurnIndexByPlayerId ?? {}),
        [String(actorId)]: turnIndex,
      },
      turnTracker: { playerId: actorId, drawn: true, played: false },
      suppressTurnAnnouncement: false,
    };

    const allowPlayAfterDraw = Boolean(meta.allowPlayAfterDraw);
    if (allowPlayAfterDraw) {
      const nextPending: PendingState = {
        step: 'turn_choice',
        playerId: actorId,
      };
      return createPendingState(
        {
          ...state,
          metadata: nextMeta,
          log,
          turn: {
            ...(state.turn ?? { direction: 1 }),
            currentPlayerId: actorId,
            direction: 1,
            label: `Tour de ${this.shared.playerLabel(players, actorId)}`,
          },
        },
        nextPending,
      );
    }

    const nextPlayerId = this.round.findNextActivePlayerId(
      players,
      nextMeta,
      actorId,
    );

    const advancedMeta: LamaMetadata = {
      ...nextMeta,
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
        metadata: advancedMeta,
        log,
        turnIndex: turnIndex + 1,
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

    if (this.round.isRoundEnded(advancedMeta, players)) {
      const winnerId = this.round.findRoundWinnerId(advancedMeta, players);
      return this.round.endRound(nextState, winnerId);
    }

    return nextState;
  }
}




