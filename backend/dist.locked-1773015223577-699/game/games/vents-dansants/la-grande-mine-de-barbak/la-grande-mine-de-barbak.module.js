"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LaGrandeMineDeBarbakModule", {
    enumerable: true,
    get: function() {
        return LaGrandeMineDeBarbakModule;
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
const _lagrandeminedebarbakservice = require("./la-grande-mine-de-barbak.service");
const _lagrandeminedebarbaksetupservice = require("./setup/la-grande-mine-de-barbak-setup.service");
const _lagrandeminedebarbakactionservice = require("./actions/la-grande-mine-de-barbak-action.service");
const _lagrandeminedebarbakpresenterservice = require("./presenter/la-grande-mine-de-barbak-presenter.service");
const _lagrandeminedebarbakbotservice = require("./bots/la-grande-mine-de-barbak-bot.service");
const _lagrandeminedebarbakphaseservice = require("./phases/la-grande-mine-de-barbak-phase.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let LaGrandeMineDeBarbakModule = class LaGrandeMineDeBarbakModule {
};
LaGrandeMineDeBarbakModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
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
            _lagrandeminedebarbakservice.LaGrandeMineDeBarbakService,
            _lagrandeminedebarbaksetupservice.LaGrandeMineSetupService,
            _lagrandeminedebarbakactionservice.LaGrandeMineDeBarbakActionService,
            _lagrandeminedebarbakpresenterservice.LaGrandeMineDeBarbakPresenterService,
            _lagrandeminedebarbakbotservice.LaGrandeMineDeBarbakBotService,
            _lagrandeminedebarbakphaseservice.LaGrandeMineDeBarbakPhaseService
        ],
        exports: [
            _lagrandeminedebarbakservice.LaGrandeMineDeBarbakService,
            _lagrandeminedebarbaksetupservice.LaGrandeMineSetupService,
            _lagrandeminedebarbakactionservice.LaGrandeMineDeBarbakActionService,
            _lagrandeminedebarbakpresenterservice.LaGrandeMineDeBarbakPresenterService,
            _lagrandeminedebarbakbotservice.LaGrandeMineDeBarbakBotService,
            _lagrandeminedebarbakphaseservice.LaGrandeMineDeBarbakPhaseService
        ]
    })
], LaGrandeMineDeBarbakModule);
