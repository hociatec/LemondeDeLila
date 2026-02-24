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
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const chat_message_entity_1 = require("../entities/chat-message.entity");
const chat_validator_1 = require("./chat.validator");
const typeorm_3 = require("typeorm");
const chat_settings_service_1 = require("./chat-settings.service");
let ChatService = class ChatService {
    static { ChatService_1 = this; }
    messages;
    validator;
    settings;
    static DEFAULT_HISTORY_LIMIT = 200;
    static CACHE_LIMIT = 2000;
    historyCache = null;
    constructor(messages, validator, settings) {
        this.messages = messages;
        this.validator = validator;
        this.settings = settings;
    }
    async recordMessageForBroadcast(user, text) {
        const sanitized = this.validator.validate(text);
        const messageId = this.generateMessageId();
        const createdAt = new Date();
        const message = this.messages.create({
            user: { id: user.id },
            message: sanitized,
            messageId,
            createdAt,
        });
        await this.messages.save(message);
        const normalized = {
            type: 'chat-message',
            id: messageId,
            text: sanitized,
            createdAt: createdAt.toISOString(),
            user: {
                id: user.id,
                username: user.username,
                avatar: null,
            },
        };
        this.appendToCache(normalized);
        return normalized;
    }
    async editOwnMessage(userId, messageId, text) {
        const id = (messageId || '').trim();
        if (!id) {
            throw new Error('Message introuvable.');
        }
        const message = await this.messages.findOne({
            where: { messageId: id },
            relations: ['user'],
        });
        if (!message || !message.user?.id) {
            throw new Error('Message introuvable.');
        }
        if (message.user.id !== userId) {
            throw new Error('Vous ne pouvez modifier que vos messages.');
        }
        if (message.deletedAt) {
            throw new Error('Message supprimé.');
        }
        const ageMs = Date.now() - message.createdAt.getTime();
        const windowMs = this.settings.getEditWindowSeconds() * 1000;
        if (windowMs <= 0 || ageMs > windowMs) {
            throw new Error('Message trop ancien pour être modifié.');
        }
        const sanitized = this.validator.validate(text);
        message.message = sanitized;
        await this.messages.save(message);
        const normalized = this.normalize(message);
        this.replaceInCache(normalized);
        return normalized;
    }
    async deleteOwnMessage(userId, messageId) {
        const id = (messageId || '').trim();
        if (!id)
            return false;
        const message = await this.messages.findOne({
            where: { messageId: id },
            relations: ['user'],
        });
        if (!message || !message.user?.id) {
            throw new Error('Message introuvable.');
        }
        if (message.user.id !== userId) {
            throw new Error('Vous ne pouvez supprimer que vos messages.');
        }
        if (message.deletedAt) {
            return true;
        }
        const ageMs = Date.now() - message.createdAt.getTime();
        const windowMs = this.settings.getEditWindowSeconds() * 1000;
        if (windowMs <= 0 || ageMs > windowMs) {
            throw new Error('Message trop ancien pour être supprimé.');
        }
        await this.messages.delete({ id: message.id });
        this.removeFromCache(id);
        return true;
    }
    async getRecentMessages(limit = ChatService_1.DEFAULT_HISTORY_LIMIT, since) {
        const qb = this.messages
            .createQueryBuilder('m')
            .leftJoinAndSelect('m.user', 'user')
            .where('m.deletedAt IS NULL')
            .orderBy('m.createdAt', 'DESC')
            .take(Math.min(Math.max(limit, 1), ChatService_1.CACHE_LIMIT));
        if (since) {
            qb.andWhere('m.createdAt >= :since', { since });
        }
        const rows = await qb.getMany();
        return rows.reverse();
    }
    async getRecentNormalizedMessages(limit = ChatService_1.DEFAULT_HISTORY_LIMIT) {
        await this.ensureHistoryCache();
        const safeLimit = Math.min(Math.max(limit, 1), ChatService_1.CACHE_LIMIT);
        return this.historyCache.slice(-safeLimit);
    }
    normalize(message) {
        const created = message.createdAt instanceof Date ? message.createdAt : new Date();
        const createdIso = isFinite(created.getTime())
            ? created.toISOString()
            : new Date().toISOString();
        return {
            type: 'chat-message',
            id: message.messageId,
            text: message.message,
            createdAt: createdIso,
            user: {
                id: message.user?.id,
                username: message.user?.username,
                avatar: message.user?.avatar ?? null,
            },
        };
    }
    normalizeMany(messages) {
        return messages.map((m) => this.normalize(m));
    }
    async adminListMessages(limit = ChatService_1.DEFAULT_HISTORY_LIMIT, includeDeleted = false) {
        const qb = this.messages
            .createQueryBuilder('m')
            .leftJoinAndSelect('m.user', 'user')
            .orderBy('m.createdAt', 'DESC')
            .take(Math.min(Math.max(limit, 1), ChatService_1.CACHE_LIMIT));
        if (!includeDeleted)
            qb.where({ deletedAt: (0, typeorm_3.IsNull)() });
        const rows = await qb.getMany();
        return rows.reverse();
    }
    async adminDeleteMessage(messageId) {
        const id = (messageId || '').trim();
        if (!id)
            return false;
        const res = await this.messages.delete({ messageId: id });
        if ((res.affected ?? 0) > 0) {
            this.removeFromCache(id);
        }
        return (res.affected ?? 0) > 0;
    }
    async adminClearAll() {
        const res = await this.messages
            .createQueryBuilder()
            .delete()
            .from(chat_message_entity_1.ChatMessage)
            .execute();
        if ((res.affected ?? 0) > 0) {
            this.historyCache = [];
        }
        return res.affected ?? 0;
    }
    generateMessageId() {
        return (0, crypto_1.randomBytes)(8).toString('hex');
    }
    async ensureHistoryCache() {
        if (this.historyCache !== null)
            return;
        const rows = await this.getRecentMessages(ChatService_1.CACHE_LIMIT);
        this.historyCache = this.normalizeMany(rows);
    }
    appendToCache(message) {
        if (this.historyCache === null) {
            this.historyCache = [];
        }
        this.historyCache.push(message);
        if (this.historyCache.length > ChatService_1.CACHE_LIMIT) {
            this.historyCache.splice(0, this.historyCache.length - ChatService_1.CACHE_LIMIT);
        }
    }
    removeFromCache(messageId) {
        if (!this.historyCache)
            return;
        const idx = this.historyCache.findIndex((m) => this.getCachedId(m) === messageId);
        if (idx >= 0)
            this.historyCache.splice(idx, 1);
    }
    replaceInCache(message) {
        if (!this.historyCache)
            return;
        const id = this.getCachedId(message);
        if (!id)
            return;
        const idx = this.historyCache.findIndex((m) => this.getCachedId(m) === id);
        if (idx >= 0) {
            this.historyCache[idx] = message;
        }
        else {
            this.appendToCache(message);
        }
    }
    getCachedId(message) {
        const raw = message['id'];
        return typeof raw === 'string' && raw.trim() ? raw : null;
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(chat_message_entity_1.ChatMessage)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        chat_validator_1.ChatValidator,
        chat_settings_service_1.ChatSettingsService])
], ChatService);
//# sourceMappingURL=chat.service.js.map