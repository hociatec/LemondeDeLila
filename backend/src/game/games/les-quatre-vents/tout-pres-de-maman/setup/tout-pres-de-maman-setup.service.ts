import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  ToutPresDeMamanBoardJsonV1,
  ToutPresDeMamanCardsJsonV1,
} from '../model/tout-pres-de-maman-content.entity';
import type { ToutPresDeMamanMetadata } from '../model/tout-pres-de-maman-state.entity';

@Injectable()
export class ToutPresDeMamanSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const cards = this.loadCards();
    const players = Array.isArray(baseState.players) ? baseState.players : [];

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

    const seedMeta = (baseState.metadata ?? {}) as ToutPresDeMamanMetadata;
    const cardIds = (cards.cards ?? []).map((card) => card.id);
    const shuffle = this.random.shuffle(seedMeta as any, cardIds);

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
    return this.contentLoader.loadContent<ToutPresDeMamanBoardJsonV1>({
      gameType: 'tout-pres-de-maman',
      baseDir: __dirname,
      filename: 'board.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('tiles', 1),
      ],
    });
  }

  private loadCards(): ToutPresDeMamanCardsJsonV1 {
    return this.contentLoader.loadContent<ToutPresDeMamanCardsJsonV1>({
      gameType: 'tout-pres-de-maman',
      baseDir: __dirname,
      filename: 'cards.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cards', 1),
      ],
    });
  }
}
