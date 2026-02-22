"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JeuOieModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const setup_flow_module_1 = require("../../../modules/setup-flow/setup-flow.module");
const turn_policies_module_1 = require("../../../modules/turn-policies/turn-policies.module");
const prompt_policies_module_1 = require("../../../modules/prompt-policies/prompt-policies.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const jeu_oie_service_1 = require("./jeu-oie.service");
const jeu_oie_setup_service_1 = require("./setup/jeu-oie-setup.service");
const jeu_oie_action_service_1 = require("./actions/jeu-oie-action.service");
const jeu_oie_phase_service_1 = require("./phases/jeu-oie-phase.service");
const jeu_oie_presenter_service_1 = require("./presenter/jeu-oie-presenter.service");
const jeu_oie_bot_service_1 = require("./bots/jeu-oie-bot.service");
let JeuOieModule = class JeuOieModule {
};
exports.JeuOieModule = JeuOieModule;
exports.JeuOieModule = JeuOieModule = __decorate([
    (0, common_1.Module)({
        imports: [
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
            board_game_kits_module_1.BoardGameCoreKitModule,
            setup_flow_module_1.SetupFlowModule,
            turn_policies_module_1.TurnPoliciesModule,
            prompt_policies_module_1.PromptPoliciesModule,
        ],
        providers: [
            jeu_oie_service_1.JeuOieService,
            jeu_oie_setup_service_1.JeuOieSetupService,
            jeu_oie_action_service_1.JeuOieActionService,
            jeu_oie_phase_service_1.JeuOiePhaseService,
            jeu_oie_presenter_service_1.JeuOiePresenterService,
            jeu_oie_bot_service_1.JeuOieBotService,
        ],
        exports: [jeu_oie_service_1.JeuOieService],
    })
], JeuOieModule);
//# sourceMappingURL=jeu-oie.module.js.map