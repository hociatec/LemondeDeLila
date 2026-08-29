import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/public-api';
import { BotModule } from './bot/public-api';
import { BugReportsModule } from './bug-reports/public-api';
import { CatalogModule } from './catalog/public-api';
import { ChatModule } from './chat/public-api';
import { JwksModule } from './common/auth/public-api';
import { RedisModule } from './common/redis/public-api';
import { ValidationModule } from './common/validation/public-api';
import { WsRoutingModule, WsTicketModule } from './common/ws/public-api';
import {
  environmentValidationSchema,
  shouldIgnoreEnvironmentFile,
} from './config/environment-validation';
import { createRateLimitOptions } from './config/rate-limit-options.factory';
import { createDatabaseOptions } from './database/database-options.factory';
import { GameWsModule } from './game/core/infrastructure/presentation/ws/public-api';
import { GameLoggerModule, GameModule } from './game/public-api';
import { HealthModule } from './health/public-api';
import { MessagingModule } from './messaging/public-api';
import { NotificationModule } from './notification/public-api';
import { PresenceModule } from './presence/public-api';
import { RealtimeModule } from './realtime/public-api';
import { RoomModule } from './room/public-api';
import { SocialModule } from './social/public-api';
import { SoundsModule } from './sounds/public-api';
import { UpdateModule } from './update/public-api';
import { UserModule } from './user/public-api';
import { VaultModule } from './vault/public-api';

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
    RealtimeModule,
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
