"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MessagingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const private_message_entity_1 = require("../entities/private-message.entity");
const user_entity_1 = require("../../user/entities/user.entity");
const message_validator_service_1 = require("./message-validator.service");
let MessagingService = class MessagingService {
    static { MessagingService_1 = this; }
    messages;
    users;
    validator;
    static DEFAULT_HISTORY_LIMIT = 100;
    constructor(messages, users, validator) {
        this.messages = messages;
        this.users = users;
        this.validator = validator;
    }
    async send(senderId, payload) {
        const sender = await this.ensureUser(senderId);
        if (sender.id === payload.recipientId) {
            throw new common_1.BadRequestException('Vous ne pouvez pas vous envoyer un message');
        }
        const recipient = await this.users.findOne({
            where: { id: payload.recipientId },
        });
        if (!recipient) {
            throw new common_1.NotFoundException('Destinataire introuvable');
        }
        const sanitized = this.validator.validate(payload.text);
        const subject = this.validator.validateSubject(payload.subject);
        const message = this.messages.create({
            sender,
            recipient,
            messageId: this.generateMessageId(),
            message: sanitized,
            subject,
        });
        await this.messages.save(message);
        return this.toDto(message, sender.id);
    }
    async conversation(currentId, otherUserId, limit = MessagingService_1.DEFAULT_HISTORY_LIMIT) {
        if (currentId === otherUserId) {
            return [];
        }
        const other = await this.users.findOne({ where: { id: otherUserId } });
        if (!other) {
            throw new common_1.NotFoundException('Utilisateur introuvable');
        }
        const clamped = this.clampLimit(limit);
        const items = await this.messages
            .createQueryBuilder('m')
            .leftJoinAndSelect('m.sender', 'sender')
            .leftJoinAndSelect('m.recipient', 'recipient')
            .where('(m.sender_id = :current AND m.recipient_id = :other AND m.deleted_by_sender_at IS NULL) OR (m.sender_id = :other AND m.recipient_id = :current AND m.deleted_by_recipient_at IS NULL)')
            .setParameters({ current: currentId, other: otherUserId })
            .orderBy('m.created_at', 'ASC')
            .limit(clamped)
            .getMany();
        return items.map((m) => this.toDto(m, currentId));
    }
    async inbox(userId, limit = MessagingService_1.DEFAULT_HISTORY_LIMIT) {
        const clamped = this.clampLimit(limit);
        const items = await this.messages
            .createQueryBuilder('m')
            .leftJoinAndSelect('m.sender', 'sender')
            .leftJoinAndSelect('m.recipient', 'recipient')
            .where('m.recipient_id = :user AND m.deleted_by_recipient_at IS NULL', {
            user: userId,
        })
            .orderBy('m.created_at', 'DESC')
            .limit(clamped)
            .getMany();
        return items.map((m) => this.toDto(m, userId));
    }
    async outbox(userId, limit = MessagingService_1.DEFAULT_HISTORY_LIMIT) {
        const clamped = this.clampLimit(limit);
        const items = await this.messages
            .createQueryBuilder('m')
            .leftJoinAndSelect('m.sender', 'sender')
            .leftJoinAndSelect('m.recipient', 'recipient')
            .where('m.sender_id = :user AND m.deleted_by_sender_at IS NULL', {
            user: userId,
        })
            .orderBy('m.created_at', 'DESC')
            .limit(clamped)
            .getMany();
        return items.map((m) => this.toDto(m, userId));
    }
    async deleted(userId, limit = MessagingService_1.DEFAULT_HISTORY_LIMIT) {
        const clamped = this.clampLimit(limit);
        const items = await this.messages
            .createQueryBuilder('m')
            .leftJoinAndSelect('m.sender', 'sender')
            .leftJoinAndSelect('m.recipient', 'recipient')
            .addSelect(`CASE WHEN m.deleted_by_sender_at IS NOT NULL THEN m.deleted_by_sender_at ELSE m.deleted_by_recipient_at END`, 'deletionDate')
            .where('(m.sender_id = :user AND m.deleted_by_sender_at IS NOT NULL) OR (m.recipient_id = :user AND m.deleted_by_recipient_at IS NOT NULL)', { user: userId })
            .orderBy('deletionDate', 'DESC')
            .limit(clamped)
            .getMany();
        return items.map((m) => this.toDto(m, userId));
    }
    async delete(userId, messageId) {
        const message = await this.messages.findOne({
            where: { messageId },
            relations: ['sender', 'recipient'],
        });
        if (!message) {
            throw new common_1.NotFoundException('Message introuvable');
        }
        const isSender = message.sender.id === userId;
        const isRecipient = message.recipient.id === userId;
        if (!isSender && !isRecipient) {
            throw new common_1.ForbiddenException('Non autorise');
        }
        let changed = false;
        if (isSender && !message.deletedBySenderAt) {
            message.deletedBySenderAt = new Date();
            changed = true;
        }
        if (isRecipient && !message.deletedByRecipientAt) {
            message.deletedByRecipientAt = new Date();
            changed = true;
        }
        if (changed) {
            await this.messages.save(message);
        }
        return this.toDto(message, userId);
    }
    async restore(userId, messageId) {
        const message = await this.messages.findOne({
            where: { messageId },
            relations: ['sender', 'recipient'],
        });
        if (!message) {
            throw new common_1.NotFoundException('Message introuvable');
        }
        const isSender = message.sender.id === userId;
        const isRecipient = message.recipient.id === userId;
        if (!isSender && !isRecipient) {
            throw new common_1.ForbiddenException('Non autorise');
        }
        let changed = false;
        if (isSender && message.deletedBySenderAt) {
            message.deletedBySenderAt = null;
            changed = true;
        }
        if (isRecipient && message.deletedByRecipientAt) {
            message.deletedByRecipientAt = null;
            changed = true;
        }
        if (!changed) {
            throw new common_1.BadRequestException('Message deja restaure');
        }
        await this.messages.save(message);
        return this.toDto(message, userId);
    }
    async purge(userId, messageId) {
        const message = await this.messages.findOne({
            where: { messageId },
            relations: ['sender', 'recipient'],
        });
        if (!message) {
            throw new common_1.NotFoundException('Message introuvable');
        }
        const isSender = message.sender.id === userId;
        const isRecipient = message.recipient.id === userId;
        if (!isSender && !isRecipient) {
            throw new common_1.ForbiddenException('Non autorise');
        }
        if (isSender && !message.deletedBySenderAt) {
            throw new common_1.BadRequestException('Message pas dans la corbeille');
        }
        if (isRecipient && !message.deletedByRecipientAt) {
            throw new common_1.BadRequestException('Message pas dans la corbeille');
        }
        const dto = this.toDto(message, userId);
        await this.messages.remove(message);
        return dto;
    }
    async markRead(userId, messageId) {
        const id = String(messageId || '').trim();
        if (!id)
            return;
        const message = await this.messages.findOne({
            where: { messageId: id },
            relations: ['sender', 'recipient'],
        });
        if (!message) {
            throw new common_1.NotFoundException('Message introuvable');
        }
        if (message.recipient?.id !== userId) {
            throw new common_1.ForbiddenException('Non autorise');
        }
        if (message.deletedByRecipientAt) {
            return;
        }
        if (message.readByRecipientAt) {
            return;
        }
        message.readByRecipientAt = new Date();
        await this.messages.save(message);
    }
    async lookupUser(username) {
        const normalized = (username ?? '').trim();
        if (!normalized) {
            return null;
        }
        const user = await this.users
            .createQueryBuilder('u')
            .select(['u.id', 'u.username'])
            .where('LOWER(u.username) = LOWER(:u)', { u: normalized })
            .getOne();
        if (!user)
            return null;
        return { id: user.id, username: user.username };
    }
    async ensureUser(id) {
        const user = await this.users.findOne({
            where: { id },
            select: ['id', 'username'],
        });
        if (!user) {
            throw new common_1.NotFoundException('Utilisateur introuvable');
        }
        return user;
    }
    toDto(message, viewerId) {
        const direction = message.sender.id === viewerId ? 'sent' : 'received';
        const deletedAt = direction === 'sent'
            ? (message.deletedBySenderAt ?? null)
            : (message.deletedByRecipientAt ?? null);
        const boxType = deletedAt != null ? 'deleted' : direction === 'sent' ? 'outbox' : 'inbox';
        return {
            id: message.messageId,
            sender: { id: message.sender.id, username: message.sender.username },
            recipient: {
                id: message.recipient.id,
                username: message.recipient.username,
            },
            text: message.message,
            subject: message.subject ?? null,
            createdAt: message.createdAt.toISOString(),
            direction,
            deletedAt: deletedAt ? deletedAt.toISOString() : null,
            boxType,
        };
    }
    clampLimit(limit) {
        return Math.max(1, Math.min(500, limit || MessagingService_1.DEFAULT_HISTORY_LIMIT));
    }
    generateMessageId() {
        if (crypto.randomUUID) {
            return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        }
        return Math.random().toString(16).slice(2, 18);
    }
};
exports.MessagingService = MessagingService;
exports.MessagingService = MessagingService = MessagingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(private_message_entity_1.PrivateMessage)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        message_validator_service_1.MessageValidatorService])
], MessagingService);
//# sourceMappingURL=messaging.service.js.map