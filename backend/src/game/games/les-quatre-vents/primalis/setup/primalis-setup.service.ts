import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

import { getSafePlayers } from '../../../../setup/setup-service.helper';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import type { PrimalisBoardJsonV1 } from '../model/primalis-content.entity';
import { loadV1Content } from '../../../../setup/content-loader.helper';
import type {
  PrimalisMetadata,
  PrimalisResources,
} from '../model/primalis-state.entity';

@Injectable()
export class PrimalisSetupService {
  constructor(private readonly contentLoader: GameContentLoaderService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();

    const players = getSafePlayers(baseState);
    const positions: Record<number, number> = {};
    const collections: Record<number, PrimalisResources> = {};
    for (const player of players) {
      if (player?.id != null) {
        positions[player.id] = 0;
        collections[player.id] = this.initialResources();
      }
    }

    const metadata: PrimalisMetadata = {
      tiles: board.tiles ?? [],
      positions,
      statuses: { dangerAmplified: false },
      collections,
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

  private initialResources(): PrimalisResources {
    return {
      herbivores: 2,
      carnivores: 0,
      eggs: 0,
      leaves: 2,
    };
  }

  private loadBoard(): PrimalisBoardJsonV1 {
    return loadV1Content<PrimalisBoardJsonV1>(this.contentLoader, {
      gameType: 'primalis',
      baseDir: __dirname,
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
    });
  }
}
