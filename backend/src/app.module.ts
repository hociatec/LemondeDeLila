import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './modules/admin/public-api';
import { BotModule } from './modules/bot/public-api';
import { BugReportsModule } from './modules/bug-reports/public-api';
import { CatalogModule } from './modules/catalog/public-api';
import { ChatModule } from './modules/chat/public-api';
import { JwksModule } from './platform/auth/public-api';
import { RedisModule } from './platform/redis/public-api';
import { ValidationModule } from './platform/validation/public-api';
import { WsRoutingModule, WsTicketModule } from './platform/ws/public-api';
import {
  environmentValidationSchema,
  shouldIgnoreEnvironmentFile,
} from './platform/config/environment-validation';
import { createRateLimitOptions } from './platform/config/rate-limit-options.factory';
import { createDatabaseOptions } from './platform/database/database-options.factory';
import { GameWsModule } from './game/core/infrastructure/presentation/ws/public-api';
import { GameLoggerModule, GameModule } from './game/public-api';
import { HealthModule } from './modules/health/public-api';
import { MessagingModule } from './modules/messaging/public-api';
import { NotificationModule } from './modules/notification/public-api';
import { PresenceModule } from './modules/presence/public-api';
import { RealtimeModule } from './platform/realtime/public-api';
import { RoomModule } from './modules/room/public-api';
import { SocialModule } from './modules/social/public-api';
import { SoundsModule } from './modules/sounds/public-api';
import { UpdateModule, UpdatePolicyService } from './modules/update/public-api';
import { UserModule } from './modules/user/public-api';
import { VaultModule } from './modules/vault/public-api';

@Module({
  imports: [
    GameLoggerModule,
    RedisModule,
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: shouldIgnoreEnvironmentFile(),
      validationSchema: environmentValidationSchema,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createRateLimitOptions,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createDatabaseOptions,
    }),
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
    WsRoutingModule,
    ValidationModule,
    RealtimeModule.register({
      imports: [UpdateModule],
      clientVersionPolicy: UpdatePolicyService,
    }),
    NotificationModule,
    AdminModule,
    HealthModule,
    UpdateModule,
    SoundsModule,
    WsTicketModule,
    JwksModule,
    BugReportsModule,
    VaultModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
