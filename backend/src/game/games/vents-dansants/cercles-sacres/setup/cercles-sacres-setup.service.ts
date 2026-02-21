import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

import {
  getRngMeta,
  getSafePlayers,
} from '../../../../setup/setup-service.helper';
import { RandomService } from '../../../../modules/random/services/random.service';
import { CERCLES_SACRES_DECK } from '../model/cercles-sacres-cards';
import type {
  CerclesSacresCircle,
  CerclesSacresMetadata,
} from '../model/cercles-sacres-state.entity';

@Injectable()
export class CerclesSacresSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const metaSeed = (baseState.metadata ?? {}) as CerclesSacresMetadata;
    const rng = getRngMeta(metaSeed);
    const deck = CERCLES_SACRES_DECK.map((card) => card.id);
    const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(
      rng,
      deck,
    );

    const remainingDeck = [...shuffledDeck];
    const hands: Record<number, string[]> = {};
    const circles: Record<number, CerclesSacresCircle[]> = {};

    for (const player of players) {
      const playerId = player?.id;
      if (playerId == null) continue;
      const hand: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        if (!remainingDeck.length) break;
        hand.push(remainingDeck.shift()!);
      }
      hands[playerId] = hand;
      circles[playerId] = [];
    }

    const metadata: CerclesSacresMetadata = {
      rng: updatedRng,
      deck: remainingDeck,
      discard: [],
      hands,
      circles,
      drawnPlayerId: null,
      winnerId: null,
    };

    return {
      ...baseState,
      metadata,
    };
  }
}
