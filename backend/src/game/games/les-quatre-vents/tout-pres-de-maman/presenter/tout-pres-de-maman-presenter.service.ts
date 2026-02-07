import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import * as Rulebook from '../rulebook/rulebook';
import { TOUT_PRES_DE_MAMAN_GAME } from '../definitions/tout-pres-de-maman.definition';
import type { ToutPresDeMamanCard, ToutPresDeMamanMetadata } from '../model/tout-pres-de-maman-state.entity';

@Injectable()
export class ToutPresDeMamanPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = this.getMeta(state);
    const tokens = meta.tokens?.[userId] ?? 0;
    const totalNeeded = 3;
    const nextCard = this.peekNextCard(meta);
    const players = Array.isArray(state.players) ? state.players : [];
    const scoreLines = players.map((p) => {
      const name =
        typeof p?.username === 'string' && p.username.trim().length > 0
          ? p.username.trim()
          : `Joueur ${p?.id ?? '?'}`;
      const count = meta.tokens?.[p?.id ?? -1] ?? 0;
      return `${name} : ${count} eucalyptus`;
    });

    return {
      ...state,
      catalog: {
        phases: TOUT_PRES_DE_MAMAN_GAME.phaseOrder.map((phase) => phase.id),
        victory:
          meta.winnerId != null
            ? {
                winnerId: meta.winnerId,
              }
            : null,
      },
      actions: actions.map((action) => ({
        type: action.type,
        label: 'Lancer le dé',
        payload: action.payload ?? {},
      })),
      pending: state.pending ?? null,
      extras: {
        ...(state as any).extras,
        tokens: `${tokens} / ${totalNeeded} jetons eucalyptus`,
        nextCard: nextCard?.text ?? 'Pile de cartes vide',
        ui: {
          panels: {
            position: {
              title: 'Position',
              message: this.boardPayload.buildPositionPanelMessage({
                tilesRaw: meta.tiles,
                positionsRaw: meta.positions,
                playerId: userId,
              }),
            },
            score: {
              title: 'Eucalyptus',
              message: scoreLines.length
                ? scoreLines.join('\n')
                : 'Eucalyptus: indisponible.',
            },
          },
        },
      },
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
      ),
    } as any;
  }

  private getMeta(state: GameStateEntity): ToutPresDeMamanMetadata {
    return (state.metadata ?? {}) as ToutPresDeMamanMetadata;
  }

  private peekNextCard(meta: ToutPresDeMamanMetadata): ToutPresDeMamanCard | null {
    const deck = Array.isArray(meta.deckCards) ? meta.deckCards : [];
    if (!deck.length) return null;
    const id = deck[0];
    return meta.cards.find((card) => card.id === id) ?? null;
  }
}
