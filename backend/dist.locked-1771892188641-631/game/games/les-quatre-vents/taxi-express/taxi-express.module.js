"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxiExpressModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const taxi_express_service_1 = require("./taxi-express.service");
const taxi_express_setup_service_1 = require("./setup/taxi-express-setup.service");
const taxi_express_action_service_1 = require("./actions/taxi-express-action.service");
const taxi_express_presenter_service_1 = require("./presenter/taxi-express-presenter.service");
const taxi_express_bot_service_1 = require("./bots/taxi-express-bot.service");
let TaxiExpressModule = class TaxiExpressModule {
};
exports.TaxiExpressModule = TaxiExpressModule;
exports.TaxiExpressModule = TaxiExpressModule = __decorate([
    (0, common_1.Module)({
        imports: [
            board_game_kits_module_1.BoardGameDeckKitModule,
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
        ],
        providers: [
            taxi_express_service_1.TaxiExpressService,
            taxi_express_setup_service_1.TaxiExpressSetupService,
            taxi_express_action_service_1.TaxiExpressActionService,
            taxi_express_presenter_service_1.TaxiExpressPresenterService,
            taxi_express_bot_service_1.TaxiExpressBotService,
        ],
        exports: [taxi_express_service_1.TaxiExpressService],
    })
], TaxiExpressModule);
//# sourceMappingURL=taxi-express.module.js.map