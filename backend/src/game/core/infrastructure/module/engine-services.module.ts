import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GAME_CATALOG_READER } from '../../application/ports/game-catalog.reader';
import { GameContentService } from '../../application/services/game-content.service';
import { GameEngineService } from '../../application/services/game-engine.service';
import { GAME_CATALOG_OVERRIDES_REPOSITORY } from '../../../engine/application/ports/game-catalog-overrides.repository';
import { GAME_CATEGORIES_REPOSITORY } from '../../../engine/application/ports/game-categories.repository';
import { GameCatalogOverridesService } from '../../../engine/application/services/game-catalog-overrides.service';
import { GameCategoriesService } from '../../../engine/application/services/game-categories.service';
import { GameCategoryAssignmentEntity } from '../../../engine/infrastructure/persistence/typeorm/entities/game-category-assignment.entity';
import { GameCatalogOverridesTypeormRepository } from '../../../engine/infrastructure/persistence/typeorm/repositories/game-catalog-overrides-typeorm.repository';
import { GameCategoriesTypeormRepository } from '../../../engine/infrastructure/persistence/typeorm/repositories/game-categories-typeorm.repository';
import { GameCategoryEntity } from '../../../engine/infrastructure/persistence/typeorm/entities/game-category.entity';
import { GameCatalogOverrideEntity } from '../../../engine/infrastructure/persistence/typeorm/entities/game-catalog-override.entity';
import { FilesystemGameCatalogReader } from '../system/filesystem-game-catalog.reader';
import { GameSessionTypeormStore } from '../persistence/typeorm/repositories/game-session-typeorm.store';
import { GameSessionEntity } from '../persistence/typeorm/entities/game-session.entity';
import { GameSessionEventEntity } from '../persistence/typeorm/entities/game-session-event.entity';
import { GameSessionSnapshotEntity } from '../persistence/typeorm/entities/game-session-snapshot.entity';
import { GAME_STATE_STORE } from '../../application/ports/game-state-store.port';
import { GAME_EVENT_STORE } from '../../application/ports/game-event-store.port';
import { GameEngineMetricsService } from '../../application/services/game-engine-metrics.service';
import { GameActiveSessionsMetrics } from '../persistence/typeorm/game-active-sessions.metrics';
import { MysqlGameActiveSessionsReader } from '../persistence/typeorm/mysql-game-active-sessions.reader';
import { GAME_SESSION_RECOVERY_READER } from '../../application/ports/game-session-recovery.reader';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GameCategoryEntity,
      GameCategoryAssignmentEntity,
      GameCatalogOverrideEntity,
      GameSessionEntity,
      GameSessionEventEntity,
      GameSessionSnapshotEntity,
    ]),
  ],
  providers: [
    FilesystemGameCatalogReader,
    {
      provide: GAME_CATALOG_READER,
      useExisting: FilesystemGameCatalogReader,
    },
    GameContentService,
    GameSessionTypeormStore,
    {
      provide: GAME_STATE_STORE,
      useExisting: GameSessionTypeormStore,
    },
    {
      provide: GAME_EVENT_STORE,
      useExisting: GameSessionTypeormStore,
    },
    GameEngineService,
    GameEngineMetricsService,
    GameActiveSessionsMetrics,
    MysqlGameActiveSessionsReader,
    {
      provide: GAME_SESSION_RECOVERY_READER,
      useExisting: MysqlGameActiveSessionsReader,
    },
    GameCatalogOverridesTypeormRepository,
    GameCategoriesTypeormRepository,
    {
      provide: GAME_CATALOG_OVERRIDES_REPOSITORY,
      useExisting: GameCatalogOverridesTypeormRepository,
    },
    {
      provide: GAME_CATEGORIES_REPOSITORY,
      useExisting: GameCategoriesTypeormRepository,
    },
    GameCatalogOverridesService,
    GameCategoriesService,
  ],
  exports: [
    GAME_SESSION_RECOVERY_READER,
    GAME_CATALOG_READER,
    GameContentService,
    GameEngineService,
    GameEngineMetricsService,
    GameCatalogOverridesService,
    GameCategoriesService,
  ],
})
export class EngineServicesModule {}
