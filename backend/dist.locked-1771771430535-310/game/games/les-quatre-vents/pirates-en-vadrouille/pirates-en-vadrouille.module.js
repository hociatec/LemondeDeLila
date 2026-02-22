"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PiratesEnVadrouilleModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const pirates_en_vadrouille_service_1 = require("./pirates-en-vadrouille.service");
const pirates_en_vadrouille_setup_service_1 = require("./setup/pirates-en-vadrouille-setup.service");
const pirates_en_vadrouille_action_service_1 = require("./actions/pirates-en-vadrouille-action.service");
const pirates_en_vadrouille_presenter_service_1 = require("./presenter/pirates-en-vadrouille-presenter.service");
const pirates_en_vadrouille_bot_service_1 = require("./bots/pirates-en-vadrouille-bot.service");
let PiratesEnVadrouilleModule = class PiratesEnVadrouilleModule {
};
exports.PiratesEnVadrouilleModule = PiratesEnVadrouilleModule;
exports.PiratesEnVadrouilleModule = PiratesEnVadrouilleModule = __decorate([
    (0, common_1.Module)({
        imports: [
            board_game_kits_module_1.BoardGameDeckKitModule,
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
        ],
        providers: [
            pirates_en_vadrouille_service_1.PiratesEnVadrouilleService,
            pirates_en_vadrouille_setup_service_1.PiratesEnVadrouilleSetupService,
            pirates_en_vadrouille_action_service_1.PiratesEnVadrouilleActionService,
            pirates_en_vadrouille_presenter_service_1.PiratesEnVadrouillePresenterService,
            pirates_en_vadrouille_bot_service_1.PiratesEnVadrouilleBotService,
        ],
        exports: [pirates_en_vadrouille_service_1.PiratesEnVadrouilleService],
    })
], PiratesEnVadrouilleModule);
//# sourceMappingURL=pirates-en-vadrouille.module.js.map