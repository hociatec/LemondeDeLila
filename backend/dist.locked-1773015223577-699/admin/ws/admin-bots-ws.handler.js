"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminBotsWsHandler", {
    enumerable: true,
    get: function() {
        return AdminBotsWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _botservice = require("../../bot/services/bot.service");
const _botsettingsservice = require("../../game/modules/bot/services/bot-settings.service");
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
let AdminBotsWsHandler = class AdminBotsWsHandler {
    async botsNamesList(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        this.validator.validate(_adminwsdto.AdminBotNamesListWsDto, payload ?? {});
        const names = await this.bots.listBotNames();
        return {
            type: 'admin.bots.names.list',
            payload: {
                names: names.map((n)=>({
                        id: n.id,
                        name: n.name,
                        enabled: n.enabled,
                        createdAt: n.createdAt
                    }))
            }
        };
    }
    botSettingsGet(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        this.validator.validate(_adminwsdto.AdminBotSettingsGetWsDto, payload ?? {});
        return {
            type: 'admin.bots.settings.get',
            payload: this.botSettings.getSettings()
        };
    }
    async botSettingsUpdate(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminBotSettingsUpdateWsDto, payload);
        const updated = await this.botSettings.updateSettings({
            botTurnDelayMs: dto.botTurnDelayMs,
            botStartDelayMs: dto.botStartDelayMs,
            botDrawDelayMs: dto.botDrawDelayMs
        });
        return {
            type: 'admin.bots.settings.update',
            payload: updated
        };
    }
    async botNameCreate(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminBotNameCreateWsDto, payload);
        await this.bots.createBotName(dto.name, dto.enabled ?? true);
        return this.botsNamesList(session, {});
    }
    async botNameUpdate(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminBotNameUpdateWsDto, payload);
        await this.bots.updateBotName(dto.id, {
            name: dto.name,
            enabled: dto.enabled
        });
        return this.botsNamesList(session, {});
    }
    async botNameDelete(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminBotNameDeleteWsDto, payload);
        await this.bots.deleteBotName(dto.id);
        return this.botsNamesList(session, {});
    }
    constructor(validator, bots, botSettings){
        this.validator = validator;
        this.bots = bots;
        this.botSettings = botSettings;
    }
};
AdminBotsWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _botservice.BotService === "undefined" ? Object : _botservice.BotService,
        typeof _botsettingsservice.BotSettingsService === "undefined" ? Object : _botsettingsservice.BotSettingsService
    ])
], AdminBotsWsHandler);
