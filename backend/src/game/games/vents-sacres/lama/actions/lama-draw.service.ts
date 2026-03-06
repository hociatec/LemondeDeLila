import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { LamaCardValue, LamaMetadata } from '../model/lama.model';
import { lamaCardLabel } from '../model/lama.model';
import { LamaRoundService } from '../round/lama-round.service';
import { LamaSharedService } from '../shared/lama-shared.service';
import { LamaLogService } from '../logging/lama-log.service';
import { createPendingState } from '../../../../modules/pending-action/services/pending-action.service';

@Injectable()
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
    if (this.shared.isDrawLocked(meta)) {
      return state;
    }

    const tracker = meta.turnTracker ?? {
      playerId: actorId,
      drawn: false,
      played: false,
    };
    if (
      this.shared.asNumberOrNull((tracker as any).playerId) === actorId &&
      this.shared.asBoolean((tracker as any).drawn)
    ) {
      return state;
    }

    const turnIndex = Number(state.turnIndex ?? 0);
    const lastDrawMap: any = (meta as any)?.lastDrawTurnIndexByPlayerId ?? null;
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
        ...((meta as any).lastDrawTurnIndexByPlayerId ?? {}),
        [String(actorId)]: turnIndex,
      },
      turnTracker: { playerId: actorId, drawn: true, played: false },
      suppressTurnAnnouncement: false,
    };

    const allowPlayAfterDraw = Boolean(meta.allowPlayAfterDraw);
    if (allowPlayAfterDraw) {
      return createPendingState(
        {
          ...state,
          metadata: nextMeta as any,
          log,
          turn: {
            ...(state.turn ?? { direction: 1 }),
            currentPlayerId: actorId,
            direction: 1,
            label: `Tour de ${this.shared.playerLabel(players, actorId)}`,
          },
        } as GameStateEntity,
        { step: 'turn_choice', playerId: actorId } as any,
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

    const nextState = createPendingState(
      {
        ...state,
        metadata: advancedMeta as any,
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
      } as GameStateEntity,
      { step: 'turn_choice', playerId: nextPlayerId } as any,
    );

    if (this.round.isRoundEnded(advancedMeta, players)) {
      const winnerId = this.round.findRoundWinnerId(advancedMeta, players);
      return this.round.endRound(nextState, winnerId);
    }

    return nextState;
  }
}
