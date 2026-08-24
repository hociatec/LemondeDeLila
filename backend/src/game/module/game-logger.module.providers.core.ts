import { PerfMetricsService } from '../../common/observability/application/services/perf-metrics.service';
import { GameLoggerService } from '../infrastructure/logging/game-logger.service';

export const GAME_LOGGER_CORE_PROVIDERS = [
  GameLoggerService,
  PerfMetricsService,
];
