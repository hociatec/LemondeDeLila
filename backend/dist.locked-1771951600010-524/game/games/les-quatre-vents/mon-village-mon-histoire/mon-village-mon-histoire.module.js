"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonVillageModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const mon_village_mon_histoire_service_1 = require("./mon-village-mon-histoire.service");
const mon_village_setup_service_1 = require("./setup/mon-village-setup.service");
const mon_village_action_service_1 = require("./actions/mon-village-action.service");
const mon_village_presenter_service_1 = require("./presenter/mon-village-presenter.service");
const mon_village_bot_service_1 = require("./bots/mon-village-bot.service");
let MonVillageModule = class MonVillageModule {
};
exports.MonVillageModule = MonVillageModule;
exports.MonVillageModule = MonVillageModule = __decorate([
    (0, common_1.Module)({
        imports: [
            board_game_kits_module_1.BoardGameDeckKitModule,
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
        ],
        providers: [
            mon_village_mon_histoire_service_1.MonVillageService,
            mon_village_setup_service_1.MonVillageSetupService,
            mon_village_action_service_1.MonVillageActionService,
            mon_village_presenter_service_1.MonVillagePresenterService,
            mon_village_bot_service_1.MonVillageBotService,
        ],
        exports: [mon_village_mon_histoire_service_1.MonVillageService],
    })
], MonVillageModule);
//# sourceMappingURL=mon-village-mon-histoire.module.js.map