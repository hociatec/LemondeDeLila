import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import { getSafePlayers } from '../../../../../application/helpers/setup-service.helper';
import { GameContentLoaderService } from '../../../../../engine/public-api';
import { RandomService } from '../../../../../application/services/random.service';
import type {
  ToutPresDeMamanBoardJsonV1,
  ToutPresDeMamanCardsJsonV1,
} from '../../model/tout-pres-de-maman-content.model';
import type { ToutPresDeMamanMetadata } from '../../model/tout-pres-de-maman-state.model';
import { loadV1Content } from '../../../../../application/helpers/content-loader.helper';

type ToutPresDeMamanRuntimeMetadata = ToutPresDeMamanMetadata &
  Record<string, unknown>;

export class ToutPresDeMamanSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const cards = this.loadCards();
    const players = getSafePlayers(baseState);

    const positions: Record<number, number> = {};
    const tokens: Record<number, number> = {};
    const skipTurn: Record<number, number> = {};
    const bonusReroll: Record<number, boolean> = {};

    for (const player of players) {
      if (player?.id == null) continue;
      positions[player.id] = 0;
      tokens[player.id] = 2;
      skipTurn[player.id] = 0;
      bonusReroll[player.id] = false;
    }

    const seedMeta = this.getRuntimeMeta(baseState);
    const cardIds = (cards.cards ?? []).map((card) => card.id);
    const shuffle = this.random.shuffle(seedMeta, cardIds);

    const metadata: ToutPresDeMamanMetadata = {
      ...seedMeta,
      ...shuffle.meta,
      tiles: board.tiles ?? [],
      cards: cards.cards ?? [],
      deckCards: shuffle.values,
      discardCards: [],
      positions,
      tokens,
      statuses: {
        skipTurn,
        bonusReroll,
      },
      pendingContext: null,
      winnerId: null,
    };

    return {
      ...baseState,
      phase: 'playing',
      pending: null,
      metadata: { ...(baseState.metadata ?? {}), ...metadata },
    };
  }

  private loadBoard(): ToutPresDeMamanBoardJsonV1 {
    return loadV1Content<ToutPresDeMamanBoardJsonV1>(this.contentLoader, {
      gameType: 'tout-pres-de-maman',
      baseDir: __dirname,
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
    });
  }

  private loadCards(): ToutPresDeMamanCardsJsonV1 {
    return loadV1Content<ToutPresDeMamanCardsJsonV1>(this.contentLoader, {
      gameType: 'tout-pres-de-maman',
      baseDir: __dirname,
      filename: 'cards.json',
      arrayField: 'cards',
      minItems: 1,
    });
  }

  private getRuntimeMeta(
    state: GameStateEntity,
  ): ToutPresDeMamanRuntimeMetadata {
    return (state.metadata ?? {}) as ToutPresDeMamanRuntimeMetadata;
  }
}





