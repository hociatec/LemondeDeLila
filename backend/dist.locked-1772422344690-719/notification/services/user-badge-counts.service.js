"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "UserBadgeCountsService", {
    enumerable: true,
    get: function() {
        return UserBadgeCountsService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _privatemessageentity = require("../../messaging/entities/private-message.entity");
const _notificationservice = require("./notification.service");
const _notificationinboxdbservice = require("./notification-inbox-db.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let UserBadgeCountsService = class UserBadgeCountsService {
    async getCounts(userId) {
        try {
            const [unreadNotifications, unreadMessages] = await Promise.all([
                this.inbox.countUnread(userId),
                this.messages.createQueryBuilder('m').where('m.recipient_id = :userId', {
                    userId
                }).andWhere('m.deleted_by_recipient_at IS NULL').andWhere('m.read_by_recipient_at IS NULL').getCount()
            ]);
            return {
                unreadNotifications,
                unreadMessages
            };
        } catch (err) {
            this.logger.warn(`getCounts failed for user ${userId}: ${err.message}`);
            throw err;
        }
    }
    async notifyCounts(userId) {
        const counts = await this.getCounts(userId);
        await this.notifications.notifyUser(userId, 'notify.counts', counts);
    }
    constructor(inbox, messages, notifications){
        this.inbox = inbox;
        this.messages = messages;
        this.notifications = notifications;
        this.logger = new _common.Logger(UserBadgeCountsService.name);
    }
};
UserBadgeCountsService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(1, (0, _typeorm.InjectRepository)(_privatemessageentity.PrivateMessage)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _notificationinboxdbservice.NotificationInboxDbService === "undefined" ? Object : _notificationinboxdbservice.NotificationInboxDbService,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _notificationservice.NotificationService === "undefined" ? Object : _notificationservice.NotificationService
    ])
], UserBadgeCountsService);
