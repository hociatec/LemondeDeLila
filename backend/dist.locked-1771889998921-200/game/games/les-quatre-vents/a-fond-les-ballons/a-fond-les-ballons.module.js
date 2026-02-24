"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AFondLesBallonsModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const setup_flow_module_1 = require("../../../modules/setup-flow/setup-flow.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const a_fond_les_ballons_service_1 = require("./a-fond-les-ballons.service");
const a_fond_les_ballons_setup_service_1 = require("./setup/a-fond-les-ballons-setup.service");
const a_fond_les_ballons_action_service_1 = require("./actions/a-fond-les-ballons-action.service");
const a_fond_les_ballons_presenter_service_1 = require("./presenter/a-fond-les-ballons-presenter.service");
const a_fond_les_ballons_bot_service_1 = require("./bots/a-fond-les-ballons-bot.service");
let AFondLesBallonsModule = class AFondLesBallonsModule {
};
exports.AFondLesBallonsModule = AFondLesBallonsModule;
exports.AFondLesBallonsModule = AFondLesBallonsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
            board_game_kits_module_1.BoardGameDeckKitModule,
            setup_flow_module_1.SetupFlowModule,
        ],
        providers: [
            a_fond_les_ballons_service_1.AFondLesBallonsService,
            a_fond_les_ballons_setup_service_1.AFondLesBallonsSetupService,
            a_fond_les_ballons_action_service_1.AFondLesBallonsActionService,
            a_fond_les_ballons_presenter_service_1.AFondLesBallonsPresenterService,
            a_fond_les_ballons_bot_service_1.AFondLesBallonsBotService,
        ],
        exports: [a_fond_les_ballons_service_1.AFondLesBallonsService],
    })
], AFondLesBallonsModule);
//# sourceMappingURL=a-fond-les-ballons.module.js.map