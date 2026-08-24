import { Global, Module } from '@nestjs/common';

import { GameLoggerService } from '../infrastructure/logging/game-logger.service';
import { PerfMetricsService } from '../../common/observability/application/services/perf-metrics.service';
import { GAME_LOGGER_CORE_PROVIDERS } from './game-logger.module.providers.core';

@Global()
@Module({
  providers: GAME_LOGGER_CORE_PROVIDERS,
  exports: [GameLoggerService, PerfMetricsService],
})
export class GameLoggerModule {}
