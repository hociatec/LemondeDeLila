"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatPattesModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const setup_flow_module_1 = require("../../../modules/setup-flow/setup-flow.module");
const turn_policies_module_1 = require("../../../modules/turn-policies/turn-policies.module");
const prompt_policies_module_1 = require("../../../modules/prompt-policies/prompt-policies.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const cat_pattes_service_1 = require("./cat-pattes.service");
const cat_pattes_setup_service_1 = require("./setup/cat-pattes-setup.service");
const cat_pattes_action_service_1 = require("./actions/cat-pattes-action.service");
const cat_pattes_presenter_service_1 = require("./presenter/cat-pattes-presenter.service");
const cat_pattes_bot_service_1 = require("./bots/cat-pattes-bot.service");
let CatPattesModule = class CatPattesModule {
};
exports.CatPattesModule = CatPattesModule;
exports.CatPattesModule = CatPattesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            board_game_kits_module_1.BoardGameDeckKitModule,
            setup_flow_module_1.SetupFlowModule,
            turn_policies_module_1.TurnPoliciesModule,
            prompt_policies_module_1.PromptPoliciesModule,
        ],
        providers: [
            cat_pattes_service_1.CatPattesService,
            cat_pattes_setup_service_1.CatPattesSetupService,
            cat_pattes_action_service_1.CatPattesActionService,
            cat_pattes_presenter_service_1.CatPattesPresenterService,
            cat_pattes_bot_service_1.CatPattesBotService,
        ],
        exports: [cat_pattes_service_1.CatPattesService],
    })
], CatPattesModule);
//# sourceMappingURL=cat-pattes.module.js.map