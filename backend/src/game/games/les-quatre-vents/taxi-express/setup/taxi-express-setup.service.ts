import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

import { getSafePlayers } from '../../../../setup/setup-service.helper';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  TaxiExpressBoardJsonV1,
  TaxiExpressClientsJsonV1,
  TaxiExpressEventsJsonV1,
} from '../model/taxi-content.entity';
import type { TaxiExpressMetadata } from '../model/taxi-state.entity';
import { loadV1Content } from '../../../../setup/content-loader.helper';

type TaxiExpressRuntimeMetadata = TaxiExpressMetadata & Record<string, unknown>;

@Injectable()
export class TaxiExpressSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const clients = this.loadClients();
    const events = this.loadEvents();

    const players = getSafePlayers(baseState);
    const positions: Record<number, number> = {};
    const statuses: Record<number, number> = {};
    const completedTrips: Record<number, number> = {};
    const activeClients: Record<number, number | null> = {};

    for (const player of players) {
      if (player?.id == null) continue;
      positions[player.id] = 0;
      statuses[player.id] = 0;
      completedTrips[player.id] = 0;
      activeClients[player.id] = null;
    }

    const seedMeta = this.getRuntimeMeta(baseState);
    const clientIds = (clients.cards ?? []).map((card) => card.id);
    const firstShuffle = this.random.shuffle(seedMeta, clientIds);
    let meta: TaxiExpressMetadata = {
      ...seedMeta,
      ...firstShuffle.meta,
      tiles: board.tiles ?? [],
      clients: clients.cards ?? [],
      events: events.cards ?? [],
      deckClients: firstShuffle.values,
      discardClients: [],
      deckEvents: [],
      discardEvents: [],
      positions,
      activeClients,
      completedTrips,
      blockedTileId: null,
      lastEventId: null,
      eventTurnPlayerId: null,
      statuses: { skipTurn: statuses },
      pendingContext: null,
      winnerId: null,
    };

    const eventIds = (events.cards ?? []).map((card) => card.id);
    const eventShuffle = this.random.shuffle(meta, eventIds);
    meta = {
      ...meta,
      ...eventShuffle.meta,
      deckEvents: eventShuffle.values,
      discardEvents: [],
    };

    return {
      ...baseState,
      phase: 'playing',
      pending: null,
      metadata: { ...(baseState.metadata ?? {}), ...meta },
    };
  }

  private loadBoard(): TaxiExpressBoardJsonV1 {
    return loadV1Content<TaxiExpressBoardJsonV1>(this.contentLoader, {
      gameType: 'taxi-express',
      baseDir: __dirname,
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
    });
  }

  private loadClients(): TaxiExpressClientsJsonV1 {
    return loadV1Content<TaxiExpressClientsJsonV1>(this.contentLoader, {
      gameType: 'taxi-express',
      baseDir: __dirname,
      filename: 'clients.json',
      arrayField: 'cards',
      minItems: 1,
    });
  }

  private loadEvents(): TaxiExpressEventsJsonV1 {
    return loadV1Content<TaxiExpressEventsJsonV1>(this.contentLoader, {
      gameType: 'taxi-express',
      baseDir: __dirname,
      filename: 'events.json',
      arrayField: 'cards',
      minItems: 1,
    });
  }

  private getRuntimeMeta(state: GameStateEntity): TaxiExpressRuntimeMetadata {
    return (state.metadata ?? {}) as TaxiExpressRuntimeMetadata;
  }
}
