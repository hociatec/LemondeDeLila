import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { RandomService } from '../../../../modules/random/services/random.service';
import { CAT_PATTES_DECK } from '../model/cat-pattes-cards';
import type {
  CatPattesBotType,
  CatPattesObstacleType,
} from '../model/cat-pattes-cards';
import type { CatPattesMetadata } from '../model/cat-pattes-state.entity';

@Injectable()
export class CatPattesSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const metaSeed = (baseState.metadata ?? {}) as CatPattesMetadata;
    const rng = metaSeed.rng ?? {};
    const deck = CAT_PATTES_DECK.map((card) => card.id);
    const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rng, deck);

    let remainingDeck = [...shuffledDeck];
    const hands: Record<number, string[]> = {};
    const positions: Record<number, number> = {};
    const obstacles: Record<number, CatPattesObstacleType | null> = {};
    const bots: Record<number, CatPattesBotType[]> = {};
    const hasSun: Record<number, boolean> = {};

    for (const player of players) {
      if (!player?.id) continue;
      positions[player.id] = 0;
      obstacles[player.id] = null;
      bots[player.id] = [];
      hasSun[player.id] = false;
      const hand: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        if (!remainingDeck.length) break;
        hand.push(remainingDeck.shift()!);
      }
      hands[player.id] = hand;
    }

    const metadata: CatPattesMetadata = {
      rng: updatedRng,
      deck: remainingDeck,
      discard: [],
      hands,
      positions,
      obstacles,
      bots,
      hasSun,
      drawnPlayerId: null,
      winnerId: null,
    };

    return {
      ...baseState,
      metadata,
    };
  }
}
