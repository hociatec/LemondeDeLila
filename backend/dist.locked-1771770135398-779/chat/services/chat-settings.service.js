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
var ChatSettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSettingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const chat_settings_entity_1 = require("../entities/chat-settings.entity");
let ChatSettingsService = class ChatSettingsService {
    static { ChatSettingsService_1 = this; }
    repo;
    logger = new common_1.Logger(ChatSettingsService_1.name);
    cache = null;
    static DEFAULT_HISTORY_LIMIT = 200;
    static MIN_HISTORY_LIMIT = 1;
    static MAX_HISTORY_LIMIT = 2000;
    static DEFAULT_EDIT_WINDOW_SECONDS = 5 * 60;
    static MIN_EDIT_WINDOW_SECONDS = 0;
    static MAX_EDIT_WINDOW_SECONDS = 24 * 60 * 60;
    constructor(repo) {
        this.repo = repo;
    }
    async onModuleInit() {
        await this.ensureSeeded();
    }
    getSettings() {
        return (this.cache ?? {
            chatHistoryLimit: ChatSettingsService_1.DEFAULT_HISTORY_LIMIT,
            editWindowSeconds: ChatSettingsService_1.DEFAULT_EDIT_WINDOW_SECONDS,
        });
    }
    getChatHistoryLimit() {
        return this.getSettings().chatHistoryLimit;
    }
    getEditWindowSeconds() {
        return this.getSettings().editWindowSeconds;
    }
    async updateSettings(update) {
        await this.ensureSeeded();
        const current = this.getSettings();
        const next = { ...current };
        if (update.chatHistoryLimit !== undefined) {
            next.chatHistoryLimit = this.clampHistoryLimit(update.chatHistoryLimit);
        }
        if (update.editWindowSeconds !== undefined) {
            next.editWindowSeconds = this.clampEditWindowSeconds(update.editWindowSeconds);
        }
        await this.repo.save({
            id: 1,
            chatHistoryLimit: next.chatHistoryLimit,
            editWindowSeconds: next.editWindowSeconds,
        });
        this.cache = next;
        return next;
    }
    clampHistoryLimit(value) {
        const candidate = Number(value);
        if (!Number.isFinite(candidate)) {
            return ChatSettingsService_1.DEFAULT_HISTORY_LIMIT;
        }
        const rounded = Math.round(candidate);
        if (rounded < ChatSettingsService_1.MIN_HISTORY_LIMIT) {
            return ChatSettingsService_1.MIN_HISTORY_LIMIT;
        }
        if (rounded > ChatSettingsService_1.MAX_HISTORY_LIMIT) {
            return ChatSettingsService_1.MAX_HISTORY_LIMIT;
        }
        return rounded;
    }
    clampEditWindowSeconds(value) {
        const candidate = Number(value);
        if (!Number.isFinite(candidate)) {
            return ChatSettingsService_1.DEFAULT_EDIT_WINDOW_SECONDS;
        }
        const rounded = Math.round(candidate);
        if (rounded < ChatSettingsService_1.MIN_EDIT_WINDOW_SECONDS) {
            return ChatSettingsService_1.MIN_EDIT_WINDOW_SECONDS;
        }
        if (rounded > ChatSettingsService_1.MAX_EDIT_WINDOW_SECONDS) {
            return ChatSettingsService_1.MAX_EDIT_WINDOW_SECONDS;
        }
        return rounded;
    }
    async ensureSeeded() {
        if (this.cache)
            return;
        try {
            const existing = await this.repo.findOne({ where: { id: 1 } });
            if (existing) {
                this.cache = {
                    chatHistoryLimit: this.clampHistoryLimit(existing.chatHistoryLimit),
                    editWindowSeconds: this.clampEditWindowSeconds(existing.editWindowSeconds ??
                        ChatSettingsService_1.DEFAULT_EDIT_WINDOW_SECONDS),
                };
                return;
            }
            const limit = ChatSettingsService_1.DEFAULT_HISTORY_LIMIT;
            const editWindowSeconds = ChatSettingsService_1.DEFAULT_EDIT_WINDOW_SECONDS;
            await this.repo.insert({
                id: 1,
                chatHistoryLimit: limit,
                editWindowSeconds,
            });
            this.cache = { chatHistoryLimit: limit, editWindowSeconds };
            return;
        }
        catch (error) {
            this.logger.warn(`Impossible de charger/initialiser chat_settings: ${error.message}`);
        }
        this.cache = {
            chatHistoryLimit: ChatSettingsService_1.DEFAULT_HISTORY_LIMIT,
            editWindowSeconds: ChatSettingsService_1.DEFAULT_EDIT_WINDOW_SECONDS,
        };
    }
};
exports.ChatSettingsService = ChatSettingsService;
exports.ChatSettingsService = ChatSettingsService = ChatSettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(chat_settings_entity_1.ChatSettingsEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ChatSettingsService);
//# sourceMappingURL=chat-settings.service.js.map