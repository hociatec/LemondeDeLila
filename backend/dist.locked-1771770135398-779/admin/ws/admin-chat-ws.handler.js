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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminChatWsHandler = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const chat_service_1 = require("../../chat/services/chat.service");
const chat_settings_service_1 = require("../../chat/services/chat-settings.service");
const user_entity_1 = require("../../user/entities/user.entity");
const admin_ws_dto_1 = require("./admin-ws.dto");
let AdminChatWsHandler = class AdminChatWsHandler {
    validator;
    chat;
    chatSettings;
    userRepo;
    constructor(validator, chat, chatSettings, userRepo) {
        this.validator = validator;
        this.chat = chat;
        this.chatSettings = chatSettings;
        this.userRepo = userRepo;
    }
    async chatMessages(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminChatMessagesWsDto, payload);
        const rows = await this.chat.adminListMessages(dto.limit ?? this.chatSettings.getChatHistoryLimit(), dto.includeDeleted ?? false);
        const messages = rows.map((m) => ({
            id: m.messageId,
            text: m.message,
            createdAt: m.createdAt instanceof Date
                ? m.createdAt.toISOString()
                : new Date().toISOString(),
            deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
            user: {
                id: m.user?.id ?? null,
                username: m.user?.username ?? null,
                avatar: m.user?.avatar ?? null,
                chatBannedUntil: m.user?.chatBannedUntil
                    ? m.user.chatBannedUntil instanceof Date
                        ? m.user.chatBannedUntil.toISOString()
                        : null
                    : null,
                chatBanReason: m.user?.chatBanReason ?? null,
            },
        }));
        return { type: 'admin.chat.messages', payload: { messages } };
    }
    chatSettingsGet(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        this.validator.validate(admin_ws_dto_1.AdminChatSettingsGetWsDto, payload ?? {});
        return {
            type: 'admin.chat.settings.get',
            payload: this.chatSettings.getSettings(),
        };
    }
    async chatSettingsUpdate(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminChatSettingsUpdateWsDto, payload);
        const updated = await this.chatSettings.updateSettings({
            chatHistoryLimit: dto.chatHistoryLimit,
            editWindowSeconds: dto.editWindowSeconds,
        });
        return { type: 'admin.chat.settings.update', payload: updated };
    }
    async chatDelete(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminChatDeleteWsDto, payload);
        const ok = await this.chat.adminDeleteMessage(dto.messageId);
        return { type: 'admin.chat.delete', payload: { ok } };
    }
    async chatClear(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        this.validator.validate(admin_ws_dto_1.AdminChatClearWsDto, payload);
        const deleted = await this.chat.adminClearAll();
        return { type: 'admin.chat.clear', payload: { deleted } };
    }
    async chatBan(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminChatBanWsDto, payload);
        const user = await this.userRepo.findOne({ where: { id: dto.id } });
        if (!user) {
            throw new common_1.BadRequestException('Utilisateur introuvable');
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
                byUserId: admin.id,
            },
        };
    }
    async chatUnban(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminChatUnbanWsDto, payload);
        const user = await this.userRepo.findOne({ where: { id: dto.id } });
        if (!user) {
            throw new common_1.BadRequestException('Utilisateur introuvable');
        }
        user.chatBannedUntil = null;
        user.chatBanReason = null;
        await this.userRepo.save(user);
        return {
            type: 'admin.chat.unban',
            payload: { ok: true, userId: user.id, byUserId: admin.id },
        };
    }
};
exports.AdminChatWsHandler = AdminChatWsHandler;
exports.AdminChatWsHandler = AdminChatWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        chat_service_1.ChatService,
        chat_settings_service_1.ChatSettingsService,
        typeorm_2.Repository])
], AdminChatWsHandler);
//# sourceMappingURL=admin-chat-ws.handler.js.map