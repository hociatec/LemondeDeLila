import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { LamaCardValue, LamaMetadata } from '../model/lama.model';
import { nextLamaValue } from '../model/lama.model';
import { LamaRoundService } from '../round/lama-round.service';
import { LamaSharedService } from '../shared/lama-shared.service';

@Injectable()
export class LamaDrawService {
  constructor(
    private readonly shared: LamaSharedService,
    private readonly round: LamaRoundService,
  ) {}

  applyDraw(state: GameStateEntity, meta: LamaMetadata, actorId: number): GameStateEntity {
    const tracker = meta.turnTracker ?? { playerId: actorId, drawn: false, played: false };
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
    const hand = [...((handsByPlayerId[String(actorId)] as LamaCardValue[]) ?? [])];
    hand.push(card);
    handsByPlayerId[String(actorId)] = hand;

    const players = Array.isArray(state.players) ? state.players : [];
    const name = this.shared.playerLabel(players, actorId);
    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `${name} pioche.` });

    const allowPlayAfterDraw = Boolean(meta.allowPlayAfterDraw);

    const topDiscard =
      Array.isArray(meta.discard) && meta.discard.length
        ? (meta.discard[meta.discard.length - 1] as LamaCardValue)
        : null;
    const canPlayAfterDraw =
      allowPlayAfterDraw &&
      topDiscard != null &&
      hand.some((v) => v === topDiscard || v === nextLamaValue(topDiscard));

    const nextMeta: LamaMetadata = {
      ...meta,
      deck,
      handsByPlayerId,
      lastDrawTurnIndexByPlayerId: {
        ...(((meta as any).lastDrawTurnIndexByPlayerId as any) ?? {}),
        [String(actorId)]: turnIndex + 1,
      },
      turnTracker: { playerId: actorId, drawn: true, played: false },
    };

    if (allowPlayAfterDraw && !canPlayAfterDraw) {
      log.push({ message: `${name} passe.` });
    }

    const nextPlayerId = canPlayAfterDraw
      ? actorId
      : this.round.findNextActivePlayerId(players, nextMeta, actorId);

    const advancedMeta: LamaMetadata = canPlayAfterDraw
      ? nextMeta
      : { ...nextMeta, turnTracker: { playerId: nextPlayerId, drawn: false, played: false } };

    const nextState: GameStateEntity = {
      ...state,
      metadata: advancedMeta as any,
      log,
      pending: { step: 'turn_choice', playerId: nextPlayerId } as any,
      turnIndex: turnIndex + 1,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: nextPlayerId,
        direction: 1,
        label: nextPlayerId ? `Tour de ${this.shared.playerLabel(players, nextPlayerId)}` : undefined,
      },
    };

    if (this.round.isRoundEnded(advancedMeta, players)) {
      const winnerId = this.round.findRoundWinnerId(advancedMeta, players);
      return this.round.endRound(nextState, winnerId);
    }

    return nextState;
  }
}
