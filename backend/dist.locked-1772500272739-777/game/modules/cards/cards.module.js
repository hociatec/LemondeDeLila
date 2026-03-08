"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CardsModule", {
    enumerable: true,
    get: function() {
        return CardsModule;
    }
});
const _common = require("@nestjs/common");
const _cardsservice = require("./services/cards.service");
const _deckmanagerservice = require("./services/deck-manager.service");
const _deckpoolservice = require("./services/deck-pool.service");
const _gamemoduleoverviewconstants = require("../game-module-overview.constants");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
const cardsOverviewProvider = {
    provide: _gamemoduleoverviewconstants.GAME_MODULE_OVERVIEW,
    useExisting: _cardsservice.CardsService
};
let CardsModule = class CardsModule {
};
CardsModule = _ts_decorate([
    (0, _common.Module)({
        providers: [
            _cardsservice.CardsService,
            _deckmanagerservice.DeckManagerService,
            _deckpoolservice.DeckPoolService,
            cardsOverviewProvider
        ],
        exports: [
            _cardsservice.CardsService,
            _deckmanagerservice.DeckManagerService,
            _deckpoolservice.DeckPoolService,
            cardsOverviewProvider
        ]
    })
], CardsModule);
