import { Module } from '@nestjs/common';
import { GameWsModule } from './game/core/infrastructure/presentation/ws/public-api';
import { GameModule } from './game/public-api';
import { AdminModule } from './modules/admin/public-api';
import { BotModule } from './modules/bot/public-api';
import { BugReportsModule } from './modules/bug-reports/public-api';
import { CatalogModule } from './modules/catalog/public-api';
import { ChatModule } from './modules/chat/public-api';
import { HealthModule } from './modules/health/public-api';
import { MessagingModule } from './modules/messaging/public-api';
import { NotificationModule } from './modules/notification/public-api';
import { PresenceModule } from './modules/presence/public-api';
import { RoomModule } from './modules/room/public-api';
import { SocialModule } from './modules/social/public-api';
import { SoundsModule } from './modules/sounds/public-api';
import { UpdateModule, UpdatePolicyService } from './modules/update/public-api';
import { UserModule } from './modules/user/public-api';
import { VaultModule } from './modules/vault/public-api';
import { RealtimeModule } from './platform/realtime/public-api';

@Module({
  imports: [
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
      clientVersionPolicy: UpdatePolicyService,
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
