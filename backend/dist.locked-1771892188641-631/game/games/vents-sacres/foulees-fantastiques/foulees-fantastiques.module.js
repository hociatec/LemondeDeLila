"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FouleesFantastiquesModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const setup_flow_module_1 = require("../../../modules/setup-flow/setup-flow.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const foulees_fantastiques_service_1 = require("./foulees-fantastiques.service");
const foulees_fantastiques_setup_service_1 = require("./setup/foulees-fantastiques-setup.service");
const foulees_fantastiques_action_service_1 = require("./actions/foulees-fantastiques-action.service");
const foulees_fantastiques_phase_service_1 = require("./phases/foulees-fantastiques-phase.service");
const foulees_fantastiques_presenter_service_1 = require("./presenter/foulees-fantastiques-presenter.service");
const foulees_fantastiques_bot_service_1 = require("./bots/foulees-fantastiques-bot.service");
let FouleesFantastiquesModule = class FouleesFantastiquesModule {
};
exports.FouleesFantastiquesModule = FouleesFantastiquesModule;
exports.FouleesFantastiquesModule = FouleesFantastiquesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
            board_game_kits_module_1.BoardGameCoreKitModule,
            setup_flow_module_1.SetupFlowModule,
        ],
        providers: [
            foulees_fantastiques_service_1.FouleesFantastiquesService,
            foulees_fantastiques_setup_service_1.FouleesFantastiquesSetupService,
            foulees_fantastiques_action_service_1.FouleesFantastiquesActionService,
            foulees_fantastiques_phase_service_1.FouleesFantastiquesPhaseService,
            foulees_fantastiques_presenter_service_1.FouleesFantastiquesPresenterService,
            foulees_fantastiques_bot_service_1.FouleesFantastiquesBotService,
        ],
        exports: [foulees_fantastiques_service_1.FouleesFantastiquesService],
    })
], FouleesFantastiquesModule);
//# sourceMappingURL=foulees-fantastiques.module.js.map