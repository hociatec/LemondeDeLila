import { PerfMetricsService } from '../../../../common/observability/public-api';
import { GameLoggerService } from './game-logger.service';

export const GAME_LOGGER_CORE_PROVIDERS = [
  GameLoggerService,
  PerfMetricsService,
];
