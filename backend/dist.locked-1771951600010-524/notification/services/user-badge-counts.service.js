"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var UserBadgeCountsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserBadgeCountsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const private_message_entity_1 = require("../../messaging/entities/private-message.entity");
const notification_service_1 = require("./notification.service");
const notification_inbox_db_service_1 = require("./notification-inbox-db.service");
let UserBadgeCountsService = UserBadgeCountsService_1 = class UserBadgeCountsService {
    inbox;
    messages;
    notifications;
    logger = new common_1.Logger(UserBadgeCountsService_1.name);
    constructor(inbox, messages, notifications) {
        this.inbox = inbox;
        this.messages = messages;
        this.notifications = notifications;
    }
    async getCounts(userId) {
        try {
            const [unreadNotifications, unreadMessages] = await Promise.all([
                this.inbox.countUnread(userId),
                this.messages
                    .createQueryBuilder('m')
                    .where('m.recipient_id = :userId', { userId })
                    .andWhere('m.deleted_by_recipient_at IS NULL')
                    .andWhere('m.read_by_recipient_at IS NULL')
                    .getCount(),
            ]);
            return { unreadNotifications, unreadMessages };
        }
        catch (err) {
            this.logger.warn(`getCounts failed for user ${userId}: ${err.message}`);
            throw err;
        }
    }
    async notifyCounts(userId) {
        const counts = await this.getCounts(userId);
        await this.notifications.notifyUser(userId, 'notify.counts', counts);
    }
};
exports.UserBadgeCountsService = UserBadgeCountsService;
exports.UserBadgeCountsService = UserBadgeCountsService = UserBadgeCountsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(private_message_entity_1.PrivateMessage)),
    __metadata("design:paramtypes", [notification_inbox_db_service_1.NotificationInboxDbService,
        typeorm_2.Repository,
        notification_service_1.NotificationService])
], UserBadgeCountsService);
//# sourceMappingURL=user-badge-counts.service.js.map