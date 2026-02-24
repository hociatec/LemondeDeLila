"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdysseeQuatreCieuxModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const odyssee_service_1 = require("./odyssee.service");
const odyssee_setup_service_1 = require("./setup/odyssee-setup.service");
const odyssee_action_service_1 = require("./actions/odyssee-action.service");
const odyssee_presenter_service_1 = require("./presenter/odyssee-presenter.service");
const odyssee_bot_service_1 = require("./bots/odyssee-bot.service");
let OdysseeQuatreCieuxModule = class OdysseeQuatreCieuxModule {
};
exports.OdysseeQuatreCieuxModule = OdysseeQuatreCieuxModule;
exports.OdysseeQuatreCieuxModule = OdysseeQuatreCieuxModule = __decorate([
    (0, common_1.Module)({
        imports: [core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule, board_game_kits_module_1.BoardGameCoreKitModule],
        providers: [
            odyssee_service_1.OdysseeQuatreCieuxService,
            odyssee_setup_service_1.OdysseeSetupService,
            odyssee_action_service_1.OdysseeActionService,
            odyssee_presenter_service_1.OdysseePresenterService,
            odyssee_bot_service_1.OdysseeBotService,
        ],
        exports: [odyssee_service_1.OdysseeQuatreCieuxService],
    })
], OdysseeQuatreCieuxModule);
//# sourceMappingURL=odyssee.module.js.map