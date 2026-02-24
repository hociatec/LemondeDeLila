"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PanierExpressModule = void 0;
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
const panier_express_service_1 = require("./panier-express.service");
const panier_express_setup_service_1 = require("./setup/panier-express-setup.service");
const panier_express_draw_service_1 = require("./actions/panier-express-draw.service");
const panier_express_quiz_service_1 = require("./actions/panier-express-quiz.service");
const panier_express_exchange_service_1 = require("./actions/panier-express-exchange.service");
const panier_express_utils_service_1 = require("./model/panier-express-utils.service");
const panier_express_deck_service_1 = require("./actions/panier-express-deck.service");
const panier_express_bot_service_1 = require("./bots/panier-express-bot.service");
const panier_express_phase_service_1 = require("./phases/panier-express-phase.service");
const panier_express_presenter_service_1 = require("./presenter/panier-express-presenter.service");
let PanierExpressModule = class PanierExpressModule {
};
exports.PanierExpressModule = PanierExpressModule;
exports.PanierExpressModule = PanierExpressModule = __decorate([
    (0, common_1.Module)({
        imports: [
            board_game_kits_module_1.BoardGameCoreKitModule,
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
            panier_express_service_1.PanierExpressService,
            panier_express_setup_service_1.PanierExpressSetupService,
            panier_express_draw_service_1.PanierExpressDrawService,
            panier_express_quiz_service_1.PanierExpressQuizService,
            panier_express_exchange_service_1.PanierExpressExchangeService,
            panier_express_utils_service_1.PanierExpressUtils,
            panier_express_deck_service_1.PanierExpressDeckService,
            panier_express_bot_service_1.PanierExpressBotService,
            panier_express_phase_service_1.PanierExpressPhaseService,
            panier_express_presenter_service_1.PanierExpressPresenterService,
        ],
        exports: [
            panier_express_service_1.PanierExpressService,
            panier_express_setup_service_1.PanierExpressSetupService,
            panier_express_draw_service_1.PanierExpressDrawService,
            panier_express_quiz_service_1.PanierExpressQuizService,
            panier_express_exchange_service_1.PanierExpressExchangeService,
            panier_express_utils_service_1.PanierExpressUtils,
            panier_express_deck_service_1.PanierExpressDeckService,
            panier_express_bot_service_1.PanierExpressBotService,
            panier_express_phase_service_1.PanierExpressPhaseService,
            panier_express_presenter_service_1.PanierExpressPresenterService,
        ],
    })
], PanierExpressModule);
//# sourceMappingURL=panier-express.module.js.map