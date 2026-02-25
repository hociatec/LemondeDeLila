"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaGrandeMineDeBarbakModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const cards_module_1 = require("../../../modules/cards/cards.module");
const effects_module_1 = require("../../../modules/effects/effects.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const engine_services_module_1 = require("../../../engine/services/engine-services.module");
const player_module_1 = require("../../../modules/player/player.module");
const action_resolver_module_1 = require("../../../modules/action-resolver/action-resolver.module");
const actionlog_module_1 = require("../../../modules/actionlog/actionlog.module");
const quiz_module_1 = require("../../../modules/quiz/quiz.module");
const exchange_module_1 = require("../../../modules/exchange/exchange.module");
const victory_module_1 = require("../../../modules/victory/victory.module");
const la_grande_mine_de_barbak_service_1 = require("./la-grande-mine-de-barbak.service");
const la_grande_mine_de_barbak_setup_service_1 = require("./setup/la-grande-mine-de-barbak-setup.service");
const la_grande_mine_de_barbak_action_service_1 = require("./actions/la-grande-mine-de-barbak-action.service");
const la_grande_mine_de_barbak_presenter_service_1 = require("./presenter/la-grande-mine-de-barbak-presenter.service");
const la_grande_mine_de_barbak_bot_service_1 = require("./bots/la-grande-mine-de-barbak-bot.service");
const la_grande_mine_de_barbak_phase_service_1 = require("./phases/la-grande-mine-de-barbak-phase.service");
let LaGrandeMineDeBarbakModule = class LaGrandeMineDeBarbakModule {
};
exports.LaGrandeMineDeBarbakModule = LaGrandeMineDeBarbakModule;
exports.LaGrandeMineDeBarbakModule = LaGrandeMineDeBarbakModule = __decorate([
    (0, common_1.Module)({
        imports: [
            board_game_kits_module_1.BoardGameDeckKitModule,
            core_module_1.GameCoreModule,
            cards_module_1.CardsModule,
            effects_module_1.EffectsModule,
            game_registry_module_1.GameRegistryModule,
            engine_services_module_1.EngineServicesModule,
            player_module_1.PlayerModule,
            action_resolver_module_1.ActionResolverModule,
            actionlog_module_1.ActionLogModule,
            quiz_module_1.QuizModule,
            exchange_module_1.ExchangeModule,
            victory_module_1.VictoryModule,
        ],
        providers: [
            la_grande_mine_de_barbak_service_1.LaGrandeMineDeBarbakService,
            la_grande_mine_de_barbak_setup_service_1.LaGrandeMineSetupService,
            la_grande_mine_de_barbak_action_service_1.LaGrandeMineDeBarbakActionService,
            la_grande_mine_de_barbak_presenter_service_1.LaGrandeMineDeBarbakPresenterService,
            la_grande_mine_de_barbak_bot_service_1.LaGrandeMineDeBarbakBotService,
            la_grande_mine_de_barbak_phase_service_1.LaGrandeMineDeBarbakPhaseService,
        ],
        exports: [
            la_grande_mine_de_barbak_service_1.LaGrandeMineDeBarbakService,
            la_grande_mine_de_barbak_setup_service_1.LaGrandeMineSetupService,
            la_grande_mine_de_barbak_action_service_1.LaGrandeMineDeBarbakActionService,
            la_grande_mine_de_barbak_presenter_service_1.LaGrandeMineDeBarbakPresenterService,
            la_grande_mine_de_barbak_bot_service_1.LaGrandeMineDeBarbakBotService,
            la_grande_mine_de_barbak_phase_service_1.LaGrandeMineDeBarbakPhaseService,
        ],
    })
], LaGrandeMineDeBarbakModule);
//# sourceMappingURL=la-grande-mine-de-barbak.module.js.map