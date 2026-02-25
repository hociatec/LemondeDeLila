"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RandomTurnGameKitModule = exports.RandomGameCoreKitModule = exports.GridGameBotKitModule = exports.GridGameCoreKitModule = exports.BoardGameDeckKitModule = exports.BoardGameCoreKitModule = void 0;
const common_1 = require("@nestjs/common");
const board_module_1 = require("../board/board.module");
const bot_module_1 = require("../bot/bot.module");
const deck_policies_module_1 = require("../deck-policies/deck-policies.module");
const grid_module_1 = require("../grid/grid.module");
const random_module_1 = require("../random/random.module");
const turn_module_1 = require("../turn/turn.module");
let BoardGameCoreKitModule = class BoardGameCoreKitModule {
};
exports.BoardGameCoreKitModule = BoardGameCoreKitModule;
exports.BoardGameCoreKitModule = BoardGameCoreKitModule = __decorate([
    (0, common_1.Module)({
        imports: [random_module_1.RandomModule, turn_module_1.TurnModule, board_module_1.BoardModule, bot_module_1.BotModule],
        exports: [random_module_1.RandomModule, turn_module_1.TurnModule, board_module_1.BoardModule, bot_module_1.BotModule],
    })
], BoardGameCoreKitModule);
let BoardGameDeckKitModule = class BoardGameDeckKitModule {
};
exports.BoardGameDeckKitModule = BoardGameDeckKitModule;
exports.BoardGameDeckKitModule = BoardGameDeckKitModule = __decorate([
    (0, common_1.Module)({
        imports: [BoardGameCoreKitModule, deck_policies_module_1.DeckPoliciesModule],
        exports: [BoardGameCoreKitModule, deck_policies_module_1.DeckPoliciesModule],
    })
], BoardGameDeckKitModule);
let GridGameCoreKitModule = class GridGameCoreKitModule {
};
exports.GridGameCoreKitModule = GridGameCoreKitModule;
exports.GridGameCoreKitModule = GridGameCoreKitModule = __decorate([
    (0, common_1.Module)({
        imports: [grid_module_1.GridModule],
        exports: [grid_module_1.GridModule],
    })
], GridGameCoreKitModule);
let GridGameBotKitModule = class GridGameBotKitModule {
};
exports.GridGameBotKitModule = GridGameBotKitModule;
exports.GridGameBotKitModule = GridGameBotKitModule = __decorate([
    (0, common_1.Module)({
        imports: [GridGameCoreKitModule, bot_module_1.BotModule],
        exports: [GridGameCoreKitModule, bot_module_1.BotModule],
    })
], GridGameBotKitModule);
let RandomGameCoreKitModule = class RandomGameCoreKitModule {
};
exports.RandomGameCoreKitModule = RandomGameCoreKitModule;
exports.RandomGameCoreKitModule = RandomGameCoreKitModule = __decorate([
    (0, common_1.Module)({
        imports: [random_module_1.RandomModule],
        exports: [random_module_1.RandomModule],
    })
], RandomGameCoreKitModule);
let RandomTurnGameKitModule = class RandomTurnGameKitModule {
};
exports.RandomTurnGameKitModule = RandomTurnGameKitModule;
exports.RandomTurnGameKitModule = RandomTurnGameKitModule = __decorate([
    (0, common_1.Module)({
        imports: [RandomGameCoreKitModule, turn_module_1.TurnModule],
        exports: [RandomGameCoreKitModule, turn_module_1.TurnModule],
    })
], RandomTurnGameKitModule);
//# sourceMappingURL=board-game-kits.module.js.map