"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DameNatureModule = void 0;
const common_1 = require("@nestjs/common");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const core_module_1 = require("../../../core/core.module");
const dame_nature_service_1 = require("./dame-nature.service");
const dame_nature_setup_service_1 = require("./setup/dame-nature-setup.service");
const dame_nature_action_service_1 = require("./actions/dame-nature-action.service");
const dame_nature_presenter_service_1 = require("./presenter/dame-nature-presenter.service");
const dame_nature_bot_service_1 = require("./bots/dame-nature-bot.service");
let DameNatureModule = class DameNatureModule {
};
exports.DameNatureModule = DameNatureModule;
exports.DameNatureModule = DameNatureModule = __decorate([
    (0, common_1.Module)({
        imports: [board_game_kits_module_1.BoardGameDeckKitModule, core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule],
        providers: [
            dame_nature_service_1.DameNatureService,
            dame_nature_setup_service_1.DameNatureSetupService,
            dame_nature_action_service_1.DameNatureActionService,
            dame_nature_presenter_service_1.DameNaturePresenterService,
            dame_nature_bot_service_1.DameNatureBotService,
        ],
        exports: [dame_nature_service_1.DameNatureService],
    })
], DameNatureModule);
//# sourceMappingURL=dame-nature.module.js.map