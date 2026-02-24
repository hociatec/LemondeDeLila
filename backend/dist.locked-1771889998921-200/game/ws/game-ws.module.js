"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameWsModule = void 0;
const common_1 = require("@nestjs/common");
const game_registry_module_1 = require("../engine/game-registry.module");
const board_module_1 = require("../modules/board/board.module");
const cards_module_1 = require("../modules/cards/cards.module");
const movement_module_1 = require("../modules/movement/movement.module");
const inventory_module_1 = require("../modules/inventory/inventory.module");
const exchange_module_1 = require("../modules/exchange/exchange.module");
const turn_module_1 = require("../modules/turn/turn.module");
const effects_module_1 = require("../modules/effects/effects.module");
const quiz_module_1 = require("../modules/quiz/quiz.module");
const victory_module_1 = require("../modules/victory/victory.module");
const game_content_service_1 = require("../engine/services/game-content.service");
const game_module_overview_service_1 = require("../modules/game-module-overview.service");
const game_ws_handler_1 = require("./service/game-ws.handler");
const game_ws_registrar_1 = require("./service/game-ws.registrar");
let GameWsModule = class GameWsModule {
};
exports.GameWsModule = GameWsModule;
exports.GameWsModule = GameWsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            game_registry_module_1.GameRegistryModule,
            board_module_1.BoardModule,
            cards_module_1.CardsModule,
            movement_module_1.MovementModule,
            inventory_module_1.InventoryModule,
            exchange_module_1.ExchangeModule,
            turn_module_1.TurnModule,
            effects_module_1.EffectsModule,
            quiz_module_1.QuizModule,
            victory_module_1.VictoryModule,
        ],
        providers: [
            game_content_service_1.GameContentService,
            game_module_overview_service_1.GameModuleOverviewRegistryService,
            game_ws_handler_1.GameWsHandler,
            game_ws_registrar_1.GameWsRegistrar,
        ],
    })
], GameWsModule);
//# sourceMappingURL=game-ws.module.js.map