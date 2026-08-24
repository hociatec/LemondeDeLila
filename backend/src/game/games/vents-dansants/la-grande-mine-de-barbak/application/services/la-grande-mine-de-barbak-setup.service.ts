import type { GameStateEntity } from '../../../../application/models/game-state.model';

import {
  getRngMeta,
  getSafePlayers,
} from '../../../../application/helpers/setup-service.helper';
import { RandomService } from '../../../../application/services/random.service';
import { LA_GRANDE_MINE_CARDS } from '../../model/la-grande-mine-cards';
import type {
  LaGrandeMineDomain,
  LaGrandeMineMetadata,
} from '../../model/la-grande-mine-state.model';

export class LaGrandeMineSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const seedMeta = (baseState.metadata ?? {}) as LaGrandeMineMetadata;
    let rngMeta = getRngMeta(seedMeta);
    const deckIds = LA_GRANDE_MINE_CARDS.map((card) => card.id);
    const { values: shuffled, meta: updatedRng } = this.random.shuffle(
      rngMeta,
      deckIds,
    );
    rngMeta = updatedRng;

    const hands: Record<number, string[]> = {};
    players.forEach((player) => {
      if (player?.id == null) return;
      hands[player.id] = [];
    });

    const deckAfterDeal = [...shuffled];
    const cardsPerPlayer = 5;
    for (let i = 0; i < cardsPerPlayer; i += 1) {
      for (const player of players) {
        if (player?.id == null) continue;
        if (!deckAfterDeal.length) break;
        const cardId = deckAfterDeal.shift();
        if (cardId) {
          hands[player.id].push(cardId);
        }
      }
    }

    const domains = players.reduce<Record<number, LaGrandeMineDomain>>(
      (acc, player) => {
        if (player?.id == null) return acc;
        acc[player.id] = { treasures: [], objects: [] };
        return acc;
      },
      {},
    );

    const metadata: LaGrandeMineMetadata = {
      rng: rngMeta,
      deck: deckAfterDeal,
      discard: [],
      hands,
      drawnPlayerId: null,
      domains,
      winnerId: null,
    };

    return {
      ...baseState,
      status: 'started',
      phase: 'round',
      metadata,
    };
  }
}




