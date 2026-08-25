import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../core/application/models/game-action.model';

import { formatPresenterActions } from '../../../../../core/application/helpers/actions-presenter.helper';
import * as Rulebook from '../../rulebook/rulebook';
import {
  LES_MAINS_CARD_BY_ID,
  LES_MAINS_FAMILIES,
  LesMainsFamily,
} from '../../model/les-mains-de-la-terre-cards';
import { LES_MAINS_GAME } from '../../definitions/game.definition';
import type { LesMainsMetadata } from '../../model/les-mains-de-la-terre-state.model';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../../core/application/helpers/lamalike-presenter.helper';
import { stringOrEmpty } from '@common/utils/public-api';

const FAMILY_LABELS: Record<LesMainsFamily, string> = {
  tradition: 'Tradition',
  nature: 'Nature',
  mer: 'Mer',
  art: 'Art',
  insolites: 'Insolites',
  innovation: 'Innovation',
  sante: 'Santé',
};

export class LesMainsPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as LesMainsMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand = Array.isArray(meta.hands?.[userId]) ? meta.hands[userId] : [];
    const handCounts = summarizeHandCounts(meta.hands);
    const panels = buildLamaLikePanels({
      hand,
      handCounts,
      discardLabel: 'Table de métiers',
      tableMessage: `Statut: ${state.status ?? 'en attente'}`,
    });
    const familyCatalog = this.buildFamilyCatalog();
    const catalog = {
      phases: LES_MAINS_GAME.phaseOrder.map((phase) => phase.id),
      victory: null,
      ...familyCatalog,
    };
    const presentedHand = this.buildHandCards(hand);

    return {
      ...state,
      catalog,
      actions: formatPresenterActions(actions, (action) =>
        this.buildLabel(action),
      ),
      extras: {
        hand: presentedHand,
        catalog,
        deckCount: meta.deck?.length ?? 0,
        completedFamilies: meta.completedFamilies,
        freeRequest: Boolean(meta.freeFamilyRequest?.[userId]),
        statuses: meta.statuses,
        playerViews: this.buildPlayerViews(state.players),
        ui: { panels },
      },
      pending: state.pending ?? null,
    };
  }

  private buildLabel(action: {
    type: string;
    payload?: Record<string, unknown>;
  }): string {
    if (action.type === 'request_card') {
      const cardId = stringOrEmpty(action.payload?.cardId);
      return `Demander ${LES_MAINS_CARD_BY_ID[cardId]?.name ?? cardId}`;
    }
    return action.type;
  }

  private buildFamilyCatalog(): Record<
    string,
    Array<{ id: string; name: string }>
  > {
    const catalog: Record<string, Array<{ id: string; name: string }>> = {};
    const cards = Object.values(LES_MAINS_CARD_BY_ID);
    for (const family of LES_MAINS_FAMILIES) {
      const members = cards
        .filter((card) => card.family === family)
        .map((card) => ({
          id: card.id,
          name: `${FAMILY_LABELS[family] ?? family} - ${card.name}`,
        }));
      if (members.length) {
        catalog[family] = members;
      }
    }
    return catalog;
  }

  private buildHandCards(
    hand: string[],
  ): Array<{ family?: LesMainsFamily; id: string; label: string }> {
    type LesMainsHandCard = {
      family?: LesMainsFamily;
      id: string;
      label: string;
    };

    const cards: Array<LesMainsHandCard | null> = hand.map((cardId) => {
      const card = LES_MAINS_CARD_BY_ID[cardId];
      if (!card) {
        return null;
      }
      const familyId = card.family ?? undefined;
      const familyLabel =
        (familyId && FAMILY_LABELS[familyId]) || (familyId ?? 'Carte');
      const label = card.name ? `${familyLabel} - ${card.name}` : cardId;
      return {
        family: familyId,
        id: card.id,
        label,
      };
    });
    return cards.filter((entry): entry is LesMainsHandCard => entry !== null);
  }

  private buildPlayerViews(
    players?: GameStateEntity['players'],
  ): Array<{ id: number; username: string }> {
    if (!Array.isArray(players)) return [];
    return players
      .map((player) => {
        if (!player?.id) return null;
        const username =
          typeof player.username === 'string' &&
          player.username.trim().length > 0
            ? player.username.trim()
            : `Joueur ${player.id}`;
        return { id: player.id, username };
      })
      .filter((view): view is { id: number; username: string } => view != null);
  }
}



