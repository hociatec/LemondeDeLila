"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get BoardGameCoreKitModule () {
        return BoardGameCoreKitModule;
    },
    get BoardGameDeckKitModule () {
        return BoardGameDeckKitModule;
    },
    get GridGameBotKitModule () {
        return GridGameBotKitModule;
    },
    get GridGameCoreKitModule () {
        return GridGameCoreKitModule;
    },
    get RandomGameCoreKitModule () {
        return RandomGameCoreKitModule;
    },
    get RandomTurnGameKitModule () {
        return RandomTurnGameKitModule;
    }
});
const _common = require("@nestjs/common");
const _boardmodule = require("../board/board.module");
const _botmodule = require("../bot/bot.module");
const _deckpoliciesmodule = require("../deck-policies/deck-policies.module");
const _gridmodule = require("../grid/grid.module");
const _randommodule = require("../random/random.module");
const _turnmodule = require("../turn/turn.module");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let BoardGameCoreKitModule = class BoardGameCoreKitModule {
};
BoardGameCoreKitModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _randommodule.RandomModule,
            _turnmodule.TurnModule,
            _boardmodule.BoardModule,
            _botmodule.BotModule
        ],
        exports: [
            _randommodule.RandomModule,
            _turnmodule.TurnModule,
            _boardmodule.BoardModule,
            _botmodule.BotModule
        ]
    })
], BoardGameCoreKitModule);
let BoardGameDeckKitModule = class BoardGameDeckKitModule {
};
BoardGameDeckKitModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            BoardGameCoreKitModule,
            _deckpoliciesmodule.DeckPoliciesModule
        ],
        exports: [
            BoardGameCoreKitModule,
            _deckpoliciesmodule.DeckPoliciesModule
        ]
    })
], BoardGameDeckKitModule);
let GridGameCoreKitModule = class GridGameCoreKitModule {
};
GridGameCoreKitModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _gridmodule.GridModule
        ],
        exports: [
            _gridmodule.GridModule
        ]
    })
], GridGameCoreKitModule);
let GridGameBotKitModule = class GridGameBotKitModule {
};
GridGameBotKitModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            GridGameCoreKitModule,
            _botmodule.BotModule
        ],
        exports: [
            GridGameCoreKitModule,
            _botmodule.BotModule
        ]
    })
], GridGameBotKitModule);
let RandomGameCoreKitModule = class RandomGameCoreKitModule {
};
RandomGameCoreKitModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _randommodule.RandomModule
        ],
        exports: [
            _randommodule.RandomModule
        ]
    })
], RandomGameCoreKitModule);
let RandomTurnGameKitModule = class RandomTurnGameKitModule {
};
RandomTurnGameKitModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            RandomGameCoreKitModule,
            _turnmodule.TurnModule
        ],
        exports: [
            RandomGameCoreKitModule,
            _turnmodule.TurnModule
        ]
    })
], RandomTurnGameKitModule);
