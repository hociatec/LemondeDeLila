import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  VoyageBoardJsonV1,
  VoyageCardsJsonV1,
  VoyageMetadata,
} from '../model/voyage.types';

@Injectable()
export class VoyageSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const legend = this.loadCards('legend-cards.json');
    const farce = this.loadCards('farce-cards.json');
    const treasure = this.loadCards('treasure-cards.json');
    const landscape = this.loadCards('landscape-cards.json');

    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    const collections: VoyageMetadata['collections'] = {};
    for (const p of players) {
      positions[p.id] = 0;
      collections[p.id] = { legend: 0, farce: 0, treasure: 0, landscape: 0 };
    }

    const seedMeta = (base.metadata ?? {}) as any;
    const s1 = this.random.shuffle(seedMeta, legend.cards ?? []);
    const s2 = this.random.shuffle(s1.meta, farce.cards ?? []);
    const s3 = this.random.shuffle(s2.meta, treasure.cards ?? []);
    const s4 = this.random.shuffle(s3.meta, landscape.cards ?? []);

    const meta: VoyageMetadata = {
      tiles: board.tiles ?? [],
      positions,
      statuses: { skipTurn: {}, lastTargetByActor: {} },
      decks: {
        legend: { cards: s1.values as any, discard: [] },
        farce: { cards: s2.values as any, discard: [] },
        treasure: { cards: s3.values as any, discard: [] },
        landscape: { cards: s4.values as any, discard: [] },
      },
      collections,
      pendingQuiz: null,
      finishCountdown: null,
      winnerId: null,
    };

    return {
      ...base,
      phase: 'playing',
      pending: null,
      metadata: {
        ...(base.metadata ?? {}),
        ...s4.meta,
        ...meta,
      },
    };
  }

  private loadBoard(): VoyageBoardJsonV1 {
    return this.contentLoader.loadContent<VoyageBoardJsonV1>({
      gameType: 'voyage-en-terre-de-brumes',
      baseDir: __dirname,
      filename: 'board.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('tiles', 1),
      ],
    });
  }

  private loadCards(filename: string): VoyageCardsJsonV1 {
    return this.contentLoader.loadContent<VoyageCardsJsonV1>({
      gameType: 'voyage-en-terre-de-brumes',
      baseDir: __dirname,
      filename,
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cards', 1),
      ],
    });
  }
}
