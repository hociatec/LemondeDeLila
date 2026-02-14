import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

import { getRngMeta, getSafePlayers } from '../../../../setup/setup-service.helper';
import { RandomService } from '../../../../modules/random/services/random.service';
import {
  ENTRE_RITES_CARD_BY_ID,
  ENTRE_RITES_DECK,
} from '../model/entre-rites-cards';
import type { EntreRitesMetadata } from '../model/entre-rites-state.entity';

@Injectable()
export class EntreRitesSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const playerIds = players
      .filter((player) => player?.id != null)
      .map((player) => player!.id);

    const deckIds = ENTRE_RITES_DECK.map((card) => card.id);
    const rngSeed = ((baseState.metadata ?? {}) as EntreRitesMetadata).rng ?? {};
    const { values: shuffledDeck, meta: rng } = this.random.shuffle(
      rngSeed,
      deckIds,
    );

    const hands: Record<number, string[]> = {};
    const familyCollections: Record<number, Record<string, string[]>> = {};
    const completedFamilies: Record<number, string[]> = {};
    const specialsPlayed: Record<number, string[]> = {};
    const specialsPlayedCount: Record<number, number> = {};

    let deckIndex = 0;
    for (const playerId of playerIds) {
      const hand: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        if (deckIndex >= shuffledDeck.length) break;
        hand.push(shuffledDeck[deckIndex++]);
      }
      hands[playerId] = hand;
      familyCollections[playerId] = this.buildCollections(hand);
      completedFamilies[playerId] = [];
      specialsPlayed[playerId] = [];
      specialsPlayedCount[playerId] = 0;
    }

    const metadata: EntreRitesMetadata = {
      rng,
      deck: shuffledDeck.slice(deckIndex),
      discard: [],
      hands,
      familyCollections,
      completedFamilies,
      specialsPlayed,
      specialsPlayedCount,
      peaceTurnsRemaining: 0,
      silenceUntilPlayerId: null,
    };

    return {
      ...baseState,
      metadata,
    };
  }

  private buildCollections(hand: string[]): Record<string, string[]> {
    const collections: Record<string, string[]> = {};
    for (const cardId of hand) {
      const card = ENTRE_RITES_CARD_BY_ID[cardId];
      if (card?.type === 'family') {
        const bucket = [...(collections[card.familyId] ?? [])];
        bucket.push(cardId);
        collections[card.familyId] = bucket;
      }
    }
    return collections;
  }
}
