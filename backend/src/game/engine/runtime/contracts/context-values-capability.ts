import type { GameRankingController } from '../kits/ranking-kit';
import type {
  GameCountersController,
  GameResourcesController,
  GameScoreController,
  GameStatusController,
} from '../kits/player-values-kit';
import type { PublicController } from './public-controller';

export interface ContextValuesCapability {
  readonly ranking: PublicController<
    GameRankingController,
    'rank' | 'tiers' | 'leaders'
  >;
  readonly score: PublicController<
    GameScoreController,
    'add' | 'get' | 'set' | 'leaders' | 'subtract' | 'ranking'
  >;
  readonly resources: PublicController<
    GameResourcesController,
    'exchange' | 'transfer' | 'add' | 'remove' | 'has' | 'get' | 'set'
  >;
  readonly counters: PublicController<
    GameCountersController,
    'add' | 'get' | 'set' | 'subtract' | 'drain'
  >;
  readonly status: PublicController<
    GameStatusController,
    'add' | 'remove' | 'has' | 'get' | 'consume' | 'list' | 'tick'
  >;
}
