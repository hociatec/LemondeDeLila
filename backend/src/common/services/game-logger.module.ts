import { Module, Global } from '@nestjs/common';
import { GameLoggerService } from './game-logger.service';
import { PerfMetricsService } from './perf-metrics.service';

/**
 * Global module for game logging
 * Available throughout the application without explicit imports
 */
@Global()
@Module({
  providers: [GameLoggerService, PerfMetricsService],
  exports: [GameLoggerService, PerfMetricsService],
})
export class GameLoggerModule {}
