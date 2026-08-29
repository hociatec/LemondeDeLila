import { GAME_MATCH_REPOSITORY } from '../application/ports/game-match.repository';
import { GameStatsService } from '../application/services/game-stats.service';
import { GameMatchTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/game-match-typeorm.repository';

export const STATS_CORE_PROVIDERS = [
  GameMatchTypeormRepository,
  {
    provide: GAME_MATCH_REPOSITORY,
    useExisting: GameMatchTypeormRepository,
  },
  GameStatsService,
];
