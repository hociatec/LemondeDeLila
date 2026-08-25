import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../application/models/game-action.model';

import { formatPresenterActions } from '../../../../../application/helpers/actions-presenter.helper';
import * as Rulebook from '../../rulebook/rulebook';
import { DAME_NATURE_GAME } from '../../definitions/game.definition';
import type { DameNatureMetadata } from '../../model/dame-nature-state.model';
import {
  DAME_NATURE_CARD_BY_ID,
  DAME_NATURE_FAMILY_CARD_DEFINITIONS,
} from '../../model/dame-nature-cards';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../../application/helpers/lamalike-presenter.helper';

export class DameNaturePresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as DameNatureMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const deckCount = Array.isArray(meta.deck) ? meta.deck.length : 0;
    const pollution = meta.pollutionTokens ?? 0;
    const hand = Array.isArray(meta.hands?.[userId])
      ? [...meta.hands[userId]]
      : [];
    const handCounts = summarizeHandCounts(meta.hands);
    const panels = buildLamaLikePanels({
      hand,
      handCounts,
      discardLabel: 'Famille ciblée',
      tableMessage: `Pollution : ${pollution}`,
    });
    const presentedHand = this.buildHandCards(hand);

    return {
      ...state,
      catalog: {
        phases: DAME_NATURE_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      extras: {
        hand: presentedHand,
        catalog: this.buildCatalog(),
        playerViews: this.buildPlayerViews(state.players),
        hands: meta.hands,
        families: meta.families,
        pollutionTokens: pollution,
        deckCount,
        lastQuizCardId: meta.lastQuizCardId ?? null,
        pollutionLoserId: meta.pollutionLoserId ?? null,
        ui: { panels },
      },
      pending: state.pending ?? null,
    };
  }

  private buildCatalog(): Record<string, Array<{ id: string; name: string }>> {
    const catalog: Record<string, Array<{ id: string; name: string }>> = {};
    for (const card of DAME_NATURE_FAMILY_CARD_DEFINITIONS) {
      const key = card.familyId;
      const list = catalog[key] ?? [];
      list.push({
        id: card.id,
        name: `${card.familyName} - ${card.memberName}`,
      });
      catalog[key] = list;
    }
    return catalog;
  }

  private buildHandCards(
    hand: string[],
  ): Array<{ family?: string; id: string; label: string; description?: string }> {
    const cards: Array<{
      family?: string;
      id: string;
      label: string;
      description?: string;
    }> = [];
    for (const cardId of hand ?? []) {
      const definition = DAME_NATURE_CARD_BY_ID[cardId];
      if (!definition) {
        continue;
      }
      if (definition.type === 'family') {
        cards.push({
          family: definition.familyId,
          id: definition.id,
          label: `${definition.familyName} - ${definition.memberName}`,
        });
        continue;
      }
      const label =
        definition.type === 'quiz'
          ? definition.question
          : definition.description;
      cards.push({
        id: definition.id,
        label,
        description: definition.type === 'quiz' ? definition.answer : undefined,
      });
    }
    return cards;
  }

  private buildPlayerViews(
    players?: GameStateEntity['players'],
  ): Array<{ id: number; username: string }> {
    if (!Array.isArray(players)) return [];
    return players
      .filter((player) => typeof player?.id === 'number')
      .map((player) => ({
        id: player.id,
        username: player.username?.trim() || `Joueur ${player.id}`,
      }));
  }
}


