"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MessagingService", {
    enumerable: true,
    get: function() {
        return MessagingService;
    }
});
const _common = require("@nestjs/common");
const _crypto = /*#__PURE__*/ _interop_require_wildcard(require("crypto"));
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _privatemessageentity = require("../entities/private-message.entity");
const _userentity = require("../../user/entities/user.entity");
const _messagevalidatorservice = require("./message-validator.service");
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
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
let MessagingService = class MessagingService {
    async send(senderId, payload) {
        const sender = await this.ensureUser(senderId);
        if (sender.id === payload.recipientId) {
            throw new _common.BadRequestException('Vous ne pouvez pas vous envoyer un message');
        }
        const recipient = await this.users.findOne({
            where: {
                id: payload.recipientId
            }
        });
        if (!recipient) {
            throw new _common.NotFoundException('Destinataire introuvable');
        }
        const sanitized = this.validator.validate(payload.text);
        const subject = this.validator.validateSubject(payload.subject);
        const message = this.messages.create({
            sender,
            recipient,
            messageId: this.generateMessageId(),
            message: sanitized,
            subject
        });
        await this.messages.save(message);
        return this.toDto(message, sender.id);
    }
    async conversation(currentId, otherUserId, limit = MessagingService.DEFAULT_HISTORY_LIMIT) {
        if (currentId === otherUserId) {
            return [];
        }
        const other = await this.users.findOne({
            where: {
                id: otherUserId
            }
        });
        if (!other) {
            throw new _common.NotFoundException('Utilisateur introuvable');
        }
        const clamped = this.clampLimit(limit);
        const items = await this.messages.createQueryBuilder('m').leftJoinAndSelect('m.sender', 'sender').leftJoinAndSelect('m.recipient', 'recipient').where('(m.sender_id = :current AND m.recipient_id = :other AND m.deleted_by_sender_at IS NULL) OR (m.sender_id = :other AND m.recipient_id = :current AND m.deleted_by_recipient_at IS NULL)').setParameters({
            current: currentId,
            other: otherUserId
        }).orderBy('m.created_at', 'ASC').limit(clamped).getMany();
        return items.map((m)=>this.toDto(m, currentId));
    }
    async inbox(userId, limit = MessagingService.DEFAULT_HISTORY_LIMIT) {
        const clamped = this.clampLimit(limit);
        const items = await this.messages.createQueryBuilder('m').leftJoinAndSelect('m.sender', 'sender').leftJoinAndSelect('m.recipient', 'recipient').where('m.recipient_id = :user AND m.deleted_by_recipient_at IS NULL', {
            user: userId
        }).orderBy('m.created_at', 'DESC').limit(clamped).getMany();
        return items.map((m)=>this.toDto(m, userId));
    }
    async outbox(userId, limit = MessagingService.DEFAULT_HISTORY_LIMIT) {
        const clamped = this.clampLimit(limit);
        const items = await this.messages.createQueryBuilder('m').leftJoinAndSelect('m.sender', 'sender').leftJoinAndSelect('m.recipient', 'recipient').where('m.sender_id = :user AND m.deleted_by_sender_at IS NULL', {
            user: userId
        }).orderBy('m.created_at', 'DESC').limit(clamped).getMany();
        return items.map((m)=>this.toDto(m, userId));
    }
    async deleted(userId, limit = MessagingService.DEFAULT_HISTORY_LIMIT) {
        const clamped = this.clampLimit(limit);
        const items = await this.messages.createQueryBuilder('m').leftJoinAndSelect('m.sender', 'sender').leftJoinAndSelect('m.recipient', 'recipient').addSelect(`CASE WHEN m.deleted_by_sender_at IS NOT NULL THEN m.deleted_by_sender_at ELSE m.deleted_by_recipient_at END`, 'deletionDate').where('(m.sender_id = :user AND m.deleted_by_sender_at IS NOT NULL) OR (m.recipient_id = :user AND m.deleted_by_recipient_at IS NOT NULL)', {
            user: userId
        }).orderBy('deletionDate', 'DESC').limit(clamped).getMany();
        return items.map((m)=>this.toDto(m, userId));
    }
    async delete(userId, messageId) {
        const message = await this.messages.findOne({
            where: {
                messageId
            },
            relations: [
                'sender',
                'recipient'
            ]
        });
        if (!message) {
            throw new _common.NotFoundException('Message introuvable');
        }
        const isSender = message.sender.id === userId;
        const isRecipient = message.recipient.id === userId;
        if (!isSender && !isRecipient) {
            throw new _common.ForbiddenException('Non autorise');
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
            where: {
                messageId
            },
            relations: [
                'sender',
                'recipient'
            ]
        });
        if (!message) {
            throw new _common.NotFoundException('Message introuvable');
        }
        const isSender = message.sender.id === userId;
        const isRecipient = message.recipient.id === userId;
        if (!isSender && !isRecipient) {
            throw new _common.ForbiddenException('Non autorise');
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
            throw new _common.BadRequestException('Message deja restaure');
        }
        await this.messages.save(message);
        return this.toDto(message, userId);
    }
    async purge(userId, messageId) {
        const message = await this.messages.findOne({
            where: {
                messageId
            },
            relations: [
                'sender',
                'recipient'
            ]
        });
        if (!message) {
            throw new _common.NotFoundException('Message introuvable');
        }
        const isSender = message.sender.id === userId;
        const isRecipient = message.recipient.id === userId;
        if (!isSender && !isRecipient) {
            throw new _common.ForbiddenException('Non autorise');
        }
        if (isSender && !message.deletedBySenderAt) {
            throw new _common.BadRequestException('Message pas dans la corbeille');
        }
        if (isRecipient && !message.deletedByRecipientAt) {
            throw new _common.BadRequestException('Message pas dans la corbeille');
        }
        const dto = this.toDto(message, userId);
        await this.messages.remove(message);
        return dto;
    }
    async markRead(userId, messageId) {
        const id = String(messageId || '').trim();
        if (!id) return;
        const message = await this.messages.findOne({
            where: {
                messageId: id
            },
            relations: [
                'sender',
                'recipient'
            ]
        });
        if (!message) {
            throw new _common.NotFoundException('Message introuvable');
        }
        if (message.recipient?.id !== userId) {
            throw new _common.ForbiddenException('Non autorise');
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
        const user = await this.users.createQueryBuilder('u').select([
            'u.id',
            'u.username'
        ]).where('LOWER(u.username) = LOWER(:u)', {
            u: normalized
        }).getOne();
        if (!user) return null;
        return {
            id: user.id,
            username: user.username
        };
    }
    async ensureUser(id) {
        const user = await this.users.findOne({
            where: {
                id
            },
            select: [
                'id',
                'username'
            ]
        });
        if (!user) {
            throw new _common.NotFoundException('Utilisateur introuvable');
        }
        return user;
    }
    toDto(message, viewerId) {
        const direction = message.sender.id === viewerId ? 'sent' : 'received';
        const deletedAt = direction === 'sent' ? message.deletedBySenderAt ?? null : message.deletedByRecipientAt ?? null;
        const boxType = deletedAt != null ? 'deleted' : direction === 'sent' ? 'outbox' : 'inbox';
        return {
            id: message.messageId,
            sender: {
                id: message.sender.id,
                username: message.sender.username
            },
            recipient: {
                id: message.recipient.id,
                username: message.recipient.username
            },
            text: message.message,
            subject: message.subject ?? null,
            createdAt: message.createdAt.toISOString(),
            direction,
            deletedAt: deletedAt ? deletedAt.toISOString() : null,
            boxType
        };
    }
    clampLimit(limit) {
        return Math.max(1, Math.min(500, limit || MessagingService.DEFAULT_HISTORY_LIMIT));
    }
    generateMessageId() {
        if (_crypto.randomUUID) {
            return _crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        }
        return Math.random().toString(16).slice(2, 18);
    }
    constructor(messages, users, validator){
        this.messages = messages;
        this.users = users;
        this.validator = validator;
    }
};
MessagingService.DEFAULT_HISTORY_LIMIT = 100;
MessagingService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _typeorm.InjectRepository)(_privatemessageentity.PrivateMessage)),
    _ts_param(1, (0, _typeorm.InjectRepository)(_userentity.User)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _messagevalidatorservice.MessageValidatorService === "undefined" ? Object : _messagevalidatorservice.MessageValidatorService
    ])
], MessagingService);
