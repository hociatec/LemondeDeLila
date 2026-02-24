"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BandeABananeModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const la_bande_a_banane_action_service_1 = require("./actions/la-bande-a-banane-action.service");
const la_bande_a_banane_bot_service_1 = require("./bots/la-bande-a-banane-bot.service");
const la_bande_a_banane_presenter_service_1 = require("./presenter/la-bande-a-banane-presenter.service");
const la_bande_a_banane_setup_service_1 = require("./setup/la-bande-a-banane-setup.service");
const la_bande_a_banane_service_1 = require("./la-bande-a-banane.service");
let BandeABananeModule = class BandeABananeModule {
};
exports.BandeABananeModule = BandeABananeModule;
exports.BandeABananeModule = BandeABananeModule = __decorate([
    (0, common_1.Module)({
        imports: [board_game_kits_module_1.BoardGameDeckKitModule, core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule],
        providers: [
            la_bande_a_banane_service_1.BandeABananeService,
            la_bande_a_banane_setup_service_1.BandeABananeSetupService,
            la_bande_a_banane_action_service_1.BandeABananeActionService,
            la_bande_a_banane_presenter_service_1.BandeABananePresenterService,
            la_bande_a_banane_bot_service_1.BandeABananeBotService,
        ],
        exports: [la_bande_a_banane_service_1.BandeABananeService],
    })
], BandeABananeModule);
//# sourceMappingURL=la-bande-a-banane.module.js.map