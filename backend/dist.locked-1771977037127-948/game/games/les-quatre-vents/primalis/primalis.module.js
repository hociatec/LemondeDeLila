"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimalisModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const primalis_service_1 = require("./primalis.service");
const primalis_setup_service_1 = require("./setup/primalis-setup.service");
const primalis_action_service_1 = require("./actions/primalis-action.service");
const primalis_presenter_service_1 = require("./presenter/primalis-presenter.service");
const primalis_bot_service_1 = require("./bots/primalis-bot.service");
let PrimalisModule = class PrimalisModule {
};
exports.PrimalisModule = PrimalisModule;
exports.PrimalisModule = PrimalisModule = __decorate([
    (0, common_1.Module)({
        imports: [
            board_game_kits_module_1.BoardGameCoreKitModule,
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
        ],
        providers: [
            primalis_service_1.PrimalisService,
            primalis_setup_service_1.PrimalisSetupService,
            primalis_action_service_1.PrimalisActionService,
            primalis_presenter_service_1.PrimalisPresenterService,
            primalis_bot_service_1.PrimalisBotService,
        ],
        exports: [primalis_service_1.PrimalisService],
    })
], PrimalisModule);
//# sourceMappingURL=primalis.module.js.map