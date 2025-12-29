import { Module } from '@nestjs/common';
import { GameRegistryService } from './services/game-registry.service';
import { GameCatalogOverridesService } from './services/game-catalog-overrides.service';
import { GameCategoriesService } from './services/game-categories.service';

@Module({
  imports: [],
  providers: [GameRegistryService, GameCatalogOverridesService, GameCategoriesService],
  exports: [GameRegistryService, GameCatalogOverridesService, GameCategoriesService],
})
export class GameRegistryModule {}
