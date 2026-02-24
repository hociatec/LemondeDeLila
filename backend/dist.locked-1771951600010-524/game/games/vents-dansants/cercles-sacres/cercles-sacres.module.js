"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CerclesSacresModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const cercles_sacres_service_1 = require("./cercles-sacres.service");
const cercles_sacres_setup_service_1 = require("./setup/cercles-sacres-setup.service");
const cercles_sacres_action_service_1 = require("./actions/cercles-sacres-action.service");
const cercles_sacres_presenter_service_1 = require("./presenter/cercles-sacres-presenter.service");
const cercles_sacres_bot_service_1 = require("./bots/cercles-sacres-bot.service");
let CerclesSacresModule = class CerclesSacresModule {
};
exports.CerclesSacresModule = CerclesSacresModule;
exports.CerclesSacresModule = CerclesSacresModule = __decorate([
    (0, common_1.Module)({
        imports: [board_game_kits_module_1.BoardGameDeckKitModule, core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule],
        providers: [
            cercles_sacres_service_1.CerclesSacresService,
            cercles_sacres_setup_service_1.CerclesSacresSetupService,
            cercles_sacres_action_service_1.CerclesSacresActionService,
            cercles_sacres_presenter_service_1.CerclesSacresPresenterService,
            cercles_sacres_bot_service_1.CerclesSacresBotService,
        ],
        exports: [cercles_sacres_service_1.CerclesSacresService],
    })
], CerclesSacresModule);
//# sourceMappingURL=cercles-sacres.module.js.map