"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MessagingWsHandler", {
    enumerable: true,
    get: function() {
        return MessagingWsHandler;
    }
});
const _common = require("@nestjs/common");
const _messagingservice = require("../services/messaging.service");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _wsauth = require("../../common/ws/ws-auth");
const _notificationservice = require("../../notification/services/notification.service");
const _userbadgecountsservice = require("../../notification/services/user-badge-counts.service");
const _wsdto = require("./ws.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let MessagingWsHandler = class MessagingWsHandler {
    async conversation(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.MessagingConversationDto, payload);
        const items = await this.messaging.conversation(user.id, dto.userId, dto.limit);
        return {
            type: 'messaging.conversation',
            payload: {
                items
            }
        };
    }
    async messages(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.MessagingListDto, payload);
        const { box, items } = await this.resolveBox(dto.box ?? 'inbox', user.id, dto.limit ?? 100);
        return {
            type: 'messaging.messages',
            payload: {
                box,
                items
            }
        };
    }
    async send(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.MessagingSendDto, payload);
        const message = await this.messaging.send(user.id, dto);
        // Notification temps réel au destinataire (via WS notify).
        try {
            const preview = (message.text || '').trim().length > 0 ? (message.text || '').trim().slice(0, 200) : '';
            await this.notifications.notifyUser(dto.recipientId, 'messaging.new', {
                messageId: message.id,
                from: message.sender,
                subject: message.subject,
                preview,
                createdAt: message.createdAt
            });
        } catch  {
        // best-effort notification; continue to counts update below
        }
        // Toujours pousser les compteurs, même si la notification WS échoue.
        try {
            await this.counts.notifyCounts(dto.recipientId);
        } catch (err) {
            this.logger.warn(`notifyCounts failed for user ${dto.recipientId}: ${err.message}`);
        }
        return {
            type: 'messaging.message',
            payload: {
                message
            }
        };
    }
    async delete(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const messageId = String(payload?.messageId ?? payload?.id ?? '');
        const message = await this.messaging.delete(user.id, messageId);
        await this.counts.notifyCounts(user.id);
        return {
            type: 'messaging.deleted',
            payload: {
                message
            }
        };
    }
    async restore(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const messageId = String(payload?.messageId ?? payload?.id ?? '');
        const message = await this.messaging.restore(user.id, messageId);
        await this.counts.notifyCounts(user.id);
        return {
            type: 'messaging.restored',
            payload: {
                message
            }
        };
    }
    async purge(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const messageId = String(payload?.messageId ?? payload?.id ?? '');
        const message = await this.messaging.purge(user.id, messageId);
        await this.counts.notifyCounts(user.id);
        return {
            type: 'messaging.purged',
            payload: {
                message
            }
        };
    }
    async search(payload) {
        const dto = this.validator.validate(_wsdto.MessagingSearchDto, payload);
        const username = dto.username ?? dto.query ?? '';
        const user = await this.messaging.lookupUser(username);
        return {
            type: 'messaging.user',
            payload: {
                user
            }
        };
    }
    async markRead(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.MessagingMarkReadDto, payload);
        await this.messaging.markRead(user.id, dto.messageId);
        try {
            await this.counts.notifyCounts(user.id);
        } catch (err) {
            this.logger.warn(`notifyCounts failed after markRead for user ${user.id}: ${err.message}`);
        }
        return {
            type: 'messaging.markRead',
            payload: {
                ok: true
            }
        };
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
            trash: 'deleted'
        };
        const target = mapping[normalized];
        if (!target) {
            throw new _common.HttpException('Boite de messagerie inconnue', 404);
        }
        const items = target === 'outbox' ? await this.messaging.outbox(userId, limit) : target === 'deleted' ? await this.messaging.deleted(userId, limit) : await this.messaging.inbox(userId, limit);
        const finalBox = normalized === '' ? 'inbox' : normalized === 'sent' ? 'outbox' : normalized;
        return {
            box: finalBox,
            items
        };
    }
    constructor(messaging, validator, notifications, counts){
        this.messaging = messaging;
        this.validator = validator;
        this.notifications = notifications;
        this.counts = counts;
        this.logger = new _common.Logger(MessagingWsHandler.name);
    }
};
MessagingWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _messagingservice.MessagingService === "undefined" ? Object : _messagingservice.MessagingService,
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _notificationservice.NotificationService === "undefined" ? Object : _notificationservice.NotificationService,
        typeof _userbadgecountsservice.UserBadgeCountsService === "undefined" ? Object : _userbadgecountsservice.UserBadgeCountsService
    ])
], MessagingWsHandler);
