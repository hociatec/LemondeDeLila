"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GaloponsEnsembleModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const galopons_ensemble_service_1 = require("./galopons-ensemble.service");
const galopons_setup_service_1 = require("./setup/galopons-setup.service");
const galopons_action_service_1 = require("./actions/galopons-action.service");
const galopons_presenter_service_1 = require("./presenter/galopons-presenter.service");
const galopons_bot_service_1 = require("./bots/galopons-bot.service");
let GaloponsEnsembleModule = class GaloponsEnsembleModule {
};
exports.GaloponsEnsembleModule = GaloponsEnsembleModule;
exports.GaloponsEnsembleModule = GaloponsEnsembleModule = __decorate([
    (0, common_1.Module)({
        imports: [
            board_game_kits_module_1.BoardGameDeckKitModule,
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
        ],
        providers: [
            galopons_ensemble_service_1.GaloponsEnsembleService,
            galopons_setup_service_1.GaloponsSetupService,
            galopons_action_service_1.GaloponsActionService,
            galopons_presenter_service_1.GaloponsPresenterService,
            galopons_bot_service_1.GaloponsBotService,
        ],
        exports: [galopons_ensemble_service_1.GaloponsEnsembleService],
    })
], GaloponsEnsembleModule);
//# sourceMappingURL=galopons-ensemble.module.js.map