import { Module } from '@nestjs/common';
import { GameRegistryService } from './services/game-registry.service';

@Module({
  imports: [],
  providers: [GameRegistryService],
  exports: [GameRegistryService],
})
export class GameRegistryModule {}
