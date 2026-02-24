"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NawakModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const nawak_action_service_1 = require("./actions/nawak-action.service");
const nawak_bot_service_1 = require("./bots/nawak-bot.service");
const nawak_challenge_service_1 = require("./data/nawak-challenge.service");
const nawak_presenter_service_1 = require("./presenter/nawak-presenter.service");
const nawak_setup_service_1 = require("./setup/nawak-setup.service");
const nawak_service_1 = require("./nawak.service");
let NawakModule = class NawakModule {
};
exports.NawakModule = NawakModule;
exports.NawakModule = NawakModule = __decorate([
    (0, common_1.Module)({
        imports: [board_game_kits_module_1.BoardGameCoreKitModule, core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule],
        providers: [
            nawak_service_1.NawakService,
            nawak_challenge_service_1.NawakChallengeService,
            nawak_setup_service_1.NawakSetupService,
            nawak_action_service_1.NawakActionService,
            nawak_presenter_service_1.NawakPresenterService,
            nawak_bot_service_1.NawakBotService,
        ],
        exports: [nawak_service_1.NawakService],
    })
], NawakModule);
//# sourceMappingURL=nawak.module.js.map