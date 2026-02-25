"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PresenceModule", {
    enumerable: true,
    get: function() {
        return PresenceModule;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _chatmodule = require("../chat/chat.module");
const _notificationmodule = require("../notification/notification.module");
const _presencegateway = require("./gateways/presence.gateway");
const _presenceservice = require("./services/presence.service");
const _typeorm = require("@nestjs/typeorm");
const _roomparticipantentity = require("../room/entities/room-participant.entity");
const _roomentity = require("../room/entities/room.entity");
const _userentity = require("../user/entities/user.entity");
const _presencetransport = require("./services/presence-transport");
const _redisclientfactory = require("../common/redis/redis-client.factory");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let PresenceModule = class PresenceModule {
};
PresenceModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _config.ConfigModule,
            _chatmodule.ChatModule,
            _notificationmodule.NotificationModule,
            _typeorm.TypeOrmModule.forFeature([
                _roomparticipantentity.RoomParticipant,
                _roomentity.Room,
                _userentity.User
            ])
        ],
        providers: [
            {
                provide: _presencetransport.PresenceTransport,
                inject: [
                    _config.ConfigService,
                    _redisclientfactory.RedisClientFactory
                ],
                useFactory: async (config, redisFactory)=>{
                    const redisUrl = config.get('PRESENCE_REDIS_URL') || config.get('SESSION_STORE_REDIS_URL');
                    if (!redisUrl) {
                        throw new Error('PRESENCE_REDIS_URL ou SESSION_STORE_REDIS_URL doit être défini pour la présence.');
                    }
                    const transport = new _presencetransport.RedisPresenceTransport(redisUrl, redisFactory);
                    transport.connect().catch((error)=>{
                        const logger = new _common.Logger('PresenceTransport');
                        logger.warn('Échec de la connexion Redis pour les présences', error instanceof Error ? error.stack : String(error));
                    });
                    return transport;
                }
            },
            _presencegateway.PresenceGateway,
            _presenceservice.PresenceService
        ],
        exports: [
            _presenceservice.PresenceService
        ]
    })
], PresenceModule);
