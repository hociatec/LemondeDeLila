import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameLoggerModule } from '../../game/composition-api';
import { JwksModule } from '../../platform/auth/public-api';
import { shouldIgnoreEnvironmentFile } from '../../platform/config/environment-validation';
import { validateEnvironment } from '../../platform/config/validate-environment';
import { createRateLimitOptions } from '../../platform/config/rate-limit-options.factory';
import { createDatabaseOptions } from '../../platform/database/database-options.factory';
import { ObservabilityModule } from '../../platform/observability/public-api';
import {
  RedisModule,
  RedisRateLimitStorage,
} from '../../platform/redis/public-api';
import { ValidationModule } from '../../platform/validation/public-api';
import { WsRoutingModule, WsTicketModule } from '../../platform/ws/public-api';
import { ORM_ENTITIES } from '../database/typeorm-entities';
import { LifecycleModule } from '../../platform/lifecycle/public-api';

@Module({
  imports: [
    LifecycleModule,
    GameLoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: shouldIgnoreEnvironmentFile(),
      validate: validateEnvironment,
    }),
    RedisModule,
    ObservabilityModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, RedisRateLimitStorage],
      useFactory: createRateLimitOptions,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createDatabaseOptions(config, ORM_ENTITIES),
    }),
    ValidationModule,
    WsRoutingModule,
    WsTicketModule,
    JwksModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppPlatformModule {}
