import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { ENTRE_RITES_GAME } from '../definitions/game.definition';
import type { EntreRitesMetadata } from '../model/entre-rites-state.entity';
import {
  ENTRE_RITES_CARD_BY_ID,
  ENTRE_RITES_FAMILY_CARDS,
} from '../model/entre-rites-cards';

@Injectable()
export class EntreRitesPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as EntreRitesMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const hand = Array.isArray(meta.hands?.[userId]) ? [...meta.hands[userId]] : [];
    const extras = {
      hand,
      handCards: this.buildHandCards(hand),
      catalog: this.buildCatalog(),
      playerViews: this.buildPlayerViews(state.players),
      hands: meta.hands,
      familyCollections: meta.familyCollections,
      completedFamilies: meta.completedFamilies,
      specialsPlayed: meta.specialsPlayed,
      specialsPlayedCount: meta.specialsPlayedCount,
      deckCount: meta.deck.length,
      discardCount: meta.discard.length,
    };

    return {
      ...state,
      catalog: {
        phases: ENTRE_RITES_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: actions.map((action) => ({
        type: action.type,
        label: action.type,
        payload: action.payload ?? {},
      })),
      extras,
      pending: state.pending ?? null,
    } as any;
  }

  private buildCatalog(): Record<string, Array<{ id: string; name: string }>> {
    const catalog: Record<string, Array<{ id: string; name: string }>> = {};
    for (const card of ENTRE_RITES_FAMILY_CARDS) {
      const list = catalog[card.familyId] ?? [];
      list.push({ id: card.id, name: `${card.familyName} - ${card.name}` });
      catalog[card.familyId] = list;
    }
    return catalog;
  }

  private buildHandCards(
    hand: string[],
  ): Array<{ familyId?: string; memberId: string; label: string }> {
    const cards: Array<{ familyId?: string; memberId: string; label: string }> = [];
    for (const cardId of hand ?? []) {
      const definition = ENTRE_RITES_CARD_BY_ID[cardId];
      if (!definition) continue;
      if (definition.type === 'family') {
        cards.push({
          familyId: definition.familyId,
          memberId: definition.id,
          label: `${definition.familyName} - ${definition.name}`,
        });
        continue;
      }
      cards.push({
        familyId: undefined,
        memberId: definition.id,
        label: definition.name,
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
        id: player!.id,
        username: player!.username?.trim() || `Joueur ${player!.id}`,
      }));
  }
}
