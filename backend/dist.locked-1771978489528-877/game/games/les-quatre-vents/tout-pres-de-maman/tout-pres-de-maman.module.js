"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToutPresDeMamanModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const tout_pres_de_maman_service_1 = require("./tout-pres-de-maman.service");
const tout_pres_de_maman_setup_service_1 = require("./setup/tout-pres-de-maman-setup.service");
const tout_pres_de_maman_action_service_1 = require("./actions/tout-pres-de-maman-action.service");
const tout_pres_de_maman_presenter_service_1 = require("./presenter/tout-pres-de-maman-presenter.service");
const tout_pres_de_maman_bot_service_1 = require("./bots/tout-pres-de-maman-bot.service");
let ToutPresDeMamanModule = class ToutPresDeMamanModule {
};
exports.ToutPresDeMamanModule = ToutPresDeMamanModule;
exports.ToutPresDeMamanModule = ToutPresDeMamanModule = __decorate([
    (0, common_1.Module)({
        imports: [
            board_game_kits_module_1.BoardGameDeckKitModule,
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
        ],
        providers: [
            tout_pres_de_maman_service_1.ToutPresDeMamanService,
            tout_pres_de_maman_setup_service_1.ToutPresDeMamanSetupService,
            tout_pres_de_maman_action_service_1.ToutPresDeMamanActionService,
            tout_pres_de_maman_presenter_service_1.ToutPresDeMamanPresenterService,
            tout_pres_de_maman_bot_service_1.ToutPresDeMamanBotService,
        ],
        exports: [tout_pres_de_maman_service_1.ToutPresDeMamanService],
    })
], ToutPresDeMamanModule);
//# sourceMappingURL=tout-pres-de-maman.module.js.map