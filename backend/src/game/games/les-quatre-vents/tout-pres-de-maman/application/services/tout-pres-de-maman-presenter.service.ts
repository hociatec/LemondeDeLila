import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../application/models/game-action.model';

import { formatPresenterActions } from '../../../../../application/helpers/actions-presenter.helper';
import { BoardPayloadService } from '../../../../../application/services/board-payload.service';
import * as Rulebook from '../../rulebook/rulebook';
import { TOUT_PRES_DE_MAMAN_GAME } from '../../definitions/tout-pres-de-maman.definition';
import type {
  ToutPresDeMamanCard,
  ToutPresDeMamanMetadata,
} from '../../model/tout-pres-de-maman-state.model';

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

    const stateRecord = asRecord(state);
    const baseExtras = asRecord(stateRecord.extras);
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
      actions: formatPresenterActions(actions, () => 'Lancer le dé'),
      pending: state.pending ?? null,
      extras: {
        ...baseExtras,
        tokens: `${tokens} / ${totalNeeded} jetons eucalyptus`,
        nextCard: nextCard?.text ?? 'Pile de cartes vide',
        ui: {
          panels: {
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
    } as GameStateWithActions;
  }

  private getMeta(state: GameStateEntity): ToutPresDeMamanMetadata {
    return (state.metadata ?? {}) as ToutPresDeMamanMetadata;
  }

  private peekNextCard(
    meta: ToutPresDeMamanMetadata,
  ): ToutPresDeMamanCard | null {
    const deck = Array.isArray(meta.deckCards) ? meta.deckCards : [];
    if (!deck.length) return null;
    const id = deck[0];
    return meta.cards.find((card) => card.id === id) ?? null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}



