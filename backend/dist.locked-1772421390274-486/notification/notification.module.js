"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NotificationModule", {
    enumerable: true,
    get: function() {
        return NotificationModule;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _notificationgateway = require("./gateways/notification.gateway");
const _notificationservice = require("./services/notification.service");
const _notificationtransport = require("./services/notification-transport");
const _clientupdatesmodule = require("../client-updates/client-updates.module");
const _redisclientfactory = require("../common/redis/redis-client.factory");
const _typeorm = require("@nestjs/typeorm");
const _socialrelationshipentity = require("../social/entities/social-relationship.entity");
const _userentity = require("../user/entities/user.entity");
const _admincontactservice = require("./services/admin-contact.service");
const _notificationinboxitementity = require("./entities/notification-inbox-item.entity");
const _notificationinboxdbservice = require("./services/notification-inbox-db.service");
const _privatemessageentity = require("../messaging/entities/private-message.entity");
const _userbadgecountsservice = require("./services/user-badge-counts.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let NotificationModule = class NotificationModule {
};
NotificationModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _config.ConfigModule,
            _clientupdatesmodule.ClientUpdatesModule,
            _typeorm.TypeOrmModule.forFeature([
                _socialrelationshipentity.SocialRelationship,
                _userentity.User,
                _notificationinboxitementity.NotificationInboxItem,
                _privatemessageentity.PrivateMessage
            ])
        ],
        providers: [
            {
                provide: _notificationtransport.NotificationTransport,
                inject: [
                    _config.ConfigService,
                    _redisclientfactory.RedisClientFactory
                ],
                useFactory: async (config, redisFactory)=>{
                    const redisUrl = config.get('NOTIFICATION_REDIS_URL') || config.get('SESSION_STORE_REDIS_URL');
                    if (!redisUrl) {
                        throw new Error('NOTIFICATION_REDIS_URL ou SESSION_STORE_REDIS_URL doit être défini pour les notifications.');
                    }
                    const transport = new _notificationtransport.RedisNotificationTransport(redisUrl, redisFactory);
                    transport.connect().catch((error)=>{
                        const logger = new _common.Logger('NotificationTransport');
                        logger.warn('Échec de la connexion Redis pour les notifications', error instanceof Error ? error.stack : String(error));
                    });
                    return transport;
                }
            },
            _notificationservice.NotificationService,
            _notificationinboxdbservice.NotificationInboxDbService,
            _userbadgecountsservice.UserBadgeCountsService,
            _admincontactservice.AdminContactService,
            _notificationgateway.NotificationGateway
        ],
        exports: [
            _notificationservice.NotificationService,
            _admincontactservice.AdminContactService,
            _userbadgecountsservice.UserBadgeCountsService,
            _notificationinboxdbservice.NotificationInboxDbService
        ]
    })
], NotificationModule);
