import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  GaloponsBoardJsonV1,
  GaloponsCardsJsonV1,
  GaloponsMetadata,
} from '../model/galopons.types';

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

    const seedMeta = (base.metadata ?? {}) as any;
    const shuffled = this.random.shuffle(seedMeta, cards.cards ?? []);

    const meta: GaloponsMetadata = {
      tiles: board.tiles ?? [],
      positions,
      apples,
      ious: {},
      statuses: { skipTurn: {} },
      decks: { cards: shuffled.values as any, discard: [] },
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
    return this.contentLoader.loadContent<GaloponsBoardJsonV1>({
      gameType: 'galopons-ensemble',
      baseDir: __dirname,
      filename: 'board.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('tiles', 1),
      ],
    });
  }

  private loadCards(): GaloponsCardsJsonV1 {
    return this.contentLoader.loadContent<GaloponsCardsJsonV1>({
      gameType: 'galopons-ensemble',
      baseDir: __dirname,
      filename: 'cards.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cards', 1),
      ],
    });
  }
}
