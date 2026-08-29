import { PerfMetricsService } from '../../../../platform/observability/public-api';
import { GameLoggerService } from './game-logger.service';

export const GAME_LOGGER_CORE_PROVIDERS = [
  GameLoggerService,
  PerfMetricsService,
];
