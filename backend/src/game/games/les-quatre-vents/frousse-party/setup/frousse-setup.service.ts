import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  FrousseBoardJsonV1,
  FrousseCardsJsonV1,
  FrousseMetadata,
} from '../model/frousse.types';

@Injectable()
export class FrousseSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const cards = this.loadCards();

    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    for (const p of players) positions[p.id] = 0;

    const seedMeta = (base.metadata ?? {}) as any;
    const shuffled = this.random.shuffle(seedMeta, cards.cards ?? []);

    const meta: FrousseMetadata = {
      tiles: board.tiles ?? [],
      positions,
      statuses: {
        skipTurn: {},
        ignoreNextTrap: {},
        ignoreNextPrank: {},
        ignoreNextGhost: {},
        nextMoveCap: {},
        nextRollMalus: {},
        nextRollKeepLowest: {},
        nextRollDouble: {},
        nextRollIfThreeBackTwo: {},
        blocked: {},
      },
      decks: { cards: shuffled.values as any, discard: [] },
      pendingContext: null,
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

  private loadBoard(): FrousseBoardJsonV1 {
    return this.contentLoader.loadContent<FrousseBoardJsonV1>({
      gameType: 'frousse-party',
      baseDir: __dirname,
      filename: 'board.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('tiles', 1),
      ],
    });
  }

  private loadCards(): FrousseCardsJsonV1 {
    return this.contentLoader.loadContent<FrousseCardsJsonV1>({
      gameType: 'frousse-party',
      baseDir: __dirname,
      filename: 'cards.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cards', 1),
      ],
    });
  }
}
