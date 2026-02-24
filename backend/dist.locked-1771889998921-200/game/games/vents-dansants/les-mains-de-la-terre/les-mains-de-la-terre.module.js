"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LesMainsDeLaTerreModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const les_mains_de_la_terre_action_service_1 = require("./actions/les-mains-de-la-terre-action.service");
const les_mains_de_la_terre_bot_service_1 = require("./bots/les-mains-de-la-terre-bot.service");
const les_mains_de_la_terre_service_1 = require("./les-mains-de-la-terre.service");
const les_mains_de_la_terre_presenter_service_1 = require("./presenter/les-mains-de-la-terre-presenter.service");
const les_mains_de_la_terre_setup_service_1 = require("./setup/les-mains-de-la-terre-setup.service");
let LesMainsDeLaTerreModule = class LesMainsDeLaTerreModule {
};
exports.LesMainsDeLaTerreModule = LesMainsDeLaTerreModule;
exports.LesMainsDeLaTerreModule = LesMainsDeLaTerreModule = __decorate([
    (0, common_1.Module)({
        imports: [board_game_kits_module_1.BoardGameDeckKitModule, core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule],
        providers: [
            les_mains_de_la_terre_service_1.LesMainsDeLaTerreService,
            les_mains_de_la_terre_setup_service_1.LesMainsSetupService,
            les_mains_de_la_terre_action_service_1.LesMainsActionService,
            les_mains_de_la_terre_presenter_service_1.LesMainsPresenterService,
            les_mains_de_la_terre_bot_service_1.LesMainsDeLaTerreBotService,
        ],
        exports: [les_mains_de_la_terre_service_1.LesMainsDeLaTerreService],
    })
], LesMainsDeLaTerreModule);
//# sourceMappingURL=les-mains-de-la-terre.module.js.map