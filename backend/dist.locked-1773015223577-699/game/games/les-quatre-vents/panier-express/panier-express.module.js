"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PanierExpressModule", {
    enumerable: true,
    get: function() {
        return PanierExpressModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _cardsmodule = require("../../../modules/cards/cards.module");
const _effectsmodule = require("../../../modules/effects/effects.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _playermodule = require("../../../modules/player/player.module");
const _actionresolvermodule = require("../../../modules/action-resolver/action-resolver.module");
const _actionlogmodule = require("../../../modules/actionlog/actionlog.module");
const _quizmodule = require("../../../modules/quiz/quiz.module");
const _exchangemodule = require("../../../modules/exchange/exchange.module");
const _victorymodule = require("../../../modules/victory/victory.module");
const _panierexpressservice = require("./panier-express.service");
const _panierexpresssetupservice = require("./setup/panier-express-setup.service");
const _panierexpressdrawservice = require("./actions/panier-express-draw.service");
const _panierexpressquizservice = require("./actions/panier-express-quiz.service");
const _panierexpressexchangeservice = require("./actions/panier-express-exchange.service");
const _panierexpressutilsservice = require("./model/panier-express-utils.service");
const _panierexpressdeckservice = require("./actions/panier-express-deck.service");
const _panierexpressbotservice = require("./bots/panier-express-bot.service");
const _panierexpressphaseservice = require("./phases/panier-express-phase.service");
const _panierexpresspresenterservice = require("./presenter/panier-express-presenter.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let PanierExpressModule = class PanierExpressModule {
};
PanierExpressModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameCoreKitModule,
            _coremodule.GameCoreModule,
            _cardsmodule.CardsModule,
            _effectsmodule.EffectsModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule,
            _playermodule.PlayerModule,
            _actionresolvermodule.ActionResolverModule,
            _actionlogmodule.ActionLogModule,
            _quizmodule.QuizModule,
            _exchangemodule.ExchangeModule,
            _victorymodule.VictoryModule
        ],
        providers: [
            _panierexpressservice.PanierExpressService,
            _panierexpresssetupservice.PanierExpressSetupService,
            _panierexpressdrawservice.PanierExpressDrawService,
            _panierexpressquizservice.PanierExpressQuizService,
            _panierexpressexchangeservice.PanierExpressExchangeService,
            _panierexpressutilsservice.PanierExpressUtils,
            _panierexpressdeckservice.PanierExpressDeckService,
            _panierexpressbotservice.PanierExpressBotService,
            _panierexpressphaseservice.PanierExpressPhaseService,
            _panierexpresspresenterservice.PanierExpressPresenterService
        ],
        exports: [
            _panierexpressservice.PanierExpressService,
            _panierexpresssetupservice.PanierExpressSetupService,
            _panierexpressdrawservice.PanierExpressDrawService,
            _panierexpressquizservice.PanierExpressQuizService,
            _panierexpressexchangeservice.PanierExpressExchangeService,
            _panierexpressutilsservice.PanierExpressUtils,
            _panierexpressdeckservice.PanierExpressDeckService,
            _panierexpressbotservice.PanierExpressBotService,
            _panierexpressphaseservice.PanierExpressPhaseService,
            _panierexpresspresenterservice.PanierExpressPresenterService
        ]
    })
], PanierExpressModule);
