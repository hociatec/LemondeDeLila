"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AppModule", {
    enumerable: true,
    get: function() {
        return AppModule;
    }
});
const _common = require("@nestjs/common");
const _core = require("@nestjs/core");
const _config = require("@nestjs/config");
const _typeorm = require("@nestjs/typeorm");
const _throttler = require("@nestjs/throttler");
const _joi = /*#__PURE__*/ _interop_require_wildcard(require("joi"));
const _entities = require("./database/entities");
const _usermodule = require("./user/user.module");
const _chatmodule = require("./chat/chat.module");
const _catalogmodule = require("./catalog/catalog.module");
const _messagingmodule = require("./messaging/messaging.module");
const _presencemodule = require("./presence/presence.module");
const _roommodule = require("./room/room.module");
const _gamemodule = require("./game/game.module");
const _botmodule = require("./bot/bot.module");
const _adminmodule = require("./admin/admin.module");
const _socialmodule = require("./social/social.module");
const _wsroutingmodule = require("./common/ws/ws-routing.module");
const _validationmodule = require("./common/validation/validation.module");
const _gamewsmodule = require("./game/ws/game-ws.module");
const _realtimemodule = require("./realtime/realtime.module");
const _notificationmodule = require("./notification/notification.module");
const _gameloggermodule = require("./common/services/game-logger.module");
const _healthmodule = require("./health/health.module");
const _clientupdatesmodule = require("./client-updates/client-updates.module");
const _soundsmodule = require("./sounds/sounds.module");
const _wsticketmodule = require("./common/ws/ws-ticket.module");
const _jwksmodule = require("./common/auth/jwks.module");
const _bugreportsmodule = require("./bug-reports/bug-reports.module");
const _redismodule = require("./common/redis/redis.module");
const _vaultmodule = require("./vault/vault.module");
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let AppModule = class AppModule {
};
AppModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _gameloggermodule.GameLoggerModule,
            _redismodule.RedisModule,
            _config.ConfigModule.forRoot({
                isGlobal: true,
                // Default: load `.env` when present (even in production) to avoid "works in dev, fails in prod"
                // when users run `NODE_ENV=production node dist/main` without a systemd EnvironmentFile.
                //
                // To force env-only (systemd/docker secrets), set `IGNORE_ENV_FILE=true`.
                ignoreEnvFile: (process.env.IGNORE_ENV_FILE || '').toLowerCase().trim() === 'true',
                validationSchema: _joi.object({
                    NODE_ENV: _joi.string().valid('development', 'production', 'test').default('development'),
                    PORT: _joi.number().default(3000),
                    DATABASE_URL: _joi.string().uri().optional(),
                    DB_HOST: _joi.string().default('127.0.0.1'),
                    DB_PORT: _joi.number().default(3306),
                    DB_USER: _joi.string().default('root'),
                    DB_PASSWORD: _joi.string().allow('', null).default(''),
                    DB_NAME: _joi.string().default('le_monde_de_lila'),
                    // JWT:
                    // - HS256 (legacy): shared secret (never ship it to clients)
                    // - RS256 (recommended): private key on server, public key distributable to clients
                    JWT_ALGORITHM: _joi.string().valid('HS256', 'RS256').optional(),
                    JWT_SECRET: _joi.string().min(32).optional(),
                    JWT_PRIVATE_KEY_PEM: _joi.string().optional(),
                    JWT_PUBLIC_KEY_PEM: _joi.string().optional(),
                    JWT_PRIVATE_KEY_PATH: _joi.string().optional(),
                    JWT_PUBLIC_KEY_PATH: _joi.string().optional(),
                    JWT_ISSUER: _joi.string().default('le-monde-de-lila'),
                    JWT_AUDIENCE: _joi.string().optional(),
                    JWT_CLOCK_TOLERANCE_SECONDS: _joi.number().default(10),
                    JWT_EXPIRES_IN: _joi.string().default('12h'),
                    SESSION_STORE_REDIS_URL: _joi.string().uri().optional(),
                    GAME_ENGINE_STATE_REDIS_URL: _joi.string().uri().optional(),
                    ROOM_PAYLOAD_REDIS_URL: _joi.string().uri().optional(),
                    CORS_ORIGINS: _joi.string().optional(),
                    RATE_LIMIT_TTL: _joi.number().default(60),
                    RATE_LIMIT_COUNT: _joi.number().default(120),
                    LOG_LEVEL: _joi.string().default('info'),
                    LOG_DIR: _joi.string().default('logs'),
                    LOG_FILES_ENABLED: _joi.boolean().truthy('true').falsy('false').default(true),
                    ENABLE_PROTOTYPE_GAMES: _joi.string().optional(),
                    CLIENT_UPDATES_DIR: _joi.string().optional(),
                    CLIENT_UPDATES_META_PATH: _joi.string().optional(),
                    CLIENT_UPDATES_UPLOADS_DIR: _joi.string().optional(),
                    CLIENT_UPDATES_PUBLIC_URL: _joi.string().uri().optional(),
                    TAVERNE_CATEGORIES_ROOT: _joi.string().optional(),
                    // WS tickets must have their own secret (do not reuse JWT_SECRET).
                    WS_TICKET_SECRET: _joi.string().min(32).required(),
                    WS_TICKET_TTL_SECONDS: _joi.number().default(60),
                    WS_SHARED_SECRET: _joi.string().optional(),
                    REALTIME_WS_SECRET: _joi.string().optional()
                }).custom((rawEnv, helpers)=>{
                    const env = rawEnv;
                    const nodeEnv = (env['NODE_ENV'] || 'development').toLowerCase();
                    if (nodeEnv === 'production') {
                        if (!env['SESSION_STORE_REDIS_URL']) {
                            return helpers.error('any.custom', {
                                message: 'SESSION_STORE_REDIS_URL est requis en production'
                            });
                        }
                        if (!env['GAME_ENGINE_STATE_REDIS_URL']) {
                            return helpers.error('any.custom', {
                                message: 'GAME_ENGINE_STATE_REDIS_URL est requis en production'
                            });
                        }
                    }
                    const alg = (env['JWT_ALGORITHM'] || '').toUpperCase();
                    const hasRsa = !!env['JWT_PRIVATE_KEY_PEM'] || !!env['JWT_PRIVATE_KEY_PATH'] || !!env['JWT_PUBLIC_KEY_PEM'] || !!env['JWT_PUBLIC_KEY_PATH'];
                    const effectiveAlg = alg === 'HS256' || alg === 'RS256' ? alg : hasRsa ? 'RS256' : 'HS256';
                    if (effectiveAlg === 'HS256') {
                        if (!env['JWT_SECRET']) {
                            return helpers.error('any.custom', {
                                message: 'JWT_SECRET est requis en mode HS256'
                            });
                        }
                        return env;
                    }
                    if (!env['JWT_PRIVATE_KEY_PEM'] && !env['JWT_PRIVATE_KEY_PATH']) {
                        return helpers.error('any.custom', {
                            message: 'JWT_PRIVATE_KEY_PEM ou JWT_PRIVATE_KEY_PATH est requis en mode RS256'
                        });
                    }
                    if (!env['JWT_PUBLIC_KEY_PEM'] && !env['JWT_PUBLIC_KEY_PATH']) {
                        return helpers.error('any.custom', {
                            message: 'JWT_PUBLIC_KEY_PEM ou JWT_PUBLIC_KEY_PATH est requis en mode RS256'
                        });
                    }
                    return env;
                })
            }),
            _throttler.ThrottlerModule.forRootAsync({
                inject: [
                    _config.ConfigService
                ],
                useFactory: (config)=>[
                        {
                            ttl: config.get('RATE_LIMIT_TTL', 60),
                            limit: config.get('RATE_LIMIT_COUNT', 120)
                        }
                    ]
            }),
            _typeorm.TypeOrmModule.forRootAsync({
                inject: [
                    _config.ConfigService
                ],
                useFactory: (config)=>{
                    const url = config.get('DATABASE_URL');
                    const dbConfig = url ? {
                        url
                    } : {
                        type: 'mysql',
                        host: config.get('DB_HOST', '127.0.0.1'),
                        port: parseInt(config.get('DB_PORT', '3306'), 10),
                        username: config.get('DB_USER', 'root'),
                        password: config.get('DB_PASSWORD', ''),
                        database: config.get('DB_NAME', 'le_monde_de_lila')
                    };
                    return {
                        type: 'mysql',
                        entities: _entities.ORM_ENTITIES,
                        synchronize: false,
                        logging: false,
                        ...dbConfig
                    };
                }
            }),
            _usermodule.UserModule,
            _chatmodule.ChatModule,
            _catalogmodule.CatalogModule,
            _messagingmodule.MessagingModule,
            _socialmodule.SocialModule,
            _presencemodule.PresenceModule,
            _roommodule.RoomModule,
            _gamemodule.GameModule,
            _gamewsmodule.GameWsModule,
            _botmodule.BotModule,
            _wsroutingmodule.WsRoutingModule,
            _validationmodule.ValidationModule,
            _realtimemodule.RealtimeModule,
            _notificationmodule.NotificationModule,
            _adminmodule.AdminModule,
            _healthmodule.HealthModule,
            _clientupdatesmodule.ClientUpdatesModule,
            _soundsmodule.SoundsModule,
            _wsticketmodule.WsTicketModule,
            _jwksmodule.JwksModule,
            _bugreportsmodule.BugReportsModule,
            _vaultmodule.VaultModule
        ],
        providers: [
            {
                provide: _core.APP_GUARD,
                useClass: _throttler.ThrottlerGuard
            }
        ]
    })
], AppModule);
