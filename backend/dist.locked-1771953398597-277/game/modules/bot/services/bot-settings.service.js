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
var BotSettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotSettingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bot_settings_entity_1 = require("../entities/bot-settings.entity");
let BotSettingsService = class BotSettingsService {
    static { BotSettingsService_1 = this; }
    repo;
    logger = new common_1.Logger(BotSettingsService_1.name);
    cache = null;
    static DEFAULT_TURN_DELAY_MS = 4000;
    static DEFAULT_START_DELAY_MS = 4000;
    static DEFAULT_DRAW_DELAY_MS = 4000;
    static MIN_DELAY_MS = 0;
    static MAX_DELAY_MS = 60000;
    constructor(repo) {
        this.repo = repo;
    }
    async onModuleInit() {
        await this.ensureSeeded();
    }
    getSettings() {
        const root = this.getRoot();
        return {
            botTurnDelayMs: root.botTurnDelayMs,
            botStartDelayMs: root.botStartDelayMs,
            botDrawDelayMs: root.botDrawDelayMs,
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
            botDrawDelayMs: root.botDrawDelayMs,
        });
        if (!this.cache) {
            this.cache = {
                botTurnDelayMs: root.botTurnDelayMs,
                botStartDelayMs: root.botStartDelayMs,
                botDrawDelayMs: root.botDrawDelayMs,
            };
        }
        else {
            this.cache = {
                botTurnDelayMs: root.botTurnDelayMs,
                botStartDelayMs: root.botStartDelayMs,
                botDrawDelayMs: root.botDrawDelayMs,
            };
        }
        return {
            botTurnDelayMs: root.botTurnDelayMs,
            botStartDelayMs: root.botStartDelayMs,
            botDrawDelayMs: root.botDrawDelayMs,
        };
    }
    clampDelay(value) {
        const candidate = Number(value);
        if (!Number.isFinite(candidate)) {
            return BotSettingsService_1.DEFAULT_TURN_DELAY_MS;
        }
        const rounded = Math.round(candidate);
        if (rounded < BotSettingsService_1.MIN_DELAY_MS) {
            return BotSettingsService_1.MIN_DELAY_MS;
        }
        if (rounded > BotSettingsService_1.MAX_DELAY_MS) {
            return BotSettingsService_1.MAX_DELAY_MS;
        }
        return rounded;
    }
    getRoot() {
        if (this.cache) {
            return this.cache;
        }
        return {
            botTurnDelayMs: BotSettingsService_1.DEFAULT_TURN_DELAY_MS,
            botStartDelayMs: BotSettingsService_1.DEFAULT_START_DELAY_MS,
            botDrawDelayMs: BotSettingsService_1.DEFAULT_DRAW_DELAY_MS,
        };
    }
    async ensureSeeded() {
        if (this.cache)
            return;
        try {
            const existing = await this.repo.findOne({ where: { id: 1 } });
            if (existing) {
                this.cache = {
                    botTurnDelayMs: this.clampDelay(existing.botTurnDelayMs),
                    botStartDelayMs: this.clampDelay(existing.botStartDelayMs),
                    botDrawDelayMs: this.clampDelay(existing.botDrawDelayMs),
                };
                return;
            }
            const delay = BotSettingsService_1.DEFAULT_TURN_DELAY_MS;
            const startDelay = BotSettingsService_1.DEFAULT_START_DELAY_MS;
            const drawDelay = BotSettingsService_1.DEFAULT_DRAW_DELAY_MS;
            await this.repo.insert({
                id: 1,
                botTurnDelayMs: delay,
                botStartDelayMs: startDelay,
                botDrawDelayMs: drawDelay,
            });
            this.cache = {
                botTurnDelayMs: delay,
                botStartDelayMs: startDelay,
                botDrawDelayMs: drawDelay,
            };
        }
        catch (error) {
            this.logger.warn(`Impossible de charger/initialiser bot_settings: ${error.message}`);
            this.cache = {
                botTurnDelayMs: BotSettingsService_1.DEFAULT_TURN_DELAY_MS,
                botStartDelayMs: BotSettingsService_1.DEFAULT_START_DELAY_MS,
                botDrawDelayMs: BotSettingsService_1.DEFAULT_DRAW_DELAY_MS,
            };
        }
    }
};
exports.BotSettingsService = BotSettingsService;
exports.BotSettingsService = BotSettingsService = BotSettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(bot_settings_entity_1.BotSettingsEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], BotSettingsService);
//# sourceMappingURL=bot-settings.service.js.map