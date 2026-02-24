"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const throttler_1 = require("@nestjs/throttler");
const Joi = __importStar(require("joi"));
const entities_1 = require("./database/entities");
const user_module_1 = require("./user/user.module");
const chat_module_1 = require("./chat/chat.module");
const catalog_module_1 = require("./catalog/catalog.module");
const messaging_module_1 = require("./messaging/messaging.module");
const presence_module_1 = require("./presence/presence.module");
const room_module_1 = require("./room/room.module");
const game_module_1 = require("./game/game.module");
const bot_module_1 = require("./bot/bot.module");
const admin_module_1 = require("./admin/admin.module");
const social_module_1 = require("./social/social.module");
const ws_routing_module_1 = require("./common/ws/ws-routing.module");
const validation_module_1 = require("./common/validation/validation.module");
const game_ws_module_1 = require("./game/ws/game-ws.module");
const realtime_module_1 = require("./realtime/realtime.module");
const notification_module_1 = require("./notification/notification.module");
const game_logger_module_1 = require("./common/services/game-logger.module");
const health_module_1 = require("./health/health.module");
const client_updates_module_1 = require("./client-updates/client-updates.module");
const sounds_module_1 = require("./sounds/sounds.module");
const ws_ticket_module_1 = require("./common/ws/ws-ticket.module");
const jwks_module_1 = require("./common/auth/jwks.module");
const bug_reports_module_1 = require("./bug-reports/bug-reports.module");
const redis_module_1 = require("./common/redis/redis.module");
const vault_module_1 = require("./vault/vault.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            game_logger_module_1.GameLoggerModule,
            redis_module_1.RedisModule,
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                ignoreEnvFile: (process.env.IGNORE_ENV_FILE || '').toLowerCase().trim() === 'true',
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
                    CLIENT_UPDATES_PUBLIC_URL: Joi.string().uri().optional(),
                    WS_TICKET_SECRET: Joi.string().min(32).required(),
                    WS_TICKET_TTL_SECONDS: Joi.number().default(60),
                    WS_SHARED_SECRET: Joi.string().optional(),
                    REALTIME_WS_SECRET: Joi.string().optional(),
                }).custom((rawEnv, helpers) => {
                    const env = rawEnv;
                    const nodeEnv = (env['NODE_ENV'] || 'development').toLowerCase();
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
                    const alg = (env['JWT_ALGORITHM'] || '').toUpperCase();
                    const hasRsa = !!env['JWT_PRIVATE_KEY_PEM'] ||
                        !!env['JWT_PRIVATE_KEY_PATH'] ||
                        !!env['JWT_PUBLIC_KEY_PEM'] ||
                        !!env['JWT_PUBLIC_KEY_PATH'];
                    const effectiveAlg = alg === 'HS256' || alg === 'RS256' ? alg : hasRsa ? 'RS256' : 'HS256';
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
                            message: 'JWT_PRIVATE_KEY_PEM ou JWT_PRIVATE_KEY_PATH est requis en mode RS256',
                        });
                    }
                    if (!env['JWT_PUBLIC_KEY_PEM'] && !env['JWT_PUBLIC_KEY_PATH']) {
                        return helpers.error('any.custom', {
                            message: 'JWT_PUBLIC_KEY_PEM ou JWT_PUBLIC_KEY_PATH est requis en mode RS256',
                        });
                    }
                    return env;
                }),
            }),
            throttler_1.ThrottlerModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => [
                    {
                        ttl: config.get('RATE_LIMIT_TTL', 60),
                        limit: config.get('RATE_LIMIT_COUNT', 120),
                    },
                ],
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    const url = config.get('DATABASE_URL');
                    const dbConfig = url
                        ? { url }
                        : {
                            type: 'mysql',
                            host: config.get('DB_HOST', '127.0.0.1'),
                            port: parseInt(config.get('DB_PORT', '3306'), 10),
                            username: config.get('DB_USER', 'root'),
                            password: config.get('DB_PASSWORD', ''),
                            database: config.get('DB_NAME', 'le_monde_de_lila'),
                        };
                    return {
                        type: 'mysql',
                        entities: entities_1.ORM_ENTITIES,
                        synchronize: false,
                        logging: false,
                        ...dbConfig,
                    };
                },
            }),
            user_module_1.UserModule,
            chat_module_1.ChatModule,
            catalog_module_1.CatalogModule,
            messaging_module_1.MessagingModule,
            social_module_1.SocialModule,
            presence_module_1.PresenceModule,
            room_module_1.RoomModule,
            game_module_1.GameModule,
            game_ws_module_1.GameWsModule,
            bot_module_1.BotModule,
            ws_routing_module_1.WsRoutingModule,
            validation_module_1.ValidationModule,
            realtime_module_1.RealtimeModule,
            notification_module_1.NotificationModule,
            admin_module_1.AdminModule,
            health_module_1.HealthModule,
            client_updates_module_1.ClientUpdatesModule,
            sounds_module_1.SoundsModule,
            ws_ticket_module_1.WsTicketModule,
            jwks_module_1.JwksModule,
            bug_reports_module_1.BugReportsModule,
            vault_module_1.VaultModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map