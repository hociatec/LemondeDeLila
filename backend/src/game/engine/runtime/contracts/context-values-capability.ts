import type { GameRankingController } from '../kits/ranking-kit';
import type {
  GameCountersController,
  GameResourcesController,
  GameScoreController,
  GameStatusController,
} from '../kits/player-values-kit';
import type { PublicController } from './public-controller';

export interface ContextValuesCapability {
  readonly ranking: PublicController<GameRankingController>;
  readonly score: PublicController<GameScoreController>;
  readonly resources: PublicController<GameResourcesController>;
  readonly counters: PublicController<GameCountersController>;
  readonly status: PublicController<GameStatusController>;
}
