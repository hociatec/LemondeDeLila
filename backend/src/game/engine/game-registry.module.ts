import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameCatalogOverrideEntity } from './entities/game-catalog-override.entity';
import { GameCategoryAssignmentEntity } from './entities/game-category-assignment.entity';
import { GameCategoryEntity } from './entities/game-category.entity';
import { GameRegistryService } from './services/game-registry.service';
import { GameCatalogOverridesService } from './services/game-catalog-overrides.service';
import { GameCategoriesService } from './services/game-categories.service';
import { GameCategoriesFsMirrorService } from './services/game-categories-fs-mirror.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GameCategoryEntity,
      GameCategoryAssignmentEntity,
      GameCatalogOverrideEntity,
    ]),
  ],
  providers: [
    GameRegistryService,
    GameCatalogOverridesService,
    GameCategoriesService,
    GameCategoriesFsMirrorService,
  ],
  exports: [
    GameRegistryService,
    GameCatalogOverridesService,
    GameCategoriesService,
  ],
})
export class GameRegistryModule {}
