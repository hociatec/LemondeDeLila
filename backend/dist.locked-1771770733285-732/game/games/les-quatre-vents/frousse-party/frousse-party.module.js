"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FroussePartyModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const setup_flow_module_1 = require("../../../modules/setup-flow/setup-flow.module");
const board_effects_policies_module_1 = require("../../../modules/board-effects-policies/board-effects-policies.module");
const turn_policies_module_1 = require("../../../modules/turn-policies/turn-policies.module");
const prompt_policies_module_1 = require("../../../modules/prompt-policies/prompt-policies.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const frousse_party_service_1 = require("./frousse-party.service");
const frousse_setup_service_1 = require("./setup/frousse-setup.service");
const frousse_action_service_1 = require("./actions/frousse-action.service");
const frousse_presenter_service_1 = require("./presenter/frousse-presenter.service");
const frousse_bot_service_1 = require("./bots/frousse-bot.service");
let FroussePartyModule = class FroussePartyModule {
};
exports.FroussePartyModule = FroussePartyModule;
exports.FroussePartyModule = FroussePartyModule = __decorate([
    (0, common_1.Module)({
        imports: [
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
            board_game_kits_module_1.BoardGameDeckKitModule,
            setup_flow_module_1.SetupFlowModule,
            board_effects_policies_module_1.BoardEffectsPoliciesModule,
            turn_policies_module_1.TurnPoliciesModule,
            prompt_policies_module_1.PromptPoliciesModule,
        ],
        providers: [
            frousse_party_service_1.FroussePartyService,
            frousse_setup_service_1.FrousseSetupService,
            frousse_action_service_1.FrousseActionService,
            frousse_presenter_service_1.FroussePresenterService,
            frousse_bot_service_1.FrousseBotService,
        ],
        exports: [frousse_party_service_1.FroussePartyService],
    })
], FroussePartyModule);
//# sourceMappingURL=frousse-party.module.js.map