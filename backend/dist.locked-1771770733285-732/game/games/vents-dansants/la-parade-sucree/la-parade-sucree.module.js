"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaParadeSucreeModule = void 0;
const common_1 = require("@nestjs/common");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const core_module_1 = require("../../../core/core.module");
const la_parade_sucree_service_1 = require("./la-parade-sucree.service");
const la_parade_sucree_setup_service_1 = require("./setup/la-parade-sucree-setup.service");
const la_parade_sucree_action_service_1 = require("./actions/la-parade-sucree-action.service");
const la_parade_sucree_presenter_service_1 = require("./presenter/la-parade-sucree-presenter.service");
const la_parade_sucree_bot_service_1 = require("./bots/la-parade-sucree-bot.service");
let LaParadeSucreeModule = class LaParadeSucreeModule {
};
exports.LaParadeSucreeModule = LaParadeSucreeModule;
exports.LaParadeSucreeModule = LaParadeSucreeModule = __decorate([
    (0, common_1.Module)({
        imports: [board_game_kits_module_1.BoardGameCoreKitModule, core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule],
        providers: [
            la_parade_sucree_service_1.LaParadeSucreeService,
            la_parade_sucree_setup_service_1.LaParadeSucreeSetupService,
            la_parade_sucree_action_service_1.LaParadeSucreeActionService,
            la_parade_sucree_presenter_service_1.LaParadeSucreePresenterService,
            la_parade_sucree_bot_service_1.LaParadeSucreeBotService,
        ],
        exports: [la_parade_sucree_service_1.LaParadeSucreeService],
    })
], LaParadeSucreeModule);
//# sourceMappingURL=la-parade-sucree.module.js.map