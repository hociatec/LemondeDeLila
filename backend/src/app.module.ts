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
import { SoundsModule } from './sounds/sounds.module';
import { WsTicketModule } from './common/ws/ws-ticket.module';
import { JwksModule } from './common/auth/jwks.module';
import { BugReportsModule } from './bug-reports/bug-reports.module';
import { RedisModule } from './common/redis/redis.module';
import { VaultModule } from './vault/vault.module';

type EnvValidationInput = Record<string, unknown>;

@Module({
  imports: [
    GameLoggerModule,
    RedisModule,
    ConfigModule.forRoot({
      isGlobal: true,
      // Default: load `.env` when present (even in production) to avoid "works in dev, fails in prod"
      // when users run `NODE_ENV=production node dist/main` without a systemd EnvironmentFile.
      //
      // To force env-only (systemd/docker secrets), set `IGNORE_ENV_FILE=true`.
      ignoreEnvFile:
        (process.env.IGNORE_ENV_FILE || '').toLowerCase().trim() === 'true',
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
        // JWT:
        // - HS256 (legacy): shared secret (never ship it to clients)
        // - RS256 (recommended): private key on server, public key distributable to clients
        JWT_ALGORITHM: Joi.string().valid('HS256', 'RS256').optional(),
        JWT_SECRET: Joi.string().min(32).optional(),
        JWT_PRIVATE_KEY_PEM: Joi.string().optional(),
        JWT_PUBLIC_KEY_PEM: Joi.string().optional(),
        JWT_PRIVATE_KEY_PATH: Joi.string().optional(),
        JWT_PUBLIC_KEY_PATH: Joi.string().optional(),
        JWT_ISSUER: Joi.string().default('le-monde-de-lila'),
        JWT_AUDIENCE: Joi.string().optional(),
        JWT_CLOCK_TOLERANCE_SECONDS: Joi.number().default(10),
        JWT_EXPIRES_IN: Joi.string().default('12h'),
        SESSION_STORE_REDIS_URL: Joi.string().uri().optional(),
        GAME_ENGINE_STATE_REDIS_URL: Joi.string().uri().optional(),
        ROOM_PAYLOAD_REDIS_URL: Joi.string().uri().optional(),
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
        CLIENT_UPDATES_META_PATH: Joi.string().optional(),
        CLIENT_UPDATES_UPLOADS_DIR: Joi.string().optional(),
        CLIENT_UPDATES_PUBLIC_URL: Joi.string().uri().optional(),
        TAVERNE_CATEGORIES_ROOT: Joi.string().optional(),
        // WS tickets must have their own secret (do not reuse JWT_SECRET).
        WS_TICKET_SECRET: Joi.string().min(32).required(),
        WS_TICKET_TTL_SECONDS: Joi.number().default(60),
        WS_SHARED_SECRET: Joi.string().optional(),
        REALTIME_WS_SECRET: Joi.string().optional(),
      }).custom((rawEnv, helpers) => {
        const env = rawEnv as EnvValidationInput;
        const nodeEnv = (
          (env['NODE_ENV'] as string | undefined) || 'development'
        ).toLowerCase();
        if (nodeEnv === 'production') {
          if (!env['SESSION_STORE_REDIS_URL']) {
            return helpers.error('any.custom', {
              message: 'SESSION_STORE_REDIS_URL est requis en production',
            });
          }
          if (!env['GAME_ENGINE_STATE_REDIS_URL']) {
            return helpers.error('any.custom', {
              message: 'GAME_ENGINE_STATE_REDIS_URL est requis en production',
            });
          }
        }

        const alg = (
          (env['JWT_ALGORITHM'] as string | undefined) || ''
        ).toUpperCase();
        const hasRsa =
          !!env['JWT_PRIVATE_KEY_PEM'] ||
          !!env['JWT_PRIVATE_KEY_PATH'] ||
          !!env['JWT_PUBLIC_KEY_PEM'] ||
          !!env['JWT_PUBLIC_KEY_PATH'];
        const effectiveAlg =
          alg === 'HS256' || alg === 'RS256' ? alg : hasRsa ? 'RS256' : 'HS256';

        if (effectiveAlg === 'HS256') {
          if (!env['JWT_SECRET']) {
            return helpers.error('any.custom', {
              message: 'JWT_SECRET est requis en mode HS256',
            });
          }
          return env;
        }

        if (!env['JWT_PRIVATE_KEY_PEM'] && !env['JWT_PRIVATE_KEY_PATH']) {
          return helpers.error('any.custom', {
            message:
              'JWT_PRIVATE_KEY_PEM ou JWT_PRIVATE_KEY_PATH est requis en mode RS256',
          });
        }
        if (!env['JWT_PUBLIC_KEY_PEM'] && !env['JWT_PUBLIC_KEY_PATH']) {
          return helpers.error('any.custom', {
            message:
              'JWT_PUBLIC_KEY_PEM ou JWT_PUBLIC_KEY_PATH est requis en mode RS256',
          });
        }
        return env;
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
    SoundsModule,
    WsTicketModule,
    JwksModule,
    BugReportsModule,
    VaultModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
