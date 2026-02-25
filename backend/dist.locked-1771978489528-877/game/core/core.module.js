"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameCoreModule = void 0;
const common_1 = require("@nestjs/common");
const game_core_service_1 = require("./services/game-core.service");
const board_module_1 = require("../modules/board/board.module");
const movement_module_1 = require("../modules/movement/movement.module");
const cards_module_1 = require("../modules/cards/cards.module");
const inventory_module_1 = require("../modules/inventory/inventory.module");
const exchange_module_1 = require("../modules/exchange/exchange.module");
const quiz_module_1 = require("../modules/quiz/quiz.module");
const effects_module_1 = require("../modules/effects/effects.module");
const bot_module_1 = require("../modules/bot/bot.module");
const turn_module_1 = require("../modules/turn/turn.module");
const victory_module_1 = require("../modules/victory/victory.module");
let GameCoreModule = class GameCoreModule {
};
exports.GameCoreModule = GameCoreModule;
exports.GameCoreModule = GameCoreModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            board_module_1.BoardModule,
            movement_module_1.MovementModule,
            cards_module_1.CardsModule,
            inventory_module_1.InventoryModule,
            exchange_module_1.ExchangeModule,
            quiz_module_1.QuizModule,
            effects_module_1.EffectsModule,
            bot_module_1.BotModule,
            (0, common_1.forwardRef)(() => turn_module_1.TurnModule),
            victory_module_1.VictoryModule,
        ],
        providers: [game_core_service_1.GameCoreService],
        exports: [game_core_service_1.GameCoreService],
    })
], GameCoreModule);
//# sourceMappingURL=core.module.js.map