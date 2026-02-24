"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LesAbsurdissimesModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const les_absurdissimes_action_service_1 = require("./actions/les-absurdissimes-action.service");
const les_absurdissimes_bot_service_1 = require("./bots/les-absurdissimes-bot.service");
const absurdissimes_deck_service_1 = require("./data/absurdissimes-deck.service");
const les_absurdissimes_presenter_service_1 = require("./presenter/les-absurdissimes-presenter.service");
const les_absurdissimes_setup_service_1 = require("./setup/les-absurdissimes-setup.service");
const les_absurdissimes_service_1 = require("./les-absurdissimes.service");
let LesAbsurdissimesModule = class LesAbsurdissimesModule {
};
exports.LesAbsurdissimesModule = LesAbsurdissimesModule;
exports.LesAbsurdissimesModule = LesAbsurdissimesModule = __decorate([
    (0, common_1.Module)({
        imports: [board_game_kits_module_1.BoardGameDeckKitModule, core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule],
        providers: [
            les_absurdissimes_service_1.LesAbsurdissimesService,
            absurdissimes_deck_service_1.AbsurdissimesDeckService,
            les_absurdissimes_setup_service_1.AbsurdissimesSetupService,
            les_absurdissimes_action_service_1.AbsurdissimesActionService,
            les_absurdissimes_presenter_service_1.AbsurdissimesPresenterService,
            les_absurdissimes_bot_service_1.AbsurdissimesBotService,
        ],
        exports: [les_absurdissimes_service_1.LesAbsurdissimesService],
    })
], LesAbsurdissimesModule);
//# sourceMappingURL=les-absurdissimes.module.js.map