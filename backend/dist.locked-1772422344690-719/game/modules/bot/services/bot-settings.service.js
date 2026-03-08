"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BotSettingsService", {
    enumerable: true,
    get: function() {
        return BotSettingsService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _botsettingsentity = require("../entities/bot-settings.entity");
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
let BotSettingsService = class BotSettingsService {
    async onModuleInit() {
        await this.ensureSeeded();
    }
    getSettings() {
        const root = this.getRoot();
        return {
            botTurnDelayMs: root.botTurnDelayMs,
            botStartDelayMs: root.botStartDelayMs,
            botDrawDelayMs: root.botDrawDelayMs
        };
    }
    getBotTurnDelayMs() {
        return this.getRoot().botTurnDelayMs;
    }
    getBotStartDelayMs() {
        return this.getRoot().botStartDelayMs;
    }
    getBotDrawDelayMs() {
        return this.getRoot().botDrawDelayMs;
    }
    async updateSettings(update) {
        await this.ensureSeeded();
        const root = this.getRoot();
        if (update.botTurnDelayMs !== undefined) {
            root.botTurnDelayMs = this.clampDelay(update.botTurnDelayMs);
        }
        if (update.botStartDelayMs !== undefined) {
            root.botStartDelayMs = this.clampDelay(update.botStartDelayMs);
        }
        if (update.botDrawDelayMs !== undefined) {
            root.botDrawDelayMs = this.clampDelay(update.botDrawDelayMs);
        }
        await this.repo.save({
            id: 1,
            botTurnDelayMs: root.botTurnDelayMs,
            botStartDelayMs: root.botStartDelayMs,
            botDrawDelayMs: root.botDrawDelayMs
        });
        if (!this.cache) {
            this.cache = {
                botTurnDelayMs: root.botTurnDelayMs,
                botStartDelayMs: root.botStartDelayMs,
                botDrawDelayMs: root.botDrawDelayMs
            };
        } else {
            this.cache = {
                botTurnDelayMs: root.botTurnDelayMs,
                botStartDelayMs: root.botStartDelayMs,
                botDrawDelayMs: root.botDrawDelayMs
            };
        }
        return {
            botTurnDelayMs: root.botTurnDelayMs,
            botStartDelayMs: root.botStartDelayMs,
            botDrawDelayMs: root.botDrawDelayMs
        };
    }
    clampDelay(value) {
        const candidate = Number(value);
        if (!Number.isFinite(candidate)) {
            return BotSettingsService.DEFAULT_TURN_DELAY_MS;
        }
        const rounded = Math.round(candidate);
        if (rounded < BotSettingsService.MIN_DELAY_MS) {
            return BotSettingsService.MIN_DELAY_MS;
        }
        if (rounded > BotSettingsService.MAX_DELAY_MS) {
            return BotSettingsService.MAX_DELAY_MS;
        }
        return rounded;
    }
    getRoot() {
        if (this.cache) {
            return this.cache;
        }
        return {
            botTurnDelayMs: BotSettingsService.DEFAULT_TURN_DELAY_MS,
            botStartDelayMs: BotSettingsService.DEFAULT_START_DELAY_MS,
            botDrawDelayMs: BotSettingsService.DEFAULT_DRAW_DELAY_MS
        };
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
                    botTurnDelayMs: this.clampDelay(existing.botTurnDelayMs),
                    botStartDelayMs: this.clampDelay(existing.botStartDelayMs),
                    botDrawDelayMs: this.clampDelay(existing.botDrawDelayMs)
                };
                return;
            }
            const delay = BotSettingsService.DEFAULT_TURN_DELAY_MS;
            const startDelay = BotSettingsService.DEFAULT_START_DELAY_MS;
            const drawDelay = BotSettingsService.DEFAULT_DRAW_DELAY_MS;
            await this.repo.insert({
                id: 1,
                botTurnDelayMs: delay,
                botStartDelayMs: startDelay,
                botDrawDelayMs: drawDelay
            });
            this.cache = {
                botTurnDelayMs: delay,
                botStartDelayMs: startDelay,
                botDrawDelayMs: drawDelay
            };
        } catch (error) {
            this.logger.warn(`Impossible de charger/initialiser bot_settings: ${error.message}`);
            this.cache = {
                botTurnDelayMs: BotSettingsService.DEFAULT_TURN_DELAY_MS,
                botStartDelayMs: BotSettingsService.DEFAULT_START_DELAY_MS,
                botDrawDelayMs: BotSettingsService.DEFAULT_DRAW_DELAY_MS
            };
        }
    }
    constructor(repo){
        this.repo = repo;
        this.logger = new _common.Logger(BotSettingsService.name);
        this.cache = null;
    }
};
BotSettingsService.DEFAULT_TURN_DELAY_MS = 4000;
BotSettingsService.DEFAULT_START_DELAY_MS = 4000;
BotSettingsService.DEFAULT_DRAW_DELAY_MS = 4000;
BotSettingsService.MIN_DELAY_MS = 0;
BotSettingsService.MAX_DELAY_MS = 60000;
BotSettingsService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _typeorm.InjectRepository)(_botsettingsentity.BotSettingsEntity)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], BotSettingsService);
