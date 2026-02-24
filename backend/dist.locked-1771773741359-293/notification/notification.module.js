"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const notification_gateway_1 = require("./gateways/notification.gateway");
const notification_service_1 = require("./services/notification.service");
const notification_transport_1 = require("./services/notification-transport");
const client_updates_module_1 = require("../client-updates/client-updates.module");
const redis_client_factory_1 = require("../common/redis/redis-client.factory");
const typeorm_1 = require("@nestjs/typeorm");
const social_relationship_entity_1 = require("../social/entities/social-relationship.entity");
const user_entity_1 = require("../user/entities/user.entity");
const admin_contact_service_1 = require("./services/admin-contact.service");
const notification_inbox_item_entity_1 = require("./entities/notification-inbox-item.entity");
const notification_inbox_db_service_1 = require("./services/notification-inbox-db.service");
const private_message_entity_1 = require("../messaging/entities/private-message.entity");
const user_badge_counts_service_1 = require("./services/user-badge-counts.service");
let NotificationModule = class NotificationModule {
};
exports.NotificationModule = NotificationModule;
exports.NotificationModule = NotificationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            client_updates_module_1.ClientUpdatesModule,
            typeorm_1.TypeOrmModule.forFeature([
                social_relationship_entity_1.SocialRelationship,
                user_entity_1.User,
                notification_inbox_item_entity_1.NotificationInboxItem,
                private_message_entity_1.PrivateMessage,
            ]),
        ],
        providers: [
            {
                provide: notification_transport_1.NotificationTransport,
                inject: [config_1.ConfigService, redis_client_factory_1.RedisClientFactory],
                useFactory: async (config, redisFactory) => {
                    const redisUrl = config.get('NOTIFICATION_REDIS_URL') ||
                        config.get('SESSION_STORE_REDIS_URL');
                    if (!redisUrl) {
                        throw new Error('NOTIFICATION_REDIS_URL ou SESSION_STORE_REDIS_URL doit être défini pour les notifications.');
                    }
                    const transport = new notification_transport_1.RedisNotificationTransport(redisUrl, redisFactory);
                    transport.connect().catch((error) => {
                        const logger = new common_1.Logger('NotificationTransport');
                        logger.warn('Échec de la connexion Redis pour les notifications', error instanceof Error ? error.stack : String(error));
                    });
                    return transport;
                },
            },
            notification_service_1.NotificationService,
            notification_inbox_db_service_1.NotificationInboxDbService,
            user_badge_counts_service_1.UserBadgeCountsService,
            admin_contact_service_1.AdminContactService,
            notification_gateway_1.NotificationGateway,
        ],
        exports: [
            notification_service_1.NotificationService,
            admin_contact_service_1.AdminContactService,
            user_badge_counts_service_1.UserBadgeCountsService,
            notification_inbox_db_service_1.NotificationInboxDbService,
        ],
    })
], NotificationModule);
//# sourceMappingURL=notification.module.js.map