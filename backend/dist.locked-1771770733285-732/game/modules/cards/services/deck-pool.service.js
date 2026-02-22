"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeckPoolService = void 0;
const common_1 = require("@nestjs/common");
let DeckPoolService = class DeckPoolService {
    shuffle(arr, rng = Math.random) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = Math.floor(rng() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }
    draw(pool, key, rng = Math.random) {
        const state = pool[key] ?? { deck: [], discards: [] };
        let deck = [...state.deck];
        let discards = [...state.discards];
        if (deck.length === 0 && discards.length > 0) {
            deck = this.shuffle(discards, rng);
            discards = [];
        }
        if (deck.length === 0) {
            return { card: null, pool: pool };
        }
        const [card, ...rest] = deck;
        const updated = {
            ...pool,
            [key]: { deck: rest, discards },
        };
        return { card, pool: updated };
    }
    drawMany(pool, key, count, rng = Math.random) {
        const target = Math.max(0, Math.floor(count));
        let nextPool = pool;
        const cards = [];
        for (let i = 0; i < target; i += 1) {
            const { card, pool: updated } = this.draw(nextPool, key, rng);
            nextPool = updated;
            if (card == null)
                break;
            cards.push(card);
        }
        return { cards, pool: nextPool };
    }
    discardMany(pool, key, cards) {
        const safe = Array.isArray(cards) ? cards : [];
        let next = pool;
        for (const card of safe) {
            next = this.discard(next, key, card);
        }
        return next;
    }
    discard(pool, key, card) {
        const state = pool[key] ?? { deck: [], discards: [] };
        return {
            ...pool,
            [key]: { deck: state.deck, discards: [...state.discards, card] },
        };
    }
    set(pool, key, deck, discards = []) {
        return { ...pool, [key]: { deck, discards } };
    }
};
exports.DeckPoolService = DeckPoolService;
exports.DeckPoolService = DeckPoolService = __decorate([
    (0, common_1.Injectable)()
], DeckPoolService);
//# sourceMappingURL=deck-pool.service.js.map