"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameWsHandler", {
    enumerable: true,
    get: function() {
        return GameWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../../common/validation/payload-validation.service");
const _gamecontentservice = require("../../engine/services/game-content.service");
const _gamemoduleoverviewservice = require("../../modules/game-module-overview.service");
const _gamerulesdto = require("../dto/game-rules.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GameWsHandler = class GameWsHandler {
    async rules(session, payload) {
        (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_gamerulesdto.GameRulesDto, payload);
        const gameType = dto.gameType;
        const rules = await this.content.getRules(gameType);
        return {
            type: 'game.rules',
            payload: {
                rules,
                gameType
            }
        };
    }
    async modules(session) {
        (0, _wsauth.requireUser)(session);
        const modules = this.overviewRegistry.getModules();
        return {
            type: 'game.modules',
            payload: {
                modules
            }
        };
    }
    constructor(content, overviewRegistry, validator){
        this.content = content;
        this.overviewRegistry = overviewRegistry;
        this.validator = validator;
    }
};
GameWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecontentservice.GameContentService === "undefined" ? Object : _gamecontentservice.GameContentService,
        typeof _gamemoduleoverviewservice.GameModuleOverviewRegistryService === "undefined" ? Object : _gamemoduleoverviewservice.GameModuleOverviewRegistryService,
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService
    ])
], GameWsHandler);
