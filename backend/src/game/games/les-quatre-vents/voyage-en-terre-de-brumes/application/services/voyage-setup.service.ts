import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { GameContentLoaderService } from '../../../../../engine/public-api';
import { RandomService } from '../../../../../application/services/random.service';
import { loadV1Content } from '../../../../../application/helpers/content-loader.helper';
import type {
  VoyageBoardJsonV1,
  VoyageCardsJsonV1,
  VoyageMetadata,
} from '../../model/voyage.types';

type VoyageRuntimeMetadata = VoyageMetadata & Record<string, unknown>;

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

    const seedMeta = this.getRuntimeMeta(base);
    const s1 = this.random.shuffle(seedMeta, legend.cards ?? []);
    const s2 = this.random.shuffle(s1.meta, farce.cards ?? []);
    const s3 = this.random.shuffle(s2.meta, treasure.cards ?? []);
    const s4 = this.random.shuffle(s3.meta, landscape.cards ?? []);

    const meta: VoyageMetadata = {
      tiles: board.tiles ?? [],
      positions,
      statuses: { skipTurn: {}, lastTargetByActor: {} },
      decks: {
        legend: { cards: s1.values, discard: [] },
        farce: { cards: s2.values, discard: [] },
        treasure: { cards: s3.values, discard: [] },
        landscape: { cards: s4.values, discard: [] },
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
    return loadV1Content<VoyageBoardJsonV1>(this.contentLoader, {
      gameType: 'voyage-en-terre-de-brumes',
      baseDir: __dirname,
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
    });
  }

  private loadCards(filename: string): VoyageCardsJsonV1 {
    return loadV1Content<VoyageCardsJsonV1>(this.contentLoader, {
      gameType: 'voyage-en-terre-de-brumes',
      baseDir: __dirname,
      filename,
      arrayField: 'cards',
      minItems: 1,
    });
  }

  private getRuntimeMeta(state: GameStateEntity): VoyageRuntimeMetadata {
    return (state.metadata ?? {}) as VoyageRuntimeMetadata;
  }
}





