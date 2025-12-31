import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as Joi from 'joi';
import { ORM_ENTITIES } from './database/entities';
import { UserModule } from './user/user.module';
import { ChatModule } from './chat/chat.module';
import { CatalogModule } from './catalog/catalog.module';
import { MessagingModule } from './messaging/messaging.module';
import { PresenceModule } from './presence/presence.module';
import { RoomModule } from './room/room.module';
import { GameModule } from './game/game.module';
import { BotModule } from './bot/bot.module';
import { AdminModule } from './admin/admin.module';
import { SocialModule } from './social/social.module';
import { WsRoutingModule } from './common/ws/ws-routing.module';
import { ValidationModule } from './common/validation/validation.module';
import { GameWsModule } from './game/ws/game-ws.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationModule } from './notification/notification.module';
import { GameLoggerModule } from './common/services/game-logger.module';
import { HealthModule } from './health/health.module';
import { ClientUpdatesModule } from './client-updates/client-updates.module';
import { WsTicketModule } from './common/ws/ws-ticket.module';

@Module({
  imports: [
    GameLoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().uri().optional(),
        DB_HOST: Joi.string().default('127.0.0.1'),
        DB_PORT: Joi.number().default(3306),
        DB_USER: Joi.string().default('root'),
        DB_PASSWORD: Joi.string().allow('', null).default(''),
        DB_NAME: Joi.string().default('le_monde_de_lila'),
        // JWT: strict (HS256 only) + secret long.
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_ISSUER: Joi.string().default('le-monde-de-lila'),
        JWT_AUDIENCE: Joi.string().optional(),
        JWT_CLOCK_TOLERANCE_SECONDS: Joi.number().default(10),
        JWT_EXPIRES_IN: Joi.string().default('12h'),
        SESSION_STORE_REDIS_URL: Joi.string().uri().optional(),
        GAME_ENGINE_STATE_REDIS_URL: Joi.string().uri().optional(),
        CORS_ORIGINS: Joi.string().optional(),
        RATE_LIMIT_TTL: Joi.number().default(60),
        RATE_LIMIT_COUNT: Joi.number().default(120),
        LOG_LEVEL: Joi.string().default('info'),
        LOG_DIR: Joi.string().default('logs'),
        LOG_FILES_ENABLED: Joi.boolean()
          .truthy('true')
          .falsy('false')
          .default(true),
        ENABLE_PROTOTYPE_GAMES: Joi.string().optional(),
        CLIENT_UPDATES_DIR: Joi.string().optional(),
        CLIENT_UPDATES_PUBLIC_URL: Joi.string().uri().optional(),
        // WS tickets must have their own secret (do not reuse JWT_SECRET).
        WS_TICKET_SECRET: Joi.string().min(32).required(),
        WS_TICKET_TTL_SECONDS: Joi.number().default(60),
        WS_SHARED_SECRET: Joi.string().optional(),
        REALTIME_WS_SECRET: Joi.string().optional(),
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('RATE_LIMIT_TTL', 60),
          limit: config.get<number>('RATE_LIMIT_COUNT', 120),
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        const dbConfig = url
          ? { url }
          : {
              type: 'mysql' as const,
              host: config.get<string>('DB_HOST', '127.0.0.1'),
              port: parseInt(config.get<string>('DB_PORT', '3306'), 10),
              username: config.get<string>('DB_USER', 'root'),
              password: config.get<string>('DB_PASSWORD', ''),
              database: config.get<string>('DB_NAME', 'le_monde_de_lila'),
            };
        return {
          type: 'mysql' as const,
          entities: ORM_ENTITIES,
          synchronize: false,
          logging: false,
          ...dbConfig,
        };
      },
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
    ClientUpdatesModule,
    WsTicketModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
