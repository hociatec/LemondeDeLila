import { Module } from '@nestjs/common';
import { AppGameRoomPortsModule } from './app-game-room-ports.module';
import { AppBotPortsModule } from './app-bot-ports.module';
import { AppAdminBotPortsModule } from './app-admin-bot-ports.module';
import { AppAdminBugReportsPortsModule } from './app-admin-bug-reports-ports.module';
import { AppRoomVaultPortsModule } from './app-room-vault-ports.module';
import { AppRoomWorkflowPortsModule } from './app-room-workflow-ports.module';
import { AppVaultPortsModule } from './app-vault-ports.module';
import { AppPresenceReadersModule } from './app-presence-readers.module';
import { AppNotificationReadersModule } from './app-notification-readers.module';
import { GameWsModule } from '../../game/core/infrastructure/presentation/ws/public-api';
import { GameModule } from '../../game/composition-api';
import { AdminModule } from '../../modules/admin/composition-api';
import { BotModule } from '../../modules/bot/composition-api';
import { BugReportsModule } from '../../modules/bug-reports/composition-api';
import { CatalogModule } from '../../modules/catalog/composition-api';
import { ChatModule } from '../../modules/chat/composition-api';
import { HealthModule } from '../../modules/health/composition-api';
import { MessagingModule } from '../../modules/messaging/composition-api';
import { NotificationModule } from '../../modules/notification/composition-api';
import { PresenceModule } from '../../modules/presence/composition-api';
import { RoomModule } from '../../modules/room/composition-api';
import { SocialModule } from '../../modules/social/composition-api';
import { SoundsModule } from '../../modules/sounds/composition-api';
import { ClientUpdateQueryService } from '../../modules/update/public-api';
import { UpdateModule } from '../../modules/update/composition-api';
import { UserModule } from '../../modules/user/composition-api';
import { VaultModule } from '../../modules/vault/composition-api';
import { RealtimeModule } from '../../platform/realtime/public-api';

@Module({
  imports: [
    AppGameRoomPortsModule,
    AppNotificationReadersModule,
    AppPresenceReadersModule,
    AppVaultPortsModule,
    AppBotPortsModule,
    AppAdminBotPortsModule,
    AppAdminBugReportsPortsModule,
    AppRoomVaultPortsModule,
    AppRoomWorkflowPortsModule,
    UserModule,
    ChatModule,
    CatalogModule,
    MessagingModule,
    SocialModule,
    PresenceModule,
    RoomModule,
    GameModule,
    GameWsModule,
    BotModule,
    RealtimeModule.register({
      imports: [UpdateModule],
      clientVersionReader: ClientUpdateQueryService,
    }),
    NotificationModule,
    AdminModule,
    HealthModule,
    UpdateModule,
    SoundsModule,
    BugReportsModule,
    VaultModule,
  ],
})
export class AppCapabilitiesModule {}
