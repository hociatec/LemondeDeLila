"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ChatSettingsService", {
    enumerable: true,
    get: function() {
        return ChatSettingsService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _chatsettingsentity = require("../entities/chat-settings.entity");
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
let ChatSettingsService = class ChatSettingsService {
    async onModuleInit() {
        await this.ensureSeeded();
    }
    getSettings() {
        return this.cache ?? {
            chatHistoryLimit: ChatSettingsService.DEFAULT_HISTORY_LIMIT,
            editWindowSeconds: ChatSettingsService.DEFAULT_EDIT_WINDOW_SECONDS
        };
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
        const next = {
            ...current
        };
        if (update.chatHistoryLimit !== undefined) {
            next.chatHistoryLimit = this.clampHistoryLimit(update.chatHistoryLimit);
        }
        if (update.editWindowSeconds !== undefined) {
            next.editWindowSeconds = this.clampEditWindowSeconds(update.editWindowSeconds);
        }
        await this.repo.save({
            id: 1,
            chatHistoryLimit: next.chatHistoryLimit,
            editWindowSeconds: next.editWindowSeconds
        });
        this.cache = next;
        return next;
    }
    clampHistoryLimit(value) {
        const candidate = Number(value);
        if (!Number.isFinite(candidate)) {
            return ChatSettingsService.DEFAULT_HISTORY_LIMIT;
        }
        const rounded = Math.round(candidate);
        if (rounded < ChatSettingsService.MIN_HISTORY_LIMIT) {
            return ChatSettingsService.MIN_HISTORY_LIMIT;
        }
        if (rounded > ChatSettingsService.MAX_HISTORY_LIMIT) {
            return ChatSettingsService.MAX_HISTORY_LIMIT;
        }
        return rounded;
    }
    clampEditWindowSeconds(value) {
        const candidate = Number(value);
        if (!Number.isFinite(candidate)) {
            return ChatSettingsService.DEFAULT_EDIT_WINDOW_SECONDS;
        }
        const rounded = Math.round(candidate);
        if (rounded < ChatSettingsService.MIN_EDIT_WINDOW_SECONDS) {
            return ChatSettingsService.MIN_EDIT_WINDOW_SECONDS;
        }
        if (rounded > ChatSettingsService.MAX_EDIT_WINDOW_SECONDS) {
            return ChatSettingsService.MAX_EDIT_WINDOW_SECONDS;
        }
        return rounded;
    }
    async ensureSeeded() {
        if (this.cache) return;
        try {
            const existing = await this.repo.findOne({
                where: {
                    id: 1
                }
            });
            if (existing) {
                this.cache = {
                    chatHistoryLimit: this.clampHistoryLimit(existing.chatHistoryLimit),
                    editWindowSeconds: this.clampEditWindowSeconds(existing.editWindowSeconds ?? ChatSettingsService.DEFAULT_EDIT_WINDOW_SECONDS)
                };
                return;
            }
            const limit = ChatSettingsService.DEFAULT_HISTORY_LIMIT;
            const editWindowSeconds = ChatSettingsService.DEFAULT_EDIT_WINDOW_SECONDS;
            await this.repo.insert({
                id: 1,
                chatHistoryLimit: limit,
                editWindowSeconds
            });
            this.cache = {
                chatHistoryLimit: limit,
                editWindowSeconds
            };
            return;
        } catch (error) {
            this.logger.warn(`Impossible de charger/initialiser chat_settings: ${error.message}`);
        }
        this.cache = {
            chatHistoryLimit: ChatSettingsService.DEFAULT_HISTORY_LIMIT,
            editWindowSeconds: ChatSettingsService.DEFAULT_EDIT_WINDOW_SECONDS
        };
    }
    constructor(repo){
        this.repo = repo;
        this.logger = new _common.Logger(ChatSettingsService.name);
        this.cache = null;
    }
};
ChatSettingsService.DEFAULT_HISTORY_LIMIT = 200;
ChatSettingsService.MIN_HISTORY_LIMIT = 1;
ChatSettingsService.MAX_HISTORY_LIMIT = 2000;
ChatSettingsService.DEFAULT_EDIT_WINDOW_SECONDS = 5 * 60;
ChatSettingsService.MIN_EDIT_WINDOW_SECONDS = 0;
ChatSettingsService.MAX_EDIT_WINDOW_SECONDS = 24 * 60 * 60;
ChatSettingsService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _typeorm.InjectRepository)(_chatsettingsentity.ChatSettingsEntity)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], ChatSettingsService);
