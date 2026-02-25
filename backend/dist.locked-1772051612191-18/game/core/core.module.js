"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameCoreModule", {
    enumerable: true,
    get: function() {
        return GameCoreModule;
    }
});
const _common = require("@nestjs/common");
const _gamecoreservice = require("./services/game-core.service");
const _boardmodule = require("../modules/board/board.module");
const _movementmodule = require("../modules/movement/movement.module");
const _cardsmodule = require("../modules/cards/cards.module");
const _inventorymodule = require("../modules/inventory/inventory.module");
const _exchangemodule = require("../modules/exchange/exchange.module");
const _quizmodule = require("../modules/quiz/quiz.module");
const _effectsmodule = require("../modules/effects/effects.module");
const _botmodule = require("../modules/bot/bot.module");
const _turnmodule = require("../modules/turn/turn.module");
const _victorymodule = require("../modules/victory/victory.module");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let GameCoreModule = class GameCoreModule {
};
GameCoreModule = _ts_decorate([
    (0, _common.Global)(),
    (0, _common.Module)({
        imports: [
            _boardmodule.BoardModule,
            _movementmodule.MovementModule,
            _cardsmodule.CardsModule,
            _inventorymodule.InventoryModule,
            _exchangemodule.ExchangeModule,
            _quizmodule.QuizModule,
            _effectsmodule.EffectsModule,
            _botmodule.BotModule,
            (0, _common.forwardRef)(()=>_turnmodule.TurnModule),
            _victorymodule.VictoryModule
        ],
        providers: [
            _gamecoreservice.GameCoreService
        ],
        exports: [
            _gamecoreservice.GameCoreService
        ]
    })
], GameCoreModule);
