import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

import { getRngMeta, getSafePlayers } from '../../../../setup/setup-service.helper';
import { RandomService } from '../../../../modules/random/services/random.service';
import { BANDE_A_BANANE_DECK } from '../model/la-bande-a-banane-cards';
import type {
  BandeABananeMetadata,
  BandeABananeTroopEntry,
} from '../model/la-bande-a-banane-state.entity';

@Injectable()
export class BandeABananeSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const metaSeed = (baseState.metadata ?? {}) as BandeABananeMetadata;
    const rngSeed = getRngMeta(metaSeed);

    const deck = BANDE_A_BANANE_DECK.map((card) => card.id);
    const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(
      rngSeed,
      deck,
    );

    let remainingDeck = [...shuffledDeck];
    const hands: Record<number, string[]> = {};
    const troops: Record<number, BandeABananeTroopEntry[]> = {};
    const skipTurn: Record<number, number> = {};

    for (const player of players) {
      if (!player?.id) continue;
      const hand: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        if (!remainingDeck.length) break;
        hand.push(remainingDeck.shift()!);
      }
      hands[player.id] = hand;
      troops[player.id] = [];
      skipTurn[player.id] = 0;
    }

    const metadata: BandeABananeMetadata = {
      rng: updatedRng,
      deck: remainingDeck,
      discard: [],
      hands,
      troops,
      statuses: {
        skipTurn,
      },
      drawnPlayerId: null,
      winnerId: null,
    };

    return {
      ...baseState,
      metadata,
    };
  }
}
