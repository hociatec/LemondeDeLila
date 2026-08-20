import { CatalogService } from '../../catalog/services/catalog.service';
import { ChatSettingsService } from '../../chat/services/chat-settings.service';
import { ChatService } from '../../chat/services/chat.service';
import { ClientUpdatesService } from '../../client-updates/services/client-updates.service';
import { HttpJwtGuard } from '../../common/guards/http-jwt.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { PerfMetricsService } from '../../common/services/perf-metrics.service';
import { GameCategoriesService } from '../../game/engine/services/game-categories.service';
import { GameCatalogOverridesService } from '../../game/engine/services/game-catalog-overrides.service';
import { GameRegistryService } from '../../game/engine/services/game-registry.service';
import { NotificationService } from '../../notification/services/notification.service';
import { RoomMaintenanceSettingsService } from '../../room/services/room-maintenance-settings.service';
import { RoomService } from '../../room/services/room.service';
import { SocialProfileSettingsService } from '../../social/services/social-profile-settings.service';
import { GameStatsService } from '../../stats/services/game-stats.service';
import { AdminCatalogInvalidationService } from '../application/services/admin-catalog-invalidation.service';
import { ADMIN_CATALOG_CACHE_PORT } from '../application/ports/admin-catalog-cache.port';
import {
  ADMIN_CHAT_PORT,
  ADMIN_CHAT_SETTINGS_PORT,
} from '../application/ports/admin-chat.port';
import { ADMIN_CLIENT_UPDATES_PORT } from '../application/ports/admin-client-updates.port';
import { ADMIN_GAME_CATEGORIES_PORT } from '../application/ports/admin-game-categories.port';
import { ADMIN_GAME_OVERRIDES_PORT } from '../application/ports/admin-game-overrides.port';
import { ADMIN_GAME_REGISTRY_PORT } from '../application/ports/admin-game-registry.port';
import { ADMIN_LOGS_CONFIG_PORT } from '../application/ports/admin-logs-config.port';
import { ADMIN_MAINTENANCE_RUNTIME_PORT } from '../application/ports/admin-maintenance-runtime.port';
import { ADMIN_NOTIFICATION_PORT } from '../application/ports/admin-notification.port';
import { ADMIN_PERF_PORT } from '../application/ports/admin-perf.port';
import { ADMIN_PROFILE_SETTINGS_PORT } from '../application/ports/admin-profile-settings.port';
import {
  ADMIN_ROOMS_PORT,
  ADMIN_ROOM_SETTINGS_PORT,
} from '../application/ports/admin-room.port';
import { ADMIN_STATS_PORT } from '../application/ports/admin-stats.port';
import { ADMIN_USER_REPOSITORY } from '../application/ports/admin-user.repository';
import { ROLE_DEFINITION_REPOSITORY } from '../application/ports/role-definition.repository';
import { AdminLogsConfigService } from '../infrastructure/config/admin-logs-config.service';
import { AdminMaintenanceGuard } from '../infrastructure/presentation/http/guards/admin-maintenance.guard';
import { AdminUserTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/admin-user-typeorm.repository';
import { RoleDefinitionTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/role-definition-typeorm.repository';
import { AdminMaintenanceRuntimeService } from '../infrastructure/system/admin-maintenance-runtime.service';

export const ADMIN_CORE_PROVIDERS = [
  AdminUserTypeormRepository,
  RoleDefinitionTypeormRepository,
  {
    provide: ADMIN_USER_REPOSITORY,
    useExisting: AdminUserTypeormRepository,
  },
  {
    provide: ROLE_DEFINITION_REPOSITORY,
    useExisting: RoleDefinitionTypeormRepository,
  },
  {
    provide: ADMIN_MAINTENANCE_RUNTIME_PORT,
    useExisting: AdminMaintenanceRuntimeService,
  },
  {
    provide: ADMIN_NOTIFICATION_PORT,
    useExisting: NotificationService,
  },
  {
    provide: ADMIN_CLIENT_UPDATES_PORT,
    useExisting: ClientUpdatesService,
  },
  {
    provide: ADMIN_CHAT_PORT,
    useExisting: ChatService,
  },
  {
    provide: ADMIN_CHAT_SETTINGS_PORT,
    useExisting: ChatSettingsService,
  },
  {
    provide: ADMIN_GAME_REGISTRY_PORT,
    useExisting: GameRegistryService,
  },
  {
    provide: ADMIN_GAME_CATEGORIES_PORT,
    useExisting: GameCategoriesService,
  },
  {
    provide: ADMIN_GAME_OVERRIDES_PORT,
    useExisting: GameCatalogOverridesService,
  },
  {
    provide: ADMIN_CATALOG_CACHE_PORT,
    useExisting: CatalogService,
  },
  {
    provide: ADMIN_STATS_PORT,
    useExisting: GameStatsService,
  },
  {
    provide: ADMIN_PERF_PORT,
    useExisting: PerfMetricsService,
  },
  {
    provide: ADMIN_ROOMS_PORT,
    useExisting: RoomService,
  },
  {
    provide: ADMIN_ROOM_SETTINGS_PORT,
    useExisting: RoomMaintenanceSettingsService,
  },
  {
    provide: ADMIN_PROFILE_SETTINGS_PORT,
    useExisting: SocialProfileSettingsService,
  },
  {
    provide: ADMIN_LOGS_CONFIG_PORT,
    useExisting: AdminLogsConfigService,
  },
  AdminCatalogInvalidationService,
  HttpJwtGuard,
  AdminRoleGuard,
  AdminMaintenanceGuard,
  AdminLogsConfigService,
  AdminMaintenanceRuntimeService,
];
