"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OlympiaModule = void 0;
const common_1 = require("@nestjs/common");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const core_module_1 = require("../../../core/core.module");
const olympia_service_1 = require("./olympia.service");
const olympia_setup_service_1 = require("./setup/olympia-setup.service");
const olympia_action_service_1 = require("./actions/olympia-action.service");
const olympia_presenter_service_1 = require("./presenter/olympia-presenter.service");
const olympia_bot_service_1 = require("./bots/olympia-bot.service");
let OlympiaModule = class OlympiaModule {
};
exports.OlympiaModule = OlympiaModule;
exports.OlympiaModule = OlympiaModule = __decorate([
    (0, common_1.Module)({
        imports: [board_game_kits_module_1.BoardGameCoreKitModule, core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule],
        providers: [
            olympia_service_1.OlympiaService,
            olympia_setup_service_1.OlympiaSetupService,
            olympia_action_service_1.OlympiaActionService,
            olympia_presenter_service_1.OlympiaPresenterService,
            olympia_bot_service_1.OlympiaBotService,
        ],
        exports: [olympia_service_1.OlympiaService],
    })
], OlympiaModule);
//# sourceMappingURL=olympia.module.js.map