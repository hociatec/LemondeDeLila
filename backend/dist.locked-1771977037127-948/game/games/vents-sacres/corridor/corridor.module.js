"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorridorModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const corridor_service_1 = require("./corridor.service");
const corridor_setup_service_1 = require("./setup/corridor-setup.service");
const corridor_action_service_1 = require("./actions/corridor-action.service");
const corridor_presenter_service_1 = require("./presenter/corridor-presenter.service");
const corridor_bot_service_1 = require("./bots/corridor-bot.service");
let CorridorModule = class CorridorModule {
};
exports.CorridorModule = CorridorModule;
exports.CorridorModule = CorridorModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            board_game_kits_module_1.GridGameBotKitModule,
        ],
        providers: [
            corridor_service_1.CorridorService,
            corridor_setup_service_1.CorridorSetupService,
            corridor_action_service_1.CorridorActionService,
            corridor_presenter_service_1.CorridorPresenterService,
            corridor_bot_service_1.CorridorBotService,
        ],
        exports: [corridor_service_1.CorridorService],
    })
], CorridorModule);
//# sourceMappingURL=corridor.module.js.map