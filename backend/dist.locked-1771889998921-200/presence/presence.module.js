"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const chat_module_1 = require("../chat/chat.module");
const notification_module_1 = require("../notification/notification.module");
const presence_gateway_1 = require("./gateways/presence.gateway");
const presence_service_1 = require("./services/presence.service");
const typeorm_1 = require("@nestjs/typeorm");
const room_participant_entity_1 = require("../room/entities/room-participant.entity");
const room_entity_1 = require("../room/entities/room.entity");
const user_entity_1 = require("../user/entities/user.entity");
const presence_transport_1 = require("./services/presence-transport");
const redis_client_factory_1 = require("../common/redis/redis-client.factory");
let PresenceModule = class PresenceModule {
};
exports.PresenceModule = PresenceModule;
exports.PresenceModule = PresenceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            chat_module_1.ChatModule,
            notification_module_1.NotificationModule,
            typeorm_1.TypeOrmModule.forFeature([room_participant_entity_1.RoomParticipant, room_entity_1.Room, user_entity_1.User]),
        ],
        providers: [
            {
                provide: presence_transport_1.PresenceTransport,
                inject: [config_1.ConfigService, redis_client_factory_1.RedisClientFactory],
                useFactory: async (config, redisFactory) => {
                    const redisUrl = config.get('PRESENCE_REDIS_URL') ||
                        config.get('SESSION_STORE_REDIS_URL');
                    if (!redisUrl) {
                        throw new Error('PRESENCE_REDIS_URL ou SESSION_STORE_REDIS_URL doit être défini pour la présence.');
                    }
                    const transport = new presence_transport_1.RedisPresenceTransport(redisUrl, redisFactory);
                    transport.connect().catch((error) => {
                        const logger = new common_1.Logger('PresenceTransport');
                        logger.warn('Échec de la connexion Redis pour les présences', error instanceof Error ? error.stack : String(error));
                    });
                    return transport;
                },
            },
            presence_gateway_1.PresenceGateway,
            presence_service_1.PresenceService,
        ],
        exports: [presence_service_1.PresenceService],
    })
], PresenceModule);
//# sourceMappingURL=presence.module.js.map