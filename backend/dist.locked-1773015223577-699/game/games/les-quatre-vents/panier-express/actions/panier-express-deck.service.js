"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PanierExpressDeckService", {
    enumerable: true,
    get: function() {
        return PanierExpressDeckService;
    }
});
const _common = require("@nestjs/common");
const _deckpoolservice = require("../../../../modules/cards/services/deck-pool.service");
const _randomservice = require("../../../../modules/random/services/random.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let PanierExpressDeckService = class PanierExpressDeckService {
    drawCard(meta, key) {
        const metaRng = this.random.createMetaRng(meta);
        const { card, pool } = this.deckPool.draw(meta.decks, key, metaRng.rng);
        return {
            card: card ?? null,
            metadata: {
                ...metaRng.getMeta(),
                decks: pool
            }
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
        const pool = this.deckPool.set(meta.decks, key, this.deckPool.shuffle([
            ...cards
        ], metaRng.rng));
        return {
            ...metaRng.getMeta(),
            decks: pool
        };
    }
    constructor(deckPool, random){
        this.deckPool = deckPool;
        this.random = random;
    }
};
PanierExpressDeckService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _deckpoolservice.DeckPoolService === "undefined" ? Object : _deckpoolservice.DeckPoolService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], PanierExpressDeckService);
