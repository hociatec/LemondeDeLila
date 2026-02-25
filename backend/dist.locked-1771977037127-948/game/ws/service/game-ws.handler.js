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
exports.GameWsHandler = void 0;
const common_1 = require("@nestjs/common");
const ws_auth_1 = require("../../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../../common/validation/payload-validation.service");
const game_content_service_1 = require("../../engine/services/game-content.service");
const game_module_overview_service_1 = require("../../modules/game-module-overview.service");
const game_rules_dto_1 = require("../dto/game-rules.dto");
let GameWsHandler = class GameWsHandler {
    content;
    overviewRegistry;
    validator;
    constructor(content, overviewRegistry, validator) {
        this.content = content;
        this.overviewRegistry = overviewRegistry;
        this.validator = validator;
    }
    async rules(session, payload) {
        (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(game_rules_dto_1.GameRulesDto, payload);
        const gameType = dto.gameType;
        const rules = await this.content.getRules(gameType);
        return { type: 'game.rules', payload: { rules, gameType } };
    }
    async modules(session) {
        (0, ws_auth_1.requireUser)(session);
        const modules = this.overviewRegistry.getModules();
        return { type: 'game.modules', payload: { modules } };
    }
};
exports.GameWsHandler = GameWsHandler;
exports.GameWsHandler = GameWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_content_service_1.GameContentService,
        game_module_overview_service_1.GameModuleOverviewRegistryService,
        payload_validation_service_1.PayloadValidationService])
], GameWsHandler);
//# sourceMappingURL=game-ws.handler.js.map