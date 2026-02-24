"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PimpMyRideModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const pimp_my_ride_action_service_1 = require("./actions/pimp-my-ride-action.service");
const pimp_my_ride_setup_service_1 = require("./setup/pimp-my-ride-setup.service");
const pimp_my_ride_presenter_service_1 = require("./presenter/pimp-my-ride-presenter.service");
const pimp_my_ride_bot_service_1 = require("./bots/pimp-my-ride-bot.service");
const pimp_my_ride_phase_service_1 = require("./phases/pimp-my-ride-phase.service");
const pimp_my_ride_service_1 = require("./pimp-my-ride.service");
let PimpMyRideModule = class PimpMyRideModule {
};
exports.PimpMyRideModule = PimpMyRideModule;
exports.PimpMyRideModule = PimpMyRideModule = __decorate([
    (0, common_1.Module)({
        imports: [board_game_kits_module_1.BoardGameDeckKitModule, core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule],
        providers: [
            pimp_my_ride_service_1.PimpMyRideService,
            pimp_my_ride_setup_service_1.PimpMyRideSetupService,
            pimp_my_ride_action_service_1.PimpMyRideActionService,
            pimp_my_ride_presenter_service_1.PimpMyRidePresenterService,
            pimp_my_ride_bot_service_1.PimpMyRideBotService,
            pimp_my_ride_phase_service_1.PimpMyRidePhaseService,
        ],
        exports: [pimp_my_ride_service_1.PimpMyRideService],
    })
], PimpMyRideModule);
//# sourceMappingURL=pimp-my-ride.module.js.map