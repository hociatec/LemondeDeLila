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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminBotsWsHandler = void 0;
const common_1 = require("@nestjs/common");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const bot_service_1 = require("../../bot/services/bot.service");
const bot_settings_service_1 = require("../../game/modules/bot/services/bot-settings.service");
const admin_ws_dto_1 = require("./admin-ws.dto");
let AdminBotsWsHandler = class AdminBotsWsHandler {
    validator;
    bots;
    botSettings;
    constructor(validator, bots, botSettings) {
        this.validator = validator;
        this.bots = bots;
        this.botSettings = botSettings;
    }
    async botsNamesList(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        this.validator.validate(admin_ws_dto_1.AdminBotNamesListWsDto, payload ?? {});
        const names = await this.bots.listBotNames();
        return {
            type: 'admin.bots.names.list',
            payload: {
                names: names.map((n) => ({
                    id: n.id,
                    name: n.name,
                    enabled: n.enabled,
                    createdAt: n.createdAt,
                })),
            },
        };
    }
    botSettingsGet(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        this.validator.validate(admin_ws_dto_1.AdminBotSettingsGetWsDto, payload ?? {});
        return {
            type: 'admin.bots.settings.get',
            payload: this.botSettings.getSettings(),
        };
    }
    async botSettingsUpdate(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminBotSettingsUpdateWsDto, payload);
        const updated = await this.botSettings.updateSettings({
            botTurnDelayMs: dto.botTurnDelayMs,
            botStartDelayMs: dto.botStartDelayMs,
            botDrawDelayMs: dto.botDrawDelayMs,
        });
        return { type: 'admin.bots.settings.update', payload: updated };
    }
    async botNameCreate(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminBotNameCreateWsDto, payload);
        await this.bots.createBotName(dto.name, dto.enabled ?? true);
        return this.botsNamesList(session, {});
    }
    async botNameUpdate(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminBotNameUpdateWsDto, payload);
        await this.bots.updateBotName(dto.id, {
            name: dto.name,
            enabled: dto.enabled,
        });
        return this.botsNamesList(session, {});
    }
    async botNameDelete(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminBotNameDeleteWsDto, payload);
        await this.bots.deleteBotName(dto.id);
        return this.botsNamesList(session, {});
    }
};
exports.AdminBotsWsHandler = AdminBotsWsHandler;
exports.AdminBotsWsHandler = AdminBotsWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        bot_service_1.BotService,
        bot_settings_service_1.BotSettingsService])
], AdminBotsWsHandler);
//# sourceMappingURL=admin-bots-ws.handler.js.map