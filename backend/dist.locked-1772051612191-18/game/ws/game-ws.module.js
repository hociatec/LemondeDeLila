"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameWsModule", {
    enumerable: true,
    get: function() {
        return GameWsModule;
    }
});
const _common = require("@nestjs/common");
const _gameregistrymodule = require("../engine/game-registry.module");
const _boardmodule = require("../modules/board/board.module");
const _cardsmodule = require("../modules/cards/cards.module");
const _movementmodule = require("../modules/movement/movement.module");
const _inventorymodule = require("../modules/inventory/inventory.module");
const _exchangemodule = require("../modules/exchange/exchange.module");
const _turnmodule = require("../modules/turn/turn.module");
const _effectsmodule = require("../modules/effects/effects.module");
const _quizmodule = require("../modules/quiz/quiz.module");
const _victorymodule = require("../modules/victory/victory.module");
const _gamecontentservice = require("../engine/services/game-content.service");
const _gamemoduleoverviewservice = require("../modules/game-module-overview.service");
const _gamewshandler = require("./service/game-ws.handler");
const _gamewsregistrar = require("./service/game-ws.registrar");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let GameWsModule = class GameWsModule {
};
GameWsModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _gameregistrymodule.GameRegistryModule,
            _boardmodule.BoardModule,
            _cardsmodule.CardsModule,
            _movementmodule.MovementModule,
            _inventorymodule.InventoryModule,
            _exchangemodule.ExchangeModule,
            _turnmodule.TurnModule,
            _effectsmodule.EffectsModule,
            _quizmodule.QuizModule,
            _victorymodule.VictoryModule
        ],
        providers: [
            _gamecontentservice.GameContentService,
            _gamemoduleoverviewservice.GameModuleOverviewRegistryService,
            _gamewshandler.GameWsHandler,
            _gamewsregistrar.GameWsRegistrar
        ]
    })
], GameWsModule);
