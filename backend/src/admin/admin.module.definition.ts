import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { ValidationModule } from '../common/validation/validation.module';
import { GameRegistryModule } from '../game/engine/game-registry.module';
import { NotificationModule } from '../notification/notification.module';
import { CatalogModule } from '../catalog/catalog.module';
import { BotModule as RoomBotModule } from '../bot/bot.module';
import { BotModule as GameBotModule } from '../game/modules/bot/bot.module';
import { RoleDefinitionEntity } from './infrastructure/persistence/typeorm/entities/role-definition.entity';
import { AdminUserTypeormRepository } from './infrastructure/persistence/typeorm/repositories/admin-user-typeorm.repository';
import { ClientUpdatesModule } from '../client-updates/client-updates.module';
import { ChatModule } from '../chat/chat.module';
import { RoomModule } from '../room/room.module';
import { SocialModule } from '../social/social.module';
import { BugReportsModule } from '../bug-reports/bug-reports.module';
import { StatsModule } from '../stats/stats.module';
import { ArcheDeMnemosyneModule } from '../game/games/vents-infinis/arche-de-mnemosyne/arche-de-mnemosyne.module';
import { AdminUsersController } from './infrastructure/presentation/http/controllers/admin-users.controller';
import { AdminMaintenanceController } from './infrastructure/presentation/http/controllers/admin-maintenance.controller';
import { AdminCatalogInvalidationService } from './application/services/admin-catalog-invalidation.service';
import { AdminUsersService } from './application/services/admin-users.service';
import { RoleDefinitionsService } from './application/services/role-definitions.service';
import { AdminUsersQueryService } from './application/use-cases/admin-users/admin-users-query.service';
import { AdminUsersCommandService } from './application/use-cases/admin-users/admin-users-command.service';
import { ADMIN_USER_REPOSITORY } from './application/ports/admin-user.repository';
import { HttpJwtGuard } from '../common/guards/http-jwt.guard';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { AdminMaintenanceGuard } from './infrastructure/presentation/http/guards/admin-maintenance.guard';
import { AdminMaintenanceService } from './application/services/admin-maintenance.service';
import { AdminRoomsWsHandler } from './infrastructure/presentation/ws/admin-rooms-ws.handler';
import { AdminChatWsHandler } from './infrastructure/presentation/ws/admin-chat-ws.handler';
import { AdminUsersWsHandler } from './infrastructure/presentation/ws/admin-users-ws.handler';
import { AdminGamesWsHandler } from './infrastructure/presentation/ws/admin-games-ws.handler';
import { AdminBotsWsHandler } from './infrastructure/presentation/ws/admin-bots-ws.handler';
import { AdminRolesWsHandler } from './infrastructure/presentation/ws/admin-roles-ws.handler';
import { AdminLogsWsHandler } from './infrastructure/presentation/ws/admin-logs-ws.handler';
import { AdminBroadcastWsHandler } from './infrastructure/presentation/ws/admin-broadcast-ws.handler';
import { AdminClientUpdatesWsHandler } from './infrastructure/presentation/ws/admin-client-updates-ws.handler';
import { AdminPerfWsHandler } from './infrastructure/presentation/ws/admin-perf-ws.handler';
import { AdminProfileWsHandler } from './infrastructure/presentation/ws/admin-profile-ws.handler';
import { AdminBugReportsWsHandler } from './infrastructure/presentation/ws/admin-bug-reports-ws.handler';
import { AdminBugReportCommentsWsHandler } from './infrastructure/presentation/ws/admin-bug-report-comments-ws.handler';
import { AdminStatsWsHandler } from './infrastructure/presentation/ws/admin-stats-ws.handler';
import { AdminMnemoQuizWsHandler } from './infrastructure/presentation/ws/admin-mnemo-quiz-ws.handler';
import { AdminWsRegistrar } from './infrastructure/presentation/ws/admin-ws.registrar';

export const ADMIN_MODULE_IMPORTS = [
  TypeOrmModule.forFeature([User, RoleDefinitionEntity]),
  ValidationModule,
  GameRegistryModule,
  ArcheDeMnemosyneModule,
  NotificationModule,
  ClientUpdatesModule,
  ChatModule,
  CatalogModule,
  RoomBotModule,
  GameBotModule,
  RoomModule,
  SocialModule,
  BugReportsModule,
  StatsModule,
];

export const ADMIN_MODULE_CONTROLLERS = [
  AdminUsersController,
  AdminMaintenanceController,
];

export const ADMIN_MODULE_PROVIDERS = [
  AdminCatalogInvalidationService,
  AdminUserTypeormRepository,
  {
    provide: ADMIN_USER_REPOSITORY,
    useExisting: AdminUserTypeormRepository,
  },
  AdminUsersQueryService,
  AdminUsersCommandService,
  AdminUsersService,
  RoleDefinitionsService,
  HttpJwtGuard,
  AdminRoleGuard,
  AdminMaintenanceGuard,
  AdminMaintenanceService,
  AdminRoomsWsHandler,
  AdminChatWsHandler,
  AdminUsersWsHandler,
  AdminGamesWsHandler,
  AdminBotsWsHandler,
  AdminRolesWsHandler,
  AdminLogsWsHandler,
  AdminBroadcastWsHandler,
  AdminClientUpdatesWsHandler,
  AdminPerfWsHandler,
  AdminProfileWsHandler,
  AdminBugReportsWsHandler,
  AdminBugReportCommentsWsHandler,
  AdminStatsWsHandler,
  AdminMnemoQuizWsHandler,
  AdminWsRegistrar,
];

