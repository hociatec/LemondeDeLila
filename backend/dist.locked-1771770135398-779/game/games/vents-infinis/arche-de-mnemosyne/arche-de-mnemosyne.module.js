"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArcheDeMnemosyneModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const arche_de_mnemosyne_service_1 = require("./arche-de-mnemosyne.service");
const mnemo_quiz_store_service_1 = require("./store/mnemo-quiz-store.service");
let ArcheDeMnemosyneModule = class ArcheDeMnemosyneModule {
};
exports.ArcheDeMnemosyneModule = ArcheDeMnemosyneModule;
exports.ArcheDeMnemosyneModule = ArcheDeMnemosyneModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            board_game_kits_module_1.RandomTurnGameKitModule,
        ],
        providers: [arche_de_mnemosyne_service_1.ArcheDeMnemosyneService, mnemo_quiz_store_service_1.MnemoQuizStoreService],
        exports: [arche_de_mnemosyne_service_1.ArcheDeMnemosyneService, mnemo_quiz_store_service_1.MnemoQuizStoreService],
    })
], ArcheDeMnemosyneModule);
//# sourceMappingURL=arche-de-mnemosyne.module.js.map