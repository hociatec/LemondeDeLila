import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import { getSafePlayers } from '../../../../../application/helpers/setup-service.helper';
import { GameContentLoaderService } from '../../../../../engine/public-api';
import { RandomService } from '../../../../../application/services/random.service';
import { loadV1Content } from '../../../../../application/helpers/content-loader.helper';
import type {
  PiratesEnVadrouilleBoardJsonV1,
  PiratesEnVadrouilleCardsJsonV1,
} from '../../model/pirates-en-vadrouille-content.model';
import type {
  PiratesEnVadrouilleCollection,
  PiratesEnVadrouilleMetadata,
} from '../../model/pirates-en-vadrouille-state.model';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

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

    const seedMeta = asRecord(baseState.metadata);
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
        treasure: shuffledTreasure.values,
        obstacle: shuffledObstacle.values,
        bonus: shuffledBonus.values,
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
    return loadV1Content<PiratesEnVadrouilleBoardJsonV1>(this.contentLoader, {
      gameType: 'pirates-en-vadrouille',
      baseDir: __dirname,
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
    });
  }

  private loadCards(): PiratesEnVadrouilleCardsJsonV1 {
    return loadV1Content<PiratesEnVadrouilleCardsJsonV1>(this.contentLoader, {
      gameType: 'pirates-en-vadrouille',
      baseDir: __dirname,
      filename: 'cards.json',
      extraValidators: [
        this.contentLoader.validators.arrayField('treasure', 1),
        this.contentLoader.validators.arrayField('obstacle', 1),
        this.contentLoader.validators.arrayField('bonus', 1),
      ],
    });
  }
}








