"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContesModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const setup_flow_module_1 = require("../../../modules/setup-flow/setup-flow.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const turn_policies_module_1 = require("../../../modules/turn-policies/turn-policies.module");
const contes_service_1 = require("./contes.service");
const contes_et_cacahuetes_setup_service_1 = require("./setup/contes-et-cacahuetes-setup.service");
const contes_action_service_1 = require("./actions/contes-action.service");
const contes_presenter_service_1 = require("./presenter/contes-presenter.service");
const contes_bot_service_1 = require("./bots/contes-bot.service");
let ContesModule = class ContesModule {
};
exports.ContesModule = ContesModule;
exports.ContesModule = ContesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            board_game_kits_module_1.BoardGameDeckKitModule,
            setup_flow_module_1.SetupFlowModule,
            turn_policies_module_1.TurnPoliciesModule,
        ],
        providers: [
            contes_service_1.ContesService,
            contes_et_cacahuetes_setup_service_1.ContesCacahuetesSetupService,
            contes_action_service_1.ContesActionService,
            contes_presenter_service_1.ContesPresenterService,
            contes_bot_service_1.ContesBotService,
        ],
        exports: [contes_service_1.ContesService],
    })
], ContesModule);
//# sourceMappingURL=contes.module.js.map