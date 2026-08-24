import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import {
  getRngMeta,
  getSafePlayers,
} from '../../../../../application/helpers/setup-service.helper';
import { RandomService } from '../../../../../application/services/random.service';
import {
  INITIAL_CANDIES,
  LA_PARADE_CARD_DECK,
} from '../../model/la-parade-sucree-cards';
import type {
  CandyCounts,
  LaParadeSucreeMetadata,
} from '../../model/la-parade-sucree-state.model';

export class LaParadeSucreeSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const seedMeta = (baseState.metadata ?? {}) as LaParadeSucreeMetadata;
    let rngMeta = getRngMeta(seedMeta);
    const deck = [...LA_PARADE_CARD_DECK];
    const { values: shuffled, meta: updatedRng } = this.random.shuffle(
      rngMeta,
      deck,
    );
    rngMeta = updatedRng;

    const hands: Record<number, string[]> = {};
    players.forEach((player) => {
      if (player?.id == null) return;
      hands[player.id] = [];
    });

    let cursor = 0;
    while (cursor < shuffled.length) {
      for (const player of players) {
        if (player?.id == null) continue;
        if (cursor >= shuffled.length) break;
        const card = shuffled[cursor];
        hands[player.id].push(card.id);
        cursor += 1;
      }
    }

    const candies: Record<number, CandyCounts> = {};
    players.forEach((player) => {
      if (player?.id == null) return;
      const baseCandy: CandyCounts = {
        Chamallow: INITIAL_CANDIES.Chamallow,
        Chocobon: INITIAL_CANDIES.Chocobon,
        Balisto: INITIAL_CANDIES.Balisto,
      };
      candies[player.id] = baseCandy;
    });

    const metadata: LaParadeSucreeMetadata = {
      rng: rngMeta,
      hands,
      candies,
      sequenceIndex: 0,
      played: [],
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



