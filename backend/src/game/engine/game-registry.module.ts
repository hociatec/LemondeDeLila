import { Module } from '@nestjs/common';
import { GameRegistryService } from './services/game-registry.service';
import { GameCatalogOverridesService } from './services/game-catalog-overrides.service';

@Module({
  imports: [],
  providers: [GameRegistryService, GameCatalogOverridesService],
  exports: [GameRegistryService, GameCatalogOverridesService],
})
export class GameRegistryModule {}
