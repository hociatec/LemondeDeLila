"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PanierExpressDeckService = void 0;
const common_1 = require("@nestjs/common");
const deck_pool_service_1 = require("../../../../modules/cards/services/deck-pool.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
let PanierExpressDeckService = class PanierExpressDeckService {
    deckPool;
    random;
    constructor(deckPool, random) {
        this.deckPool = deckPool;
        this.random = random;
    }
    drawCard(meta, key) {
        const metaRng = this.random.createMetaRng(meta);
        const { card, pool } = this.deckPool.draw(meta.decks, key, metaRng.rng);
        return {
            card: card ?? null,
            metadata: {
                ...metaRng.getMeta(),
                decks: pool,
            },
        };
    }
    drawWithReplenish(meta, key, replenish) {
        const initial = this.drawCard(meta, key);
        if (initial.card) {
            return initial;
        }
        const cards = replenish();
        if (!Array.isArray(cards) || cards.length === 0) {
            return initial;
        }
        const replenished = this.replenishDeck(meta, key, cards);
        return this.drawCard(replenished, key);
    }
    replenishDeck(meta, key, cards) {
        const metaRng = this.random.createMetaRng(meta);
        const pool = this.deckPool.set(meta.decks, key, this.deckPool.shuffle([...cards], metaRng.rng));
        return {
            ...metaRng.getMeta(),
            decks: pool,
        };
    }
};
exports.PanierExpressDeckService = PanierExpressDeckService;
exports.PanierExpressDeckService = PanierExpressDeckService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [deck_pool_service_1.DeckPoolService,
        random_service_1.RandomService])
], PanierExpressDeckService);
//# sourceMappingURL=panier-express-deck.service.js.map