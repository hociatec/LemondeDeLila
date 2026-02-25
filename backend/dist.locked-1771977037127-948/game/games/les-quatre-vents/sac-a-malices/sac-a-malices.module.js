"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SacAMalicesModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const setup_flow_module_1 = require("../../../modules/setup-flow/setup-flow.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const sac_a_malices_service_1 = require("./sac-a-malices.service");
const sac_a_malices_setup_service_1 = require("./setup/sac-a-malices-setup.service");
const sac_a_malices_action_service_1 = require("./actions/sac-a-malices-action.service");
const sac_a_malices_presenter_service_1 = require("./presenter/sac-a-malices-presenter.service");
const sac_a_malices_bot_service_1 = require("./bots/sac-a-malices-bot.service");
let SacAMalicesModule = class SacAMalicesModule {
};
exports.SacAMalicesModule = SacAMalicesModule;
exports.SacAMalicesModule = SacAMalicesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
            board_game_kits_module_1.BoardGameDeckKitModule,
            setup_flow_module_1.SetupFlowModule,
        ],
        providers: [
            sac_a_malices_service_1.SacAMalicesService,
            sac_a_malices_setup_service_1.SacAMalicesSetupService,
            sac_a_malices_action_service_1.SacAMalicesActionService,
            sac_a_malices_presenter_service_1.SacAMalicesPresenterService,
            sac_a_malices_bot_service_1.SacAMalicesBotService,
        ],
        exports: [sac_a_malices_service_1.SacAMalicesService],
    })
], SacAMalicesModule);
//# sourceMappingURL=sac-a-malices.module.js.map