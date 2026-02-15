import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

import { getRngMeta, getSafePlayers } from '../../../../setup/setup-service.helper';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { loadV1Content } from '../../../../setup/content-loader.helper';
import type {
  PiratesEnVadrouilleBoardJsonV1,
  PiratesEnVadrouilleCardsJsonV1,
} from '../model/pirates-en-vadrouille-content.entity';
import type {
  PiratesEnVadrouilleCollection,
  PiratesEnVadrouilleDecks,
  PiratesEnVadrouilleDiscards,
  PiratesEnVadrouilleMetadata,
} from '../model/pirates-en-vadrouille-state.entity';

@Injectable()
export class PiratesEnVadrouilleSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const cards = this.loadCards();

    const players = getSafePlayers(baseState);
    const positions: Record<number, number> = {};
    const statuses = { skipTurn: {}, obstacleImmunity: {} };
    const collections: Record<number, PiratesEnVadrouilleCollection> = {};
    for (const player of players) {
      if (player?.id != null) {
        positions[player.id] = 0;
        statuses.skipTurn[player.id] = 0;
        statuses.obstacleImmunity[player.id] = 0;
        collections[player.id] = {
          treasures: [],
          obstacles: [],
          bonus: [],
          goldPieces: 0,
        };
      }
    }

    const seedMeta = (baseState.metadata ?? {}) as any;
    const shuffledTreasure = this.random.shuffle(
      seedMeta,
      cards.treasure ?? [],
    );
    const shuffledObstacle = this.random.shuffle(
      shuffledTreasure.meta ?? seedMeta,
      cards.obstacle ?? [],
    );
    const shuffledBonus = this.random.shuffle(
      shuffledObstacle.meta ?? seedMeta,
      cards.bonus ?? [],
    );

    const metadata: PiratesEnVadrouilleMetadata = {
      tiles: board.tiles ?? [],
      positions,
      statuses,
      decks: {
        treasure: shuffledTreasure.values as any,
        obstacle: shuffledObstacle.values as any,
        bonus: shuffledBonus.values as any,
      },
      discards: { treasure: [], obstacle: [], bonus: [] },
      collections,
      pendingContext: null,
      winnerId: null,
    };

    return {
      ...baseState,
      phase: 'playing',
      pending: null,
      metadata: {
        ...(baseState.metadata ?? {}),
        ...(shuffledTreasure.meta ?? {}),
        ...(shuffledObstacle.meta ?? {}),
        ...(shuffledBonus.meta ?? {}),
        ...metadata,
      },
    };
  }

  private loadBoard(): PiratesEnVadrouilleBoardJsonV1 {
    return loadV1Content<PiratesEnVadrouilleBoardJsonV1>(this.contentLoader, { gameType: 'pirates-en-vadrouille', baseDir: __dirname, filename: '../model/content/board.json', arrayField: 'tiles', minItems: 1 });
  }

  private loadCards(): PiratesEnVadrouilleCardsJsonV1 {
    return loadV1Content<PiratesEnVadrouilleCardsJsonV1>(this.contentLoader, {
      gameType: 'pirates-en-vadrouille',
      baseDir: __dirname,
      filename: '../model/content/cards.json',
      extraValidators: [
        this.contentLoader.validators.arrayField('treasure', 1),
        this.contentLoader.validators.arrayField('obstacle', 1),
        this.contentLoader.validators.arrayField('bonus', 1),
      ],
    });
  }
}

