"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminChatWsHandler", {
    enumerable: true,
    get: function() {
        return AdminChatWsHandler;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _chatservice = require("../../chat/services/chat.service");
const _chatsettingsservice = require("../../chat/services/chat-settings.service");
const _userentity = require("../../user/entities/user.entity");
const _adminwsdto = require("./admin-ws.dto");
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
let AdminChatWsHandler = class AdminChatWsHandler {
    async chatMessages(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminChatMessagesWsDto, payload);
        const rows = await this.chat.adminListMessages(dto.limit ?? this.chatSettings.getChatHistoryLimit(), dto.includeDeleted ?? false);
        const messages = rows.map((m)=>({
                id: m.messageId,
                text: m.message,
                createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date().toISOString(),
                deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
                user: {
                    id: m.user?.id ?? null,
                    username: m.user?.username ?? null,
                    avatar: m.user?.avatar ?? null,
                    chatBannedUntil: m.user?.chatBannedUntil ? m.user.chatBannedUntil instanceof Date ? m.user.chatBannedUntil.toISOString() : null : null,
                    chatBanReason: m.user?.chatBanReason ?? null
                }
            }));
        return {
            type: 'admin.chat.messages',
            payload: {
                messages
            }
        };
    }
    chatSettingsGet(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        this.validator.validate(_adminwsdto.AdminChatSettingsGetWsDto, payload ?? {});
        return {
            type: 'admin.chat.settings.get',
            payload: this.chatSettings.getSettings()
        };
    }
    async chatSettingsUpdate(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminChatSettingsUpdateWsDto, payload);
        const updated = await this.chatSettings.updateSettings({
            chatHistoryLimit: dto.chatHistoryLimit,
            editWindowSeconds: dto.editWindowSeconds
        });
        return {
            type: 'admin.chat.settings.update',
            payload: updated
        };
    }
    async chatDelete(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminChatDeleteWsDto, payload);
        const ok = await this.chat.adminDeleteMessage(dto.messageId);
        return {
            type: 'admin.chat.delete',
            payload: {
                ok
            }
        };
    }
    async chatClear(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        this.validator.validate(_adminwsdto.AdminChatClearWsDto, payload);
        const deleted = await this.chat.adminClearAll();
        return {
            type: 'admin.chat.clear',
            payload: {
                deleted
            }
        };
    }
    async chatBan(session, payload) {
        const admin = (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminChatBanWsDto, payload);
        const user = await this.userRepo.findOne({
            where: {
                id: dto.id
            }
        });
        if (!user) {
            throw new _common.BadRequestException('Utilisateur introuvable');
        }
        const days = dto.durationDays && dto.durationDays > 0 ? dto.durationDays : 3650;
        const until = new Date(Date.now() + days * 24 * 60 * 60_000);
        user.chatBannedUntil = until;
        user.chatBanReason = (dto.reason || '').trim() || null;
        await this.userRepo.save(user);
        return {
            type: 'admin.chat.ban',
            payload: {
                ok: true,
                userId: user.id,
                chatBannedUntil: until.toISOString(),
                chatBanReason: user.chatBanReason,
                byUserId: admin.id
            }
        };
    }
    async chatUnban(session, payload) {
        const admin = (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminChatUnbanWsDto, payload);
        const user = await this.userRepo.findOne({
            where: {
                id: dto.id
            }
        });
        if (!user) {
            throw new _common.BadRequestException('Utilisateur introuvable');
        }
        user.chatBannedUntil = null;
        user.chatBanReason = null;
        await this.userRepo.save(user);
        return {
            type: 'admin.chat.unban',
            payload: {
                ok: true,
                userId: user.id,
                byUserId: admin.id
            }
        };
    }
    constructor(validator, chat, chatSettings, userRepo){
        this.validator = validator;
        this.chat = chat;
        this.chatSettings = chatSettings;
        this.userRepo = userRepo;
    }
};
AdminChatWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(3, (0, _typeorm.InjectRepository)(_userentity.User)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _chatservice.ChatService === "undefined" ? Object : _chatservice.ChatService,
        typeof _chatsettingsservice.ChatSettingsService === "undefined" ? Object : _chatsettingsservice.ChatSettingsService,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], AdminChatWsHandler);
