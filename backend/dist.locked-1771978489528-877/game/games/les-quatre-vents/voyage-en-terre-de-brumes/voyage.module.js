"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoyageModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const voyage_service_1 = require("./voyage.service");
const voyage_setup_service_1 = require("./setup/voyage-setup.service");
const voyage_action_service_1 = require("./actions/voyage-action.service");
const voyage_presenter_service_1 = require("./presenter/voyage-presenter.service");
const voyage_bot_service_1 = require("./bots/voyage-bot.service");
let VoyageModule = class VoyageModule {
};
exports.VoyageModule = VoyageModule;
exports.VoyageModule = VoyageModule = __decorate([
    (0, common_1.Module)({
        imports: [
            board_game_kits_module_1.BoardGameDeckKitModule,
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
        ],
        providers: [
            voyage_service_1.VoyageService,
            voyage_setup_service_1.VoyageSetupService,
            voyage_action_service_1.VoyageActionService,
            voyage_presenter_service_1.VoyagePresenterService,
            voyage_bot_service_1.VoyageBotService,
        ],
        exports: [voyage_service_1.VoyageService],
    })
], VoyageModule);
//# sourceMappingURL=voyage.module.js.map