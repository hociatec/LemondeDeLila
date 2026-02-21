import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { loadV1Content } from '../../../../setup/content-loader.helper';
import type {
  GaloponsBoardJsonV1,
  GaloponsCardsJsonV1,
  GaloponsMetadata,
} from '../model/galopons.types';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class GaloponsSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const cards = this.loadCards();

    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    const apples: Record<number, number> = {};
    for (const p of players) {
      positions[p.id] = 0;
      apples[p.id] = 0;
    }

    const seedMeta = asRecord(base.metadata);
    const shuffled = this.random.shuffle(seedMeta, cards.cards ?? []);

    const meta: GaloponsMetadata = {
      tiles: board.tiles ?? [],
      positions,
      apples,
      ious: {},
      statuses: { skipTurn: {} },
      decks: { cards: shuffled.values, discard: [] },
      pendingContext: null,
      finish: {
        triggered: false,
        starterId: null,
        pendingIds: [],
        bonusGiven: false,
      },
      winnerId: null,
    };

    return {
      ...base,
      phase: 'playing',
      pending: null,
      metadata: {
        ...(base.metadata ?? {}),
        ...shuffled.meta,
        ...meta,
      },
    };
  }

  private loadBoard(): GaloponsBoardJsonV1 {
    return loadV1Content<GaloponsBoardJsonV1>(this.contentLoader, {
      gameType: 'galopons-ensemble',
      baseDir: __dirname,
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
    });
  }

  private loadCards(): GaloponsCardsJsonV1 {
    return loadV1Content<GaloponsCardsJsonV1>(this.contentLoader, {
      gameType: 'galopons-ensemble',
      baseDir: __dirname,
      filename: 'cards.json',
      arrayField: 'cards',
      minItems: 1,
    });
  }
}
