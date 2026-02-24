"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaDerapeModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const ca_derape_service_1 = require("./ca-derape.service");
const ca_setup_1 = require("./setup/ca.setup");
const ca_actions_service_1 = require("./actions/ca-actions.service");
const ca_presenter_service_1 = require("./presenter/ca-presenter.service");
const ca_bot_service_1 = require("./bots/ca-bot.service");
let CaDerapeModule = class CaDerapeModule {
};
exports.CaDerapeModule = CaDerapeModule;
exports.CaDerapeModule = CaDerapeModule = __decorate([
    (0, common_1.Module)({
        imports: [board_game_kits_module_1.BoardGameDeckKitModule, core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule],
        providers: [
            ca_derape_service_1.CaDerapeService,
            ca_setup_1.CaSetupService,
            ca_actions_service_1.CaActionService,
            ca_presenter_service_1.CaPresenterService,
            ca_bot_service_1.CaBotService,
        ],
        exports: [ca_derape_service_1.CaDerapeService],
    })
], CaDerapeModule);
//# sourceMappingURL=ca-derape.module.js.map