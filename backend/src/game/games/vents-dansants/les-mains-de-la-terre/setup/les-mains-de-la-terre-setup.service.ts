import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { RandomService } from '../../../../modules/random/services/random.service';
import {
  LES_MAINS_DECK,
  isLesMainsSpecialCard,
  LesMainsFamily,
} from '../model/les-mains-de-la-terre-cards';
import type { LesMainsMetadata } from '../model/les-mains-de-la-terre-state.entity';

@Injectable()
export class LesMainsSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const playerIds = players
      .filter((player) => typeof player?.id === 'number')
      .map((player) => player!.id);
    const seedMeta = (baseState.metadata ?? {}) as LesMainsMetadata;
    const rngSeed = seedMeta.rng ?? {};
    const deck = LES_MAINS_DECK.map((card) => card.id);
    const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rngSeed, deck);

    const hands: Record<number, string[]> = {};
    playerIds.forEach((pid) => {
      hands[pid] = [];
    });

    const queue = [...playerIds];
    let remainingDeck = [...shuffledDeck];
    const specialBuffer: string[] = [];

    while (queue.length && remainingDeck.length) {
      const playerId = queue.shift()!;
      const cardId = remainingDeck.shift();
      if (!cardId) break;
      if (isLesMainsSpecialCard(cardId)) {
        specialBuffer.push(cardId);
        queue.unshift(playerId);
        continue;
      }
      hands[playerId] = [...hands[playerId], cardId];
      if (hands[playerId].length < 6) {
        queue.push(playerId);
      }
    }

    const metadata: LesMainsMetadata = {
      rng: updatedRng,
      deck: [...specialBuffer, ...remainingDeck],
      discard: [],
      hands,
      completedFamilies: playerIds.reduce((acc, pid) => {
      acc[pid] = [];
      return acc;
    }, {} as Record<number, LesMainsFamily[]>),
      statuses: { skipTurn: {} },
      extraDraws: {},
      freeFamilyRequest: {},
      bonusMetierDisparuUsed: {},
      winnerId: null,
    };

    return {
      ...baseState,
      metadata,
    };
  }
}
