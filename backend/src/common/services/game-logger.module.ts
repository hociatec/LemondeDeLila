import { Module, Global } from '@nestjs/common';
import { GameLoggerService } from './game-logger.service';

/**
 * Global module for game logging
 * Available throughout the application without explicit imports
 */
@Global()
@Module({
  providers: [GameLoggerService],
  exports: [GameLoggerService],
})
export class GameLoggerModule {}
