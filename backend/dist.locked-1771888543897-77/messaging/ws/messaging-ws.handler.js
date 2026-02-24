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
var MessagingWsHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingWsHandler = void 0;
const common_1 = require("@nestjs/common");
const messaging_service_1 = require("../services/messaging.service");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const ws_auth_1 = require("../../common/ws/ws-auth");
const notification_service_1 = require("../../notification/services/notification.service");
const user_badge_counts_service_1 = require("../../notification/services/user-badge-counts.service");
const ws_dto_1 = require("./ws.dto");
let MessagingWsHandler = MessagingWsHandler_1 = class MessagingWsHandler {
    messaging;
    validator;
    notifications;
    counts;
    logger = new common_1.Logger(MessagingWsHandler_1.name);
    constructor(messaging, validator, notifications, counts) {
        this.messaging = messaging;
        this.validator = validator;
        this.notifications = notifications;
        this.counts = counts;
    }
    async conversation(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.MessagingConversationDto, payload);
        const items = await this.messaging.conversation(user.id, dto.userId, dto.limit);
        return { type: 'messaging.conversation', payload: { items } };
    }
    async messages(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.MessagingListDto, payload);
        const { box, items } = await this.resolveBox(dto.box ?? 'inbox', user.id, dto.limit ?? 100);
        return { type: 'messaging.messages', payload: { box, items } };
    }
    async send(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.MessagingSendDto, payload);
        const message = await this.messaging.send(user.id, dto);
        try {
            const preview = (message.text || '').trim().length > 0
                ? (message.text || '').trim().slice(0, 200)
                : '';
            await this.notifications.notifyUser(dto.recipientId, 'messaging.new', {
                messageId: message.id,
                from: message.sender,
                subject: message.subject,
                preview,
                createdAt: message.createdAt,
            });
        }
        catch {
        }
        try {
            await this.counts.notifyCounts(dto.recipientId);
        }
        catch (err) {
            this.logger.warn(`notifyCounts failed for user ${dto.recipientId}: ${err.message}`);
        }
        return { type: 'messaging.message', payload: { message } };
    }
    async delete(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const messageId = String(payload?.messageId ?? payload?.id ?? '');
        const message = await this.messaging.delete(user.id, messageId);
        await this.counts.notifyCounts(user.id);
        return { type: 'messaging.deleted', payload: { message } };
    }
    async restore(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const messageId = String(payload?.messageId ?? payload?.id ?? '');
        const message = await this.messaging.restore(user.id, messageId);
        await this.counts.notifyCounts(user.id);
        return { type: 'messaging.restored', payload: { message } };
    }
    async purge(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const messageId = String(payload?.messageId ?? payload?.id ?? '');
        const message = await this.messaging.purge(user.id, messageId);
        await this.counts.notifyCounts(user.id);
        return { type: 'messaging.purged', payload: { message } };
    }
    async search(payload) {
        const dto = this.validator.validate(ws_dto_1.MessagingSearchDto, payload);
        const username = dto.username ?? dto.query ?? '';
        const user = await this.messaging.lookupUser(username);
        return { type: 'messaging.user', payload: { user } };
    }
    async markRead(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.MessagingMarkReadDto, payload);
        await this.messaging.markRead(user.id, dto.messageId);
        try {
            await this.counts.notifyCounts(user.id);
        }
        catch (err) {
            this.logger.warn(`notifyCounts failed after markRead for user ${user.id}: ${err.message}`);
        }
        return { type: 'messaging.markRead', payload: { ok: true } };
    }
    async resolveBox(box, userId, limit) {
        const normalized = (box || 'inbox').toLowerCase();
        const mapping = {
            inbox: 'inbox',
            received: 'inbox',
            '': 'inbox',
            sent: 'outbox',
            outbox: 'outbox',
            deleted: 'deleted',
            trash: 'deleted',
        };
        const target = mapping[normalized];
        if (!target) {
            throw new common_1.HttpException('Boite de messagerie inconnue', 404);
        }
        const items = target === 'outbox'
            ? await this.messaging.outbox(userId, limit)
            : target === 'deleted'
                ? await this.messaging.deleted(userId, limit)
                : await this.messaging.inbox(userId, limit);
        const finalBox = normalized === ''
            ? 'inbox'
            : normalized === 'sent'
                ? 'outbox'
                : normalized;
        return { box: finalBox, items };
    }
};
exports.MessagingWsHandler = MessagingWsHandler;
exports.MessagingWsHandler = MessagingWsHandler = MessagingWsHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [messaging_service_1.MessagingService,
        payload_validation_service_1.PayloadValidationService,
        notification_service_1.NotificationService,
        user_badge_counts_service_1.UserBadgeCountsService])
], MessagingWsHandler);
//# sourceMappingURL=messaging-ws.handler.js.map