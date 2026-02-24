"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardsModule = void 0;
const common_1 = require("@nestjs/common");
const cards_service_1 = require("./services/cards.service");
const deck_manager_service_1 = require("./services/deck-manager.service");
const deck_pool_service_1 = require("./services/deck-pool.service");
const game_module_overview_constants_1 = require("../game-module-overview.constants");
const cardsOverviewProvider = {
    provide: game_module_overview_constants_1.GAME_MODULE_OVERVIEW,
    useExisting: cards_service_1.CardsService,
};
let CardsModule = class CardsModule {
};
exports.CardsModule = CardsModule;
exports.CardsModule = CardsModule = __decorate([
    (0, common_1.Module)({
        providers: [
            cards_service_1.CardsService,
            deck_manager_service_1.DeckManagerService,
            deck_pool_service_1.DeckPoolService,
            cardsOverviewProvider,
        ],
        exports: [
            cards_service_1.CardsService,
            deck_manager_service_1.DeckManagerService,
            deck_pool_service_1.DeckPoolService,
            cardsOverviewProvider,
        ],
    })
], CardsModule);
//# sourceMappingURL=cards.module.js.map