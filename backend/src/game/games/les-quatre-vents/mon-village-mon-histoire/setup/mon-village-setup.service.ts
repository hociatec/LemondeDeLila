import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { loadV1Content } from '../../../../setup/content-loader.helper';
import type {
  MonVillageBoardJsonV1,
  MonVillageCardsJsonV1,
} from '../model/mon-village-content.entity';
import type {
  MonVillageCard,
  MonVillageCollection,
  MonVillageDecks,
  MonVillageDiscards,
  MonVillageMetadata,
} from '../model/mon-village-state.entity';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class MonVillageSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const cards = this.loadCards();

    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    const statuses: { skipTurn: Record<number, number> } = { skipTurn: {} };
    const collections: Record<number, MonVillageCollection> = {};
    for (const player of players) {
      if (player?.id != null) {
        positions[player.id] = 0;
        statuses.skipTurn[player.id] = 0;
        collections[player.id] = { total: 0, byZone: {} };
      }
    }

    const seedMeta = asRecord(base.metadata);
    const decks: MonVillageDecks = {};
    const discards: MonVillageDiscards = {};
    let shuffleSeed: Record<string, unknown> = seedMeta;
    for (const zone of cards.zones ?? []) {
      const zoneCards: MonVillageCard[] = (zone.cards ?? []).map((card) => ({
        ...card,
        zoneId: zone.id,
      }));
      const shuffled = this.random.shuffle(shuffleSeed, zoneCards);
      decks[zone.id] = shuffled.values;
      discards[zone.id] = [];
      shuffleSeed = { ...shuffleSeed, ...asRecord(shuffled.meta) };
    }

    const metadata: MonVillageMetadata = {
      tiles: board.tiles ?? [],
      positions,
      statuses,
      decks,
      discards,
      collections,
      pendingContext: null,
      winnerId: null,
    };

    return {
      ...base,
      phase: 'playing',
      pending: null,
      metadata: { ...(base.metadata ?? {}), ...metadata },
    };
  }

  private loadBoard(): MonVillageBoardJsonV1 {
    return loadV1Content<MonVillageBoardJsonV1>(this.contentLoader, {
      gameType: 'mon-village-mon-histoire',
      baseDir: __dirname,
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
    });
  }

  private loadCards(): MonVillageCardsJsonV1 {
    return loadV1Content<MonVillageCardsJsonV1>(this.contentLoader, {
      gameType: 'mon-village-mon-histoire',
      baseDir: __dirname,
      filename: 'cards.json',
      arrayField: 'zones',
      minItems: 1,
    });
  }
}
