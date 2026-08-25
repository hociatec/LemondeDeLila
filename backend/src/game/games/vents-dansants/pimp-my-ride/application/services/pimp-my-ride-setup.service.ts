import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';

import { getSafePlayers } from '../../../../../core/application/helpers/setup-service.helper';
import { RandomService } from '../../../../../core/application/services/random.service';
import { PIMP_MY_RIDE_DECK } from '../../model/pimp-my-ride-cards';
import type {
  PimpMyRideMetadata,
  PimpMyRidePlayerProgress,
} from '../../model/pimp-my-ride-state.model';

export class PimpMyRideSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const rngSeed = (baseState.metadata ?? {}) as PimpMyRideMetadata;
    const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(
      rngSeed.rng ?? {},
      PIMP_MY_RIDE_DECK.map((card) => card.id),
    );

    const remaining = [...shuffledDeck];
    const hands: Record<number, string[]> = {};
    const progress: Record<number, PimpMyRidePlayerProgress> = {};

    for (const player of players) {
      if (!player?.id) continue;
      const hand: string[] = [];
      for (let i = 0; i < 3 && remaining.length; i += 1) {
        hand.push(remaining.shift()!);
      }
      hands[player.id] = hand;
      progress[player.id] = {
        stageIndex: 0,
        carParts: [],
        completedCars: [],
      };
    }

    const metadata: PimpMyRideMetadata = {
      rng: updatedRng,
      deck: remaining,
      discard: [],
      hands,
      progress,
      drawnPlayerId: null,
      drawnCardId: null,
      carNameIndex: 0,
      winnerId: null,
    };

    return {
      ...baseState,
      metadata,
    };
  }
}




