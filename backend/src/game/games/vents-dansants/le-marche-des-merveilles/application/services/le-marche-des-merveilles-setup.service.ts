import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { getSafePlayers } from '../../../../../core/application/helpers/setup-service.helper';
import {
  EMPTY_INVENTORY,
  INITIAL_PRICES,
  MAX_ROUNDS,
  STARTING_COINS,
  copyInventory,
} from '../../model/le-marche-des-merveilles-market';
import type { LeMarcheDesMerveillesMetadata } from '../../model/le-marche-des-merveilles-state.model';

export class LeMarcheDesMerveillesSetupService {
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const coins: Record<number, number> = {};
    const inventories: LeMarcheDesMerveillesMetadata['inventories'] = {};
    const protectedPlayers: Record<number, boolean> = {};

    for (const player of players) {
      if (player?.id == null) continue;
      coins[player.id] = STARTING_COINS;
      inventories[player.id] = copyInventory(EMPTY_INVENTORY);
      protectedPlayers[player.id] = false;
    }

    const metadata: LeMarcheDesMerveillesMetadata = {
      round: 1,
      maxRounds: MAX_ROUNDS,
      turnsTaken: 0,
      prices: { ...INITIAL_PRICES },
      coins,
      inventories,
      protectedPlayers,
      lastMarketEvent: null,
      winnerId: null,
    };

    return {
      ...baseState,
      status: 'started',
      phase: 'market',
      round: 1,
      metadata,
    };
  }
}



