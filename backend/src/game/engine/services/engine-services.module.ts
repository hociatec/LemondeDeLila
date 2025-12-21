import { Module } from '@nestjs/common';
import { GameContentLoaderService } from './game-content-loader.service';

/**
 * Module for engine utility services that can be imported independently
 * without creating circular dependencies.
 */
@Module({
  providers: [GameContentLoaderService],
  exports: [GameContentLoaderService],
})
export class EngineServicesModule {}
