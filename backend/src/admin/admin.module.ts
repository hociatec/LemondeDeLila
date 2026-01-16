import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { AdminUsersService } from './services/admin-users.service';
import { RoleDefinitionsService } from './services/role-definitions.service';
import { AdminUsersController } from './controllers/admin-users.controller';
import { HttpJwtGuard } from '../common/guards/http-jwt.guard';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { AdminWsRegistrar } from './ws/admin-ws.registrar';
import { AdminRoomsWsHandler } from './ws/admin-rooms-ws.handler';
import { AdminChatWsHandler } from './ws/admin-chat-ws.handler';
import { AdminUsersWsHandler } from './ws/admin-users-ws.handler';
import { AdminGamesWsHandler } from './ws/admin-games-ws.handler';
import { AdminBotsWsHandler } from './ws/admin-bots-ws.handler';
import { AdminRolesWsHandler } from './ws/admin-roles-ws.handler';
import { AdminLogsWsHandler } from './ws/admin-logs-ws.handler';
import { AdminBroadcastWsHandler } from './ws/admin-broadcast-ws.handler';
import { AdminClientUpdatesWsHandler } from './ws/admin-client-updates-ws.handler';
import { AdminPerfWsHandler } from './ws/admin-perf-ws.handler';
import { ValidationModule } from '../common/validation/validation.module';
import { GameRegistryModule } from '../game/engine/game-registry.module';
import { NotificationModule } from '../notification/notification.module';
import { CatalogModule } from '../catalog/catalog.module';
import { BotModule as RoomBotModule } from '../bot/bot.module';
import { BotModule as GameBotModule } from '../game/modules/bot/bot.module';
import { RoleDefinitionEntity } from './entities/role-definition.entity';
import { ClientUpdatesModule } from '../client-updates/client-updates.module';
import { ChatModule } from '../chat/chat.module';
import { RoomModule } from '../room/room.module';
import { AdminCatalogInvalidationService } from './services/admin-catalog-invalidation.service';
import { SocialModule } from '../social/social.module';
import { AdminProfileWsHandler } from './ws/admin-profile-ws.handler';
import { BugReportsModule } from '../bug-reports/bug-reports.module';
import { AdminBugReportsWsHandler } from './ws/admin-bug-reports-ws.handler';
import { AdminBugReportCommentsWsHandler } from './ws/admin-bug-report-comments-ws.handler';
import { AdminMaintenanceController } from './controllers/admin-maintenance.controller';
import { AdminMaintenanceGuard } from './guards/admin-maintenance.guard';
import { AdminMaintenanceService } from './services/admin-maintenance.service';
import { StatsModule } from '../stats/stats.module';
import { AdminStatsWsHandler } from './ws/admin-stats-ws.handler';
import { ArcheDeMnemosyneModule } from '../game/games/vents-sacres/arche-de-mnemosyne/arche-de-mnemosyne.module';
import { AdminMnemoQuizWsHandler } from './ws/admin-mnemo-quiz-ws.handler';

@Module({
  imports: [
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
  ],
  controllers: [AdminUsersController, AdminMaintenanceController],
  providers: [
    AdminCatalogInvalidationService,
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
  ],
})
export class AdminModule {
  // Force eager instantiation of the WS registrar so its `onModuleInit()` runs and
  // admin WS message types get registered in the global `WsRouteRegistry`.
  constructor(private readonly wsRegistrar: AdminWsRegistrar) {
    void this.wsRegistrar;
  }
}
