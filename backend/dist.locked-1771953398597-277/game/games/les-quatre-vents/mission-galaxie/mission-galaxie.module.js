"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionGalaxieModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const mission_galaxie_service_1 = require("./mission-galaxie.service");
const mission_galaxie_setup_service_1 = require("./setup/mission-galaxie-setup.service");
const mission_galaxie_action_service_1 = require("./actions/mission-galaxie-action.service");
const mission_galaxie_presenter_service_1 = require("./presenter/mission-galaxie-presenter.service");
const mission_galaxie_bot_service_1 = require("./bots/mission-galaxie-bot.service");
let MissionGalaxieModule = class MissionGalaxieModule {
};
exports.MissionGalaxieModule = MissionGalaxieModule;
exports.MissionGalaxieModule = MissionGalaxieModule = __decorate([
    (0, common_1.Module)({
        imports: [
            board_game_kits_module_1.BoardGameDeckKitModule,
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
        ],
        providers: [
            mission_galaxie_service_1.MissionGalaxieService,
            mission_galaxie_setup_service_1.MissionGalaxieSetupService,
            mission_galaxie_action_service_1.MissionGalaxieActionService,
            mission_galaxie_presenter_service_1.MissionGalaxiePresenterService,
            mission_galaxie_bot_service_1.MissionGalaxieBotService,
        ],
        exports: [mission_galaxie_service_1.MissionGalaxieService],
    })
], MissionGalaxieModule);
//# sourceMappingURL=mission-galaxie.module.js.map